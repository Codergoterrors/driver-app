// OrderRequestScreen — Incoming order with map, route lines, accurate pricing
// ORIGINAL DESIGN restored with fixed accept/decline logic and manual theming
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Dimensions,
} from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, darkMapStyle } from '../../constants';

import { useTheme } from '../../theme/ThemeContext';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActiveOrder, setIncomingOrder } from '../../store/slices/orderSlice';
import { formatCurrency, formatDistance, formatDuration, haversineKm, estimatedMinutes } from '../../utils';
import { startOrderSoundWithTimeout, cancelSoundTimer } from '../../utils/soundManager';
import type { Order } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OrderRequestScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const dispatch = useAppDispatch();
  const incomingOrder = useAppSelector(state => state.order.incomingOrder);
  const location = useAppSelector(state => state.location);
  const rider = useAppSelector(state => state.auth.rider);
  const cameraRef = useRef<any>(null);


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

  // Fit camera to show all three points using MapLibre fitBounds
  useEffect(() => {
    if (order && location.latitude !== 0) {
      const coords = [
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: order.restaurantLat || location.latitude, longitude: order.restaurantLng || location.longitude },
        { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng },
      ];
      setTimeout(() => {
        const lats = coords.map(c => c.latitude);
        const lngs = coords.map(c => c.longitude);
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          [100, 60, 350, 60],
          500,
        );
      }, 500);
    }
  }, [order]);

  const handleAccept = useCallback(async () => {
    cancelSoundTimer();
    if (timerRef.current) clearInterval(timerRef.current);
    if (!order) return;

    try {
      console.log('[ACCEPT] Accepting order...', order.orderId);
      
      // Verify the order is still available (not already accepted by someone else or cancelled)
      const currentOrderSnap = await firestore().collection('orders').doc(order.orderId).get();
      const currentStatus = currentOrderSnap.data()?.status;
      // Order should be PLACED (new proposal flow) or RIDER_ASSIGNED (backward compat)
      if (currentStatus !== 'PLACED' && currentStatus !== 'RIDER_ASSIGNED') {
        console.warn('[ACCEPT] Order status changed, cannot accept:', currentStatus);
        dispatch(setIncomingOrder(null));
        navigation.goBack();
        return;
      }

      const currentTimeline = currentOrderSnap.data()?.statusTimeline || [];
      const newTimeline = [
        ...currentTimeline,
        { status: 'RIDER_ASSIGNED', timestamp: Date.now(), note: 'Rider accepted delivery' },
        { status: 'PREPARING', timestamp: Date.now(), note: 'Preparing order' },
      ];

      // Set actual riderId (promote from proposedRiderId), clear proposed fields,
      // and set status to PREPARING so Customer App updates
      await firestore().collection('orders').doc(order.orderId).update({
        riderId: rider?.uid || null,
        riderName: rider?.name || null,
        riderPhone: rider?.phone || null,
        proposedRiderId: null,
        proposedRiderName: null,
        proposedRiderPhone: null,
        status: 'PREPARING',
        acceptedAt: Date.now(),
        updatedAt: Date.now(),
        statusTimeline: newTimeline,
      });

      dispatch(setActiveOrder(order));
      dispatch(setIncomingOrder(null));
      navigation.replace('ActiveOrder', { orderId: order.orderId, phase: 'pickup' });
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  }, [order, rider, dispatch, navigation]);

  const handleDecline = useCallback(async () => {
    cancelSoundTimer();
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (!order) { navigation.goBack(); return; }

    try {
      // Clear proposed rider from order so it can be re-dispatched
      await firestore().collection('orders').doc(order.orderId).update({
        proposedRiderId: null,
        proposedRiderName: null,
        proposedRiderPhone: null,
        status: 'PLACED',
        declinedAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Clear rider's active order ID
      if (rider?.uid) {
        await firestore().collection('riders').doc(rider.uid).update({
          activeOrderId: null,
          updatedAt: Date.now(),
        });
        await database().ref(`liveLocations/${rider.uid}`).update({
          activeOrderId: null,
        });
      }
    } catch (e) {
      console.error('Error declining order:', e);
    }

    dispatch(setIncomingOrder(null));
    navigation.goBack();
  }, [order, rider, dispatch, navigation]);

  if (!order) return null;

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

  // Calculate distances and payout safely without 16000km bug
  const pickupKm = haversineKm(riderCoord.latitude, riderCoord.longitude, restaurantCoord.latitude, restaurantCoord.longitude);
  const deliveryKm = haversineKm(restaurantCoord.latitude, restaurantCoord.longitude, dropCoord.latitude, dropCoord.longitude);
  const totalKm = pickupKm + deliveryKm;
  const totalMin = estimatedMinutes(totalKm);

  // Pricing: pickup free first 2km then ₹7/km, delivery ₹15/km
  const pickupAmount = pickupKm > 2 ? (pickupKm - 2) * 7 : 0;
  const deliveryAmount = deliveryKm * 15;
  const driverPayout = order.driverPayout || Math.round((pickupAmount + deliveryAmount) * 100) / 100;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* OSM Map with route (MapLibre — free, no API key) */}
      <Map
        style={styles.map}
        styleURL={JSON.stringify({
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
        })}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        attributionEnabled={true}
        logoEnabled={false}>

        <Camera
          ref={cameraRef}
          zoomLevel={12}
          centerCoordinate={[restaurantCoord.longitude, restaurantCoord.latitude]}
          animationDuration={500}
        />

        {/* Route rendering */}
        {order.routeCoordinates && order.routeCoordinates.length > 0 ? (
          <GeoJSONSource
            id="route-source"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: order.routeCoordinates.map((c: any) => [c.longitude, c.latitude]),
              },
            }}>
            <Layer
              id="route-layer"
              type="line"
              paint={{ 'line-color': colors.routeColor || '#000000', 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : (
          <>
            {/* Driver → Pickup (dashed) */}
            <GeoJSONSource
              id="pickup-route"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [riderCoord.longitude, riderCoord.latitude],
                    [restaurantCoord.longitude, restaurantCoord.latitude],
                  ],
                },
              }}>
              <Layer
                id="pickup-route-layer"
                type="line"
                paint={{
                  'line-color': colors.routeColor || '#000000',
                  'line-width': 4,
                  'line-dasharray': [2, 1],
                }}
              />
            </GeoJSONSource>

            {/* Pickup → Drop (solid) */}
            <GeoJSONSource
              id="delivery-route"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [restaurantCoord.longitude, restaurantCoord.latitude],
                    [dropCoord.longitude, dropCoord.latitude],
                  ],
                },
              }}>
              <Layer
                id="delivery-route-layer"
                type="line"
                paint={{ 'line-color': colors.routeColor || '#000000', 'line-width': 4 }}
              />
            </GeoJSONSource>
          </>
        )}

        {/* Restaurant/pickup marker (green) */}
        <Marker
          id="restaurant-marker"
          coordinate={[restaurantCoord.longitude, restaurantCoord.latitude]}>
          <View style={styles.pickupMarker}>
            <Icon name="silverware-fork-knife" size={16} color={colors.white} />
          </View>
        </Marker>

        {/* Drop-off marker */}
        <Marker
          id="drop-marker"
          coordinate={[dropCoord.longitude, dropCoord.latitude]}>
          <View style={styles.dropMarker}>
            <Icon name="map-marker" size={28} color={colors.dropoffPin || colors.errorRed} />
          </View>
        </Marker>

        {/* Rider marker (blue) */}
        <Marker
          id="rider-marker"
          coordinate={[riderCoord.longitude, riderCoord.latitude]}>
          <View style={styles.riderDot}>
            <Icon name="navigation" size={18} color={colors.white} />
          </View>
        </Marker>
      </Map>

      {/* Bottom card — ORIGINAL DESIGN */}
      <Animated.View style={[styles.bottomCard, { transform: [{ translateY: slideUpAnim }] }]}>
        {/* Timer progress bar */}
        <Animated.View style={[styles.timerBar, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />

        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.deliveryBadgeRow}>
            <View style={styles.deliveryBadge}>
              <Icon name="silverware-fork-knife" size={14} color={colors.white} />
              <Text style={styles.deliveryBadgeText}>Delivery ({order.items?.length || 1})</Text>
            </View>
            <View style={styles.exclusiveBadge}>
              <Text style={styles.exclusiveText}>Exclusive</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleDecline} activeOpacity={0.7}>
            <Icon name="close" size={22} color={colors.textPrimary} />
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
          <Icon name="clock-outline" size={18} color={colors.textPrimary} />
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

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  // Markers
  pickupMarker: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.onlineGreen,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.white,
  },
  dropMarker: { alignItems: 'center' },
  dropMarkerInner: { alignItems: 'center' },
  riderDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.riderPin,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.white,
  },

  // Bottom Card — ORIGINAL DESIGN
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl, elevation: 12,
    shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 16, borderWidth: 2, borderColor: colors.onlineGreen,
    borderBottomWidth: 0, overflow: 'hidden',
  },
  timerBar: {
    position: 'absolute', top: 0, left: 0, height: 4,
    backgroundColor: colors.onlineGreen, borderTopLeftRadius: 20,
  },

  // Header
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  deliveryBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deliveryBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.onlineGreen,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4,
  },
  deliveryBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  exclusiveBadge: { borderWidth: 1, borderColor: colors.onlineGreen, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  exclusiveText: { fontSize: 11, fontWeight: '600', color: colors.onlineGreen },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },

  // Amount
  earningsAmount: { fontSize: 36, fontWeight: '800', color: colors.textPrimary, marginTop: Spacing.xs },
  earningsSubtext: { fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md },

  // Time/Distance
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: Spacing.md },
  timeDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  timeDistanceText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

  // Route Summary
  routeSummary: { marginBottom: Spacing.lg, paddingLeft: Spacing.xs },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onlineGreen, marginTop: 5 },
  routeDotBlack: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.textPrimary, marginTop: 5 },
  routeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  routeLine: { width: 2, height: 24, backgroundColor: colors.divider, marginLeft: 4 },

  // Accept Button
  acceptBtn: { backgroundColor: colors.onlineGreen, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  acceptBtnText: { color: colors.white, fontSize: 18, fontWeight: '700' },
});

export default OrderRequestScreen;
