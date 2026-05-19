// OrderRequestScreen — Incoming order with map, route lines, accurate pricing
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing } from '../../constants';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActiveOrder, setIncomingOrder } from '../../store/slices/orderSlice';
import { formatCurrency, formatDistance, formatDuration, haversineKm, estimatedMinutes } from '../../utils';
import { startOrderSoundWithTimeout, cancelSoundTimer } from '../../utils/soundManager';
import type { Order } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OrderRequestScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const incomingOrder = useAppSelector(state => state.order.incomingOrder);
  const location = useAppSelector(state => state.location);
  const mapRef = useRef<MapView>(null);

  const [timeRemaining, setTimeRemaining] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(300)).current;

  const order = incomingOrder;

  useEffect(() => {
    Animated.spring(slideUpAnim, {
      toValue: 0, damping: 20, stiffness: 100, useNativeDriver: true,
    }).start();

    startOrderSoundWithTimeout(() => { handleDecline(); });

    Animated.timing(progressAnim, {
      toValue: 0, duration: 15000, useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelSoundTimer();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fit map to show all three points
  useEffect(() => {
    if (order && location.latitude !== 0) {
      const coords = [
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: order.restaurantLat || location.latitude, longitude: order.restaurantLng || location.longitude },
        { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng },
      ];
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 60, bottom: 350, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [order]);

  const handleAccept = useCallback(async () => {
    cancelSoundTimer();
    if (timerRef.current) clearInterval(timerRef.current);
    if (!order) return;

    try {
      await firestore().collection('orders').doc(order.orderId).update({
        status: 'PREPARING',
        acceptedAt: Date.now(),
        updatedAt: Date.now(),
        statusTimeline: firestore.FieldValue.arrayUnion({
          status: 'PREPARING', timestamp: Date.now(), note: 'Rider accepted delivery',
        }),
      });

      dispatch(setActiveOrder(order));
      dispatch(setIncomingOrder(null));
      navigation.replace('ActiveOrder', { orderId: order.orderId, phase: 'pickup' });
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  }, [order]);

  const handleDecline = useCallback(async () => {
    cancelSoundTimer();
    if (timerRef.current) clearInterval(timerRef.current);
    if (!order) { navigation.goBack(); return; }

    try {
      await firestore().collection('orders').doc(order.orderId).update({
        riderId: null, riderName: null, riderPhone: null,
        status: 'CONFIRMED', updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error declining order:', error);
    }

    dispatch(setIncomingOrder(null));
    navigation.goBack();
  }, [order]);

  if (!order) return null;

  // Calculate distances and payout
  const pickupKm = haversineKm(
    location.latitude || 0, location.longitude || 0,
    order.restaurantLat || 0, order.restaurantLng || 0,
  );
  const deliveryKm = haversineKm(
    order.restaurantLat || 0, order.restaurantLng || 0,
    order.deliveryAddress.lat, order.deliveryAddress.lng,
  );
  const totalKm = pickupKm + deliveryKm;
  const totalMin = estimatedMinutes(totalKm);

  // Pricing: pickup free first 2km then ₹7/km, delivery ₹15/km
  const pickupAmount = pickupKm > 2 ? (pickupKm - 2) * 7 : 0;
  const deliveryAmount = deliveryKm * 15;
  const driverPayout = order.driverPayout || Math.round((pickupAmount + deliveryAmount) * 100) / 100;

  const restaurantCoord = {
    latitude: order.restaurantLat || location.latitude,
    longitude: order.restaurantLng || location.longitude,
  };
  const dropCoord = {
    latitude: order.deliveryAddress.lat,
    longitude: order.deliveryAddress.lng,
  };
  const riderCoord = {
    latitude: location.latitude || restaurantCoord.latitude,
    longitude: location.longitude || restaurantCoord.longitude,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Map with route */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: restaurantCoord.latitude,
          longitude: restaurantCoord.longitude,
          latitudeDelta: 0.1, longitudeDelta: 0.1,
        }}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
        showsUserLocation={false}>

        {/* Route: driver to pickup (black line) */}
        <Polyline
          coordinates={[riderCoord, restaurantCoord]}
          strokeColor="#000000" strokeWidth={4}
          lineDashPattern={[10, 5]}
        />
        {/* Route: pickup to drop (black line) */}
        <Polyline
          coordinates={[restaurantCoord, dropCoord]}
          strokeColor="#000000" strokeWidth={4}
        />

        {/* Restaurant / pickup marker (green) */}
        <Marker coordinate={restaurantCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.pickupMarker}>
            <Icon name="silverware-fork-knife" size={16} color={Colors.white} />
          </View>
        </Marker>

        {/* Drop-off marker (black) */}
        <Marker coordinate={dropCoord} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.dropMarker}>
            <View style={styles.dropMarkerInner}>
              <Icon name="map-marker" size={28} color={Colors.black} />
            </View>
          </View>
        </Marker>

        {/* Rider marker (blue) */}
        <Marker coordinate={riderCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.riderDot}>
            <Icon name="navigation" size={18} color={Colors.white} />
          </View>
        </Marker>
      </MapView>

      {/* Bottom card */}
      <Animated.View style={[styles.bottomCard, { transform: [{ translateY: slideUpAnim }] }]}>
        {/* Timer progress bar */}
        <Animated.View style={[styles.timerBar, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />

        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.deliveryBadgeRow}>
            <View style={styles.deliveryBadge}>
              <Icon name="silverware-fork-knife" size={14} color={Colors.white} />
              <Text style={styles.deliveryBadgeText}>Delivery ({order.items?.length || 1})</Text>
            </View>
            <View style={styles.exclusiveBadge}>
              <Text style={styles.exclusiveText}>Exclusive</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleDecline} activeOpacity={0.7}>
            <Icon name="close" size={22} color={Colors.black} />
          </TouchableOpacity>
        </View>

        {/* Earnings amount — accurate */}
        <Text style={styles.earningsAmount}>{formatCurrency(driverPayout)}</Text>
        <Text style={styles.earningsSubtext}>
          Pickup: {formatDistance(pickupKm)} · Delivery: {formatDistance(deliveryKm)}
        </Text>

        {/* Time and distance */}
        <View style={styles.divider} />
        <View style={styles.timeDistanceRow}>
          <Icon name="clock-outline" size={18} color={Colors.black} />
          <Text style={styles.timeDistanceText}>
            {formatDuration(totalMin)} ({formatDistance(totalKm)}) total
          </Text>
        </View>

        {/* Route summary */}
        <View style={styles.routeSummary}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <Text style={styles.routeText} numberOfLines={2}>{order.restaurantName}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotBlack} />
            <Text style={styles.routeText} numberOfLines={2}>{order.deliveryAddress.fullAddress}</Text>
          </View>
        </View>

        {/* Accept button */}
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  map: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  // Markers
  pickupMarker: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.onlineGreen,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white,
  },
  dropMarker: { alignItems: 'center' },
  dropMarkerInner: { alignItems: 'center' },
  riderDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.riderPin,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white,
  },

  // Bottom Card
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl, elevation: 12,
    shadowColor: Colors.shadowColor, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 16, borderWidth: 2, borderColor: Colors.onlineGreen,
    borderBottomWidth: 0, overflow: 'hidden',
  },
  timerBar: {
    position: 'absolute', top: 0, left: 0, height: 4,
    backgroundColor: Colors.onlineGreen, borderTopLeftRadius: 20,
  },

  // Header
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  deliveryBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deliveryBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.onlineGreen,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4,
  },
  deliveryBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  exclusiveBadge: { borderWidth: 1, borderColor: Colors.onlineGreen, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  exclusiveText: { fontSize: 11, fontWeight: '600', color: Colors.onlineGreen },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },

  // Amount
  earningsAmount: { fontSize: 36, fontWeight: '800', color: Colors.black, marginTop: Spacing.xs },
  earningsSubtext: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },

  // Time/Distance
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  timeDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  timeDistanceText: { fontSize: 15, fontWeight: '600', color: Colors.black },

  // Route Summary
  routeSummary: { marginBottom: Spacing.lg, paddingLeft: Spacing.xs },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.onlineGreen, marginTop: 5 },
  routeDotBlack: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.black, marginTop: 5 },
  routeText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.black, lineHeight: 20 },
  routeLine: { width: 2, height: 24, backgroundColor: Colors.divider, marginLeft: 4 },

  // Accept Button
  acceptBtn: { backgroundColor: Colors.onlineGreen, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  acceptBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});

export default OrderRequestScreen;
