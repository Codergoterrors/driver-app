// ActiveOrderScreen — Pickup & Delivery with OSRM road routes, Uber-style buttons
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Linking, TextInput, PanResponder,
  Dimensions, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, darkMapStyle } from '../../constants';
import { useTheme } from '../../theme/ThemeContext';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActiveOrder, clearOrder, addEarnings } from '../../store/slices/orderSlice';
import { updateLocation } from '../../store/slices/locationSlice';
import { formatCurrency, formatDistance, formatDuration, haversineKm, estimatedMinutes, formatCustomerName, shortOrderId } from '../../utils';
import type { Order } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_THRESHOLD = SCREEN_WIDTH * 0.6;

// ─── OSRM route fetcher ──────────────────────────────────────────────────────
async function fetchOSRMRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
): Promise<{ latitude: number; longitude: number }[]> {
  try {
    if (startLat === 0 || endLat === 0) return [];
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    const data = await resp.json();
    if (data.code === 'Ok' && data.routes?.length) {
      return data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }),
      );
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Trim past waypoints from route ──────────────────────────────────────────
// Finds the closest point on the route to the driver and removes everything before it
function trimPassedRoute(
  route: { latitude: number; longitude: number }[],
  driverLat: number, driverLng: number,
): { latitude: number; longitude: number }[] {
  if (route.length < 2) return route;
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < route.length; i++) {
    const d = haversineKm(driverLat, driverLng, route[i].latitude, route[i].longitude);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }
  // Keep from the closest point onward
  return route.slice(closestIdx);
}

// ─── Uber-style slide button ──────────────────────────────────────────────────
const UberSlideButton: React.FC<{
  label: string;
  bgColor: string;
  textColor: string;
  thumbColor: string;
  onSlideComplete: () => void;
}> = ({ label, bgColor, textColor, thumbColor, onSlideComplete }) => {
  const slideX = useRef(new Animated.Value(0)).current;
  const trackWidth = SCREEN_WIDTH - 140; // account for cancel button + gaps
  const thumbSize = 52;
  const maxSlide = trackWidth - thumbSize - 8;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      if (g.dx >= 0 && g.dx <= maxSlide) slideX.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SLIDE_THRESHOLD) {
        Animated.timing(slideX, { toValue: maxSlide, duration: 150, useNativeDriver: true }).start(() => onSlideComplete());
      } else {
        Animated.spring(slideX, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }).start();
      }
    },
  })).current;

  return (
    <View style={[uberSlide.track, { backgroundColor: bgColor }]}>
      {/* Background chevrons (decorative) */}
      <Animated.View
        style={[uberSlide.thumb, { backgroundColor: thumbColor, transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        <Icon name="arrow-right" size={26} color="#FFF" />
      </Animated.View>
      <Text style={[uberSlide.label, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const uberSlide = StyleSheet.create({
  track: {
    height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative', flex: 1,
  },
  label: { fontSize: 16, fontWeight: '700', position: 'absolute' },
  thumb: {
    width: 52, height: 52, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    position: 'absolute', left: 2, top: 2,
  },
});

// ─── Big Red Drop-off Pin ─────────────────────────────────────────────────────
const RedDropPin: React.FC = () => (
  <View style={{ alignItems: 'center' }}>
    <View style={{
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: '#E8003D',
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 3, borderColor: '#FFF',
      elevation: 8, shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4, shadowRadius: 4,
    }}>
      <Icon name="map-marker" size={22} color="#FFF" />
    </View>
    {/* Pin tip */}
    <View style={{
      width: 0, height: 0,
      borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderTopColor: '#E8003D', marginTop: -2,
    }} />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ActiveOrderScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const dispatch = useAppDispatch();
  const activeOrder = useAppSelector(s => s.order.activeOrder);
  const location = useAppSelector(s => s.location);
  const rider = useAppSelector(s => s.auth.rider);
  const mapRef = useRef<MapView>(null);
  const [phase, setPhase] = useState<'pickup' | 'delivery'>(route.params?.phase || 'pickup');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [notReadyPressed, setNotReadyPressed] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const sheetHeight = useRef(new Animated.Value(160)).current;
  const isCancellingRef = useRef(false);
  const lastRouteRefetchRef = useRef(0);
  const lastRouteStartRef = useRef({ lat: 0, lng: 0 });
  const order = activeOrder;
  const lastFirestoreUpdate = useRef(0);

  // ── Handle openReportIssue param from OrderDetailsScreen ────────────────
  useEffect(() => {
    if (route.params?.openReportIssue) {
      setShowCancel(true);
      // Clear param to avoid re-triggering
      navigation.setParams({ openReportIssue: undefined });
    }
  }, [route.params?.openReportIssue]);

  // ── Order snapshot listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;
    const unsub = firestore().collection('orders').doc(order.orderId)
      .onSnapshot(doc => {
        if (doc.exists()) {
          const data = { orderId: doc.id, ...doc.data() } as Order;
          if (isCancellingRef.current) return;
          dispatch(setActiveOrder(data));
          if (data.status === 'PICKED_UP' || data.status === 'ON_THE_WAY') setPhase('delivery');
          if (data.status === 'DELIVERED') {
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
            setTimeout(() => dispatch(clearOrder()), 300);
            return;
          }
          if (data.status === 'CANCELLED') {
            if (data.cancelledBy === 'customer') {
              const { Alert } = require('react-native');
              Alert.alert(
                'Order Cancelled',
                'The customer cancelled the order.',
                [{
                  text: 'OK', onPress: () => {
                    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
                    setTimeout(() => dispatch(clearOrder()), 300);
                  },
                }],
              );
            } else {
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
              setTimeout(() => dispatch(clearOrder()), 300);
            }
            return;
          }
          if (data.orderNotReady) setNotReadyPressed(true);
          if (!data.orderNotReady) setNotReadyPressed(false);
        }
      });
    return () => unsub();
  }, [order?.orderId]);

  // ── Fetch & maintain OSRM route ──────────────────────────────────────────
  const fetchRoute = useCallback(async (fromLat: number, fromLng: number) => {
    if (!order) return;
    const toLat = phase === 'pickup' ? (order.restaurantLat || 0) : order.deliveryAddress.lat;
    const toLng = phase === 'pickup' ? (order.restaurantLng || 0) : order.deliveryAddress.lng;
    const coords = await fetchOSRMRoute(fromLat, fromLng, toLat, toLng);
    if (coords.length > 0) {
      setRouteCoords(coords);
      lastRouteStartRef.current = { lat: fromLat, lng: fromLng };
      lastRouteRefetchRef.current = Date.now();
    } else {
      setRouteCoords([
        { latitude: fromLat, longitude: fromLng },
        { latitude: toLat, longitude: toLng },
      ]);
    }
  }, [order, phase]);

  // ── Initial route fetch when phase/order changes ─────────────────────────
  useEffect(() => {
    if (!order || location.latitude === 0) return;
    fetchRoute(location.latitude, location.longitude);
    const dest = phase === 'pickup'
      ? { latitude: order.restaurantLat || 0, longitude: order.restaurantLng || 0 }
      : { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng };
    const coords = [
      { latitude: location.latitude, longitude: location.longitude },
      dest,
    ];
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 }, animated: true,
      });
    }, 800);
  }, [phase, order?.orderId]);

  // ── Location update: trim route + reroute if off-track ───────────────────
  useEffect(() => {
    if (!order || location.latitude === 0 || routeCoords.length === 0) return;
    const trimmed = trimPassedRoute(routeCoords, location.latitude, location.longitude);
    if (trimmed.length !== routeCoords.length) {
      setRouteCoords(trimmed);
    }
    const nearestDist = trimmed.length > 0
      ? haversineKm(location.latitude, location.longitude, trimmed[0].latitude, trimmed[0].longitude)
      : 999;
    const now = Date.now();
    const timeSinceLastFetch = now - lastRouteRefetchRef.current;
    if (nearestDist > 0.06 && timeSinceLastFetch > 20000) {
      fetchRoute(location.latitude, location.longitude);
    }
  }, [location.latitude, location.longitude]);
  useEffect(() => {
    if (!rider || !order || location.latitude === 0) return;

    // 1. Always update RTDB for real-time map tracking (~3s updates)
    database().ref(`liveLocations/${rider.uid}`).update({
      lat: location.latitude, lng: location.longitude,
      heading: location.heading || 0, speed: location.speed || 0,
      updatedAt: Date.now(), isOnline: true, activeOrderId: order.orderId,
    }).catch(err => console.log('RTDB update error:', err));

    // 2. Throttled Firestore updates every 10s — dual purpose:
    //    a) Update riders/{uid} for the Firestore polling fallback
    //    b) Embed coords in the order doc so customer tracking works
    //       even without Firebase rules deployed (customer reads own order)
    const now = Date.now();
    if (now - lastFirestoreUpdate.current > 10000) {
      lastFirestoreUpdate.current = now;

      // Update riders doc (for Firestore polling fallback)
      firestore().collection('riders').doc(rider.uid).update({
        currentLat: location.latitude,
        currentLng: location.longitude,
        heading: location.heading || 0,
        speed: location.speed || 0,
        isOnline: true,
        activeOrderId: order.orderId,
        updatedAt: now,
      }).catch(err => console.log('Firestore riders update error:', err));

      // Embed rider coordinates INTO the order document
      // Customer app reads this from its existing onOrderSnapshot listener—
      // no extra Firestore rules needed since customer can read their own order.
      firestore().collection('orders').doc(order.orderId).update({
        riderCurrentLat: location.latitude,
        riderCurrentLng: location.longitude,
        riderHeading: location.heading || 0,
      }).catch(err => console.log('Order location embed error:', err));
    }
  }, [location.latitude, location.longitude, rider, order]);

  // ── GPS tracking during active order ──────────────────────────────────────
  // Get an IMMEDIATE position fix on mount so the map doesn't show the stale
  // restaurant coordinates that HomeScreen's watchPosition left in Redux.
  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, heading, speed } = position.coords;
        dispatch(updateLocation({ latitude, longitude, heading: heading ?? 0, speed: speed ?? 0 }));
      },
      err => console.log('ActiveOrder getCurrentPosition error:', err),
      { enableHighAccuracy: true, timeout: 10000 },
    );

    const watchId = Geolocation.watchPosition(
      position => {
        const { latitude, longitude, heading, speed } = position.coords;
        dispatch(
          updateLocation({
            latitude,
            longitude,
            heading: heading ?? 0,
            speed: speed ?? 0,
          }),
        );
      },
      error => console.log('ActiveOrder watch error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 3000,
        fastestInterval: 1000,
      },
    );
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [dispatch]);

  const toggleSheet = () => {
    const target = sheetExpanded ? 160 : 520;
    Animated.spring(sheetHeight, { toValue: target, damping: 20, stiffness: 120, useNativeDriver: false }).start();
    setSheetExpanded(!sheetExpanded);
  };

  const openNavigation = () => {
    if (!order) return;
    const dest = phase === 'pickup'
      ? { lat: order.restaurantLat, lng: order.restaurantLng }
      : { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
    Linking.openURL(`google.navigation:q=${dest.lat},${dest.lng}`).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`)
    );
  };

  const handleStartDelivery = useCallback(async () => {
    if (!order) return;
    await firestore().collection('orders').doc(order.orderId).update({
      status: 'PICKED_UP', pickedUpAt: Date.now(), updatedAt: Date.now(),
      statusTimeline: firestore.FieldValue.arrayUnion({ status: 'PICKED_UP', timestamp: Date.now(), note: 'Order picked up by rider' }),
    });
    setPhase('delivery');
    setRouteCoords([]); // Will refetch from driver location for delivery leg
  }, [order]);

  /**
   * Handles the delivery completion process.
   * Performs PIN verification (if required) and updates the order status 
   * in Firestore while cleaning up location tracking listeners.
   */
  const handleCompleteDelivery = async () => {
    if (!order) return;
    // Normalize both sides to trimmed strings to handle Firestore type coercion
    // (Firestore may return the PIN as a number even if stored as a string)
    const storedPin = order.deliveryPin != null ? String(order.deliveryPin).trim() : null;
    const enteredPin = pinInput.trim();
    if (storedPin && enteredPin !== storedPin) {
      setPinError(true); return;
    }
    await firestore().collection('orders').doc(order.orderId).update({
      status: 'DELIVERED', deliveredAt: Date.now(), actualDeliveryTime: Date.now(), updatedAt: Date.now(),
      statusTimeline: firestore.FieldValue.arrayUnion({ status: 'DELIVERED', timestamp: Date.now(), note: 'Delivered successfully' }),
    });
    if (rider) {
      await firestore().collection('riders').doc(rider.uid).update({
        activeOrderId: null, totalDeliveries: firestore.FieldValue.increment(1),
        totalEarnings: firestore.FieldValue.increment(order.driverPayout || order.pricing.deliveryFee), updatedAt: Date.now(),
      });
      await database().ref(`liveLocations/${rider.uid}`).update({ activeOrderId: null });
    }
    dispatch(addEarnings(order.driverPayout || order.pricing.deliveryFee));
    dispatch(clearOrder());
    navigation.replace('Home');
  };

  const handleOrderNotReady = useCallback(async () => {
    if (!order) return;
    await firestore().collection('orders').doc(order.orderId).update({
      orderNotReady: true, updatedAt: Date.now(),
    });
    setNotReadyPressed(true);
  }, [order]);

  const handleOrderReady = useCallback(async () => {
    if (!order) return;
    await firestore().collection('orders').doc(order.orderId).update({
      orderNotReady: false, updatedAt: Date.now(),
    });
    setNotReadyPressed(false);
  }, [order]);

  const handleCancelOrder = useCallback(async () => {
    if (!order || !cancelReason) return;
    isCancellingRef.current = true;
    try {
      await firestore().collection('orders').doc(order.orderId).update({
        riderId: null, riderName: null, riderPhone: null, status: 'CANCELLED', updatedAt: Date.now(),
        cancelReason, cancelledBy: 'rider',
        statusTimeline: firestore.FieldValue.arrayUnion({ status: 'CANCELLED', timestamp: Date.now(), note: `Cancelled by rider: ${cancelReason}` }),
      });
      if (rider) {
        await firestore().collection('riders').doc(rider.uid).update({ activeOrderId: null, updatedAt: Date.now() });
        await database().ref(`liveLocations/${rider.uid}`).update({ activeOrderId: null });
      }
      setShowConfirmCancel(false);
      setShowCancel(false);
      // Fix #3: Use reset() to fully clear navigation stack on manual cancel
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      setTimeout(() => {
        dispatch(clearOrder());
        isCancellingRef.current = false;
      }, 300);
    } catch (error) {
      console.error('Error cancelling order:', error);
      isCancellingRef.current = false;
    }
  }, [order, cancelReason, rider]);

  if (!order) return null;

  const destCoord = phase === 'pickup'
    ? { latitude: order.restaurantLat || 0, longitude: order.restaurantLng || 0 }
    : { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng };
  const distKm = haversineKm(location.latitude, location.longitude, destCoord.latitude, destCoord.longitude);
  const estMin = estimatedMinutes(distKm);
  const statusLabel = phase === 'pickup'
    ? `Heading to ${order.restaurantName || 'pickup'}`
    : `Delivering to ${order.customerName || 'Customer'}`;

  const pickupReasons = ['Unable to find pickup', 'Excessive wait time', 'Order was canceled', 'Restaurant is closed', 'Order picked up by someone else', 'Oversized item', 'Other'];
  const deliveryReasons = ['Customer is not picking up the call', 'The address is wrong', 'Customer not available', 'Unsafe area', 'Vehicle issue', 'Other'];
  const cancelReasons = phase === 'pickup' ? pickupReasons : deliveryReasons;

  // Display route: use OSRM if available, else straight line
  const displayRoute = routeCoords.length >= 2
    ? routeCoords
    : location.latitude !== 0 ? [
        { latitude: location.latitude, longitude: location.longitude },
        destCoord,
      ] : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Address bar at top */}
      <View style={styles.addressBar}>
        <Icon name="map-marker" size={20} color={colors.background} />
        <Text style={styles.addressText} numberOfLines={2}>
          {phase === 'pickup' ? (order.restaurantAddress || order.restaurantName) : order.deliveryAddress.fullAddress}
        </Text>
      </View>

      {/* Map */}
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        customMapStyle={theme === 'dark' ? darkMapStyle : undefined}
        initialRegion={{ ...destCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation={false} showsMyLocationButton={false}>

        {/* Route polyline — OSRM road-following, bold and dark */}
        {displayRoute.length >= 2 && (
          <Polyline
            coordinates={displayRoute}
            strokeColor="#1A1A2E"
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Destination marker */}
        {phase === 'pickup' ? (
          <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.destMarker, { backgroundColor: colors.onlineGreen }]}>
              <Icon name="silverware-fork-knife" size={16} color={colors.white} />
            </View>
          </Marker>
        ) : (
          <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 1 }}>
            <RedDropPin />
          </Marker>
        )}

        {/* Driver marker */}
        {location.latitude !== 0 && (
          <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderMarker}><Icon name="navigation" size={18} color={colors.white} /></View>
          </Marker>
        )}
      </MapView>

      {/* Navigate button */}
      <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation} activeOpacity={0.85}>
        <Icon name="navigation-variant" size={18} color={colors.background} />
        <Text style={styles.navigateBtnText}>Navigate</Text>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
        <TouchableOpacity onPress={toggleSheet} activeOpacity={0.9}>
          <View style={styles.dragHandle} />
          <View style={styles.statusRow}>
            <Icon name="tune-variant" size={22} color={colors.textPrimary} />
            <Text style={styles.statusLabelText}>{statusLabel}</Text>
            <Icon name="format-list-bulleted" size={22} color={colors.textPrimary} />
          </View>
        </TouchableOpacity>

        {sheetExpanded && (
          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {phase === 'pickup' ? (
              // ─── PICKUP PHASE (Uber Eats style) ───────────────────────────
              <View>
                {/* Restaurant name — large */}
                <Text style={styles.restaurantName}>{order.restaurantName}</Text>

                {/* Separator */}
                <View style={styles.sectionDividerLine} />

                {/* Restaurant address */}
                <View style={styles.addressRow}>
                  <Icon name="map-marker" size={16} color={colors.textSecondary} />
                  <Text style={styles.addressDetail}>{order.restaurantAddress || order.restaurantName}</Text>
                </View>

                <View style={styles.divider} />

                {/* Pickup count */}
                <Text style={styles.pickupCount}>1 order for pick-up</Text>

                {/* Customer row */}
                <View style={styles.customerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{order.customerName || 'Customer'}</Text>
                    <Text style={styles.orderCode}>{shortOrderId(order.orderId)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => navigation.navigate('OrderDetails', { orderId: order.orderId })}
                  >
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>

                {/* "How was your pick-up?" with thumbs up/down */}
                <Text style={styles.howWasPickup}>How was your pick-up?</Text>
                <View style={styles.thumbsRow}>
                  <TouchableOpacity style={styles.thumbBtn} activeOpacity={0.7}>
                    <Icon name="thumb-up-outline" size={24} color={colors.onlineGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.thumbBtn} activeOpacity={0.7}>
                    <Icon name="thumb-down-outline" size={24} color={colors.errorRed} />
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Action row: cancel (triangle) + start delivery slide button */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.warningBtn} onPress={() => setShowCancel(true)}>
                    <Icon name="alert" size={24} color={colors.warningOrange} />
                  </TouchableOpacity>
                  <UberSlideButton
                    label="→  Start delivery"
                    bgColor="#06C167"
                    textColor="#FFF"
                    thumbColor="#038F4A"
                    onSlideComplete={handleStartDelivery}
                  />
                </View>
              </View>
            ) : (
              // ─── DELIVERY PHASE ────────────────────────────────────────────
              <View>
                <View style={styles.etaRow}>
                  <Text style={styles.etaText}>{formatDuration(estMin)}</Text>
                  <Icon name="map-marker" size={16} color={colors.textPrimary} />
                  <Text style={styles.etaText}>{formatDistance(distKm)}</Text>
                </View>
                <Text style={styles.customerNameLg}>{order.customerName || 'Customer'}</Text>
                <View style={styles.contactRow}>
                  <TouchableOpacity style={styles.contactBtn}><Icon name="message-text" size={20} color={colors.textPrimary} /></TouchableOpacity>
                  <TouchableOpacity style={styles.contactBtn}><Icon name="phone" size={20} color={colors.textPrimary} /></TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.pinCard}>
                  <Text style={styles.pinOrderCode}>{shortOrderId(order.orderId)}</Text>
                  <Text style={styles.pinRestaurant}>{order.restaurantName} · {order.items.length} items</Text>
                  <TextInput style={styles.pinInput} placeholder="Enter delivery PIN" placeholderTextColor={colors.textDisabled}
                    value={pinInput} onChangeText={t => { setPinInput(t); setPinError(false); }} keyboardType="numeric" maxLength={4} />
                  {pinError && <Text style={styles.pinErrorText}>Incorrect PIN. Try again.</Text>}
                </View>
                {/* Action row: cancel + end delivery slide (red) */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.warningBtn} onPress={() => setShowCancel(true)}>
                    <Icon name="alert" size={24} color={colors.warningOrange} />
                  </TouchableOpacity>
                  <UberSlideButton
                    label="→  End Delivery"
                    bgColor="#E8003D"
                    textColor="#FFF"
                    thumbColor="#A80029"
                    onSlideComplete={handleCompleteDelivery}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Cancel Modal */}
      {showCancel && !showConfirmCancel && (
        <View style={styles.cancelOverlay}>
          <View style={styles.cancelSheet}>
            <View style={styles.cancelHeader}>
              <TouchableOpacity onPress={() => { setShowCancel(false); setCancelReason(''); }}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.cancelTitle}>Report issue</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.cancelSubtitle}>What's the issue?</Text>
            <ScrollView>
              {cancelReasons.map(reason => (
                <TouchableOpacity key={reason} style={styles.cancelOption}
                  onPress={() => { setCancelReason(reason); setShowConfirmCancel(true); }} activeOpacity={0.7}>
                  <Icon name="alert-circle-outline" size={22} color={colors.errorRed} />
                  <Text style={styles.cancelOptionText}>{reason}</Text>
                  <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Confirm cancel */}
      {showConfirmCancel && (
        <View style={styles.cancelOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowConfirmCancel(false)} />
          <View style={styles.confirmSheet}>
            <View style={styles.confirmHandle} />
            <Icon name="alert-circle" size={48} color={colors.errorRed} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.confirmText}>Cancel this delivery?</Text>
            <Text style={styles.confirmSubtext}>Reason: {cancelReason}</Text>
            <TouchableOpacity style={styles.yesCancelBtn} onPress={handleCancelOrder}>
              <Text style={styles.yesCancelText}>Yes, cancel delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noGoBackBtn} onPress={() => { setShowConfirmCancel(false); setShowCancel(false); setCancelReason(''); }}>
              <Text style={styles.noGoBackText}>No, go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  addressBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: (StatusBar.currentHeight || 44) + 8,
    paddingBottom: 12, paddingHorizontal: Spacing.lg, gap: Spacing.sm, zIndex: 10,
  },
  addressText: { flex: 1, color: colors.background, fontSize: 16, fontWeight: '700' },
  destMarker: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  riderMarker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.riderPin,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  navigateBtn: {
    position: 'absolute', bottom: 175, right: Spacing.lg,
    flexDirection: 'row', backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, alignItems: 'center', gap: 6, elevation: 6,
  },
  navigateBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: Spacing.xl, elevation: 10,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.offlineGray,
    alignSelf: 'center', marginTop: 8, marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingBottom: 10,
  },
  statusLabelText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sheetContent: { flex: 1, paddingBottom: 40 },

  // ── Pickup screen styles (Uber Eats style) ──
  restaurantName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  sectionDividerLine: { height: 1, backgroundColor: colors.divider, marginBottom: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: Spacing.sm },
  addressDetail: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: Spacing.md },
  pickupCount: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.sm },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  orderCode: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  detailsBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  detailsBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  howWasPickup: { fontSize: 14, color: colors.textSecondary, marginTop: 12, marginBottom: 8 },
  thumbsRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  thumbBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: 20 },
  warningBtn: {
    width: 52, height: 56, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Delivery phase styles ──
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'center' },
  etaText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  customerNameLg: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginVertical: 8 },
  contactRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  contactBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  pinCard: { backgroundColor: colors.surface, borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.lg },
  pinOrderCode: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pinRestaurant: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  pinInput: {
    backgroundColor: colors.background, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: colors.textPrimary, textAlign: 'center',
    fontWeight: '700', letterSpacing: 4,
  },
  pinErrorText: { color: colors.errorRed, fontSize: 12, marginTop: 4, textAlign: 'center' },

  // ── Cancel overlay ──
  cancelOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  cancelSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, maxHeight: '85%', flex: 1,
  },
  cancelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  cancelTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cancelSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.md },
  cancelOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  cancelOptionText: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  confirmSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, paddingBottom: 40,
  },
  confirmHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.offlineGray, alignSelf: 'center', marginBottom: 20 },
  confirmText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  confirmSubtext: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  yesCancelBtn: { backgroundColor: colors.errorRed, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  yesCancelText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  noGoBackBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  noGoBackText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
});

export default ActiveOrderScreen;
