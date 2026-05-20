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
import database from '@react-native-firebase/database';
import { startOrderSoundWithTimeout, cancelSoundTimer } from '../../utils/soundManager';
import { useTheme } from '../../theme/ThemeContext';
import type { Order } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OrderRequestScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const incomingOrder = useAppSelector(state => state.order.incomingOrder);
  const location = useAppSelector(state => state.location);
  const rider = useAppSelector(state => state.auth.rider);
  const { colors, theme } = useTheme();
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
      console.log('[ACCEPT] Accepting order...', order.orderId);
      
      const currentOrder = await firestore().collection('orders').doc(order.orderId).get();
      const currentTimeline = currentOrder.data()?.statusTimeline || [];
      const newTimeline = [...currentTimeline, {
        status: 'PREPARING', timestamp: Date.now(), note: 'Rider accepted delivery',
      }];

      // Actually assign the rider here
      await firestore().collection('orders').doc(order.orderId).update({
        riderId: rider?.uid || null,
        riderName: rider?.name || null,
        riderPhone: rider?.phone || null,
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
    
    // Clear rider's active order ID so they can receive new orders
    if (rider?.uid) {
      try {
        await firestore().collection('riders').doc(rider.uid).update({
          activeOrderId: null,
          updatedAt: Date.now(),
        });
        await database().ref(`liveLocations/${rider.uid}`).update({
          activeOrderId: null,
        });
      } catch (e) {
        console.error('Error clearing activeOrderId:', e);
      }
    }

    if (!order) { navigation.goBack(); return; }

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

        {/* Route rendering: If we have real coordinates, use them! Otherwise fallback to straight line */}
        {order.routeCoordinates && order.routeCoordinates.length > 0 ? (
          <Polyline
            coordinates={order.routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : (
          <>
            <Polyline
              coordinates={[riderCoord, restaurantCoord]}
              strokeColor={colors.primary} strokeWidth={4}
              lineDashPattern={[10, 5]}
            />
            <Polyline
              coordinates={[restaurantCoord, dropCoord]}
              strokeColor={colors.primary} strokeWidth={4}
            />
          </>
        )}

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

      {/* Bottom Panel */}
      <Animated.View style={[styles.bottomPanel, { transform: [{ translateY: slideUpAnim }], backgroundColor: colors.background }]}>
        {/* Ring & Timer */}
        <View style={styles.topRow}>
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, { color: colors.textPrimary }]}>{timeRemaining}</Text>
          </View>
          <Text style={[styles.ringingText, { color: colors.textPrimary }]}>Incoming Request...</Text>
        </View>

        {/* Payout & Distance Info */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Est. Payout</Text>
            <Text style={[styles.metaValLarge, { color: colors.textPrimary }]}>{formatCurrency(driverPayout)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Total Dist.</Text>
            <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{totalKm.toFixed(1)} km</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Est. Time</Text>
            <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{totalMin} min</Text>
          </View>
        </View>

        {/* Route summary */}
        <View style={styles.routeSummary}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <Text style={[styles.routeText, { color: colors.textPrimary }]} numberOfLines={2}>{order.restaurantName}</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.divider }]} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotBlack} />
            <Text style={[styles.routeText, { color: colors.textPrimary }]} numberOfLines={2}>{order.deliveryAddress.fullAddress}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.declineBtn, { backgroundColor: colors.surface }]} onPress={handleDecline}>
            <Icon name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={handleAccept}>
            <Text style={[styles.acceptText, { color: colors.textInverse }]}>Accept Delivery</Text>
          </TouchableOpacity>
        </View>
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

  // Bottom Panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  timerContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  timerText: { fontSize: 18, fontWeight: '800' },
  ringingText: { fontSize: 18, fontWeight: '600' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metaCol: { alignItems: 'center', flex: 1 },
  metaLabel: { fontSize: 12, marginBottom: 4 },
  metaValLarge: { fontSize: 20, fontWeight: '800' },
  metaVal: { fontSize: 16, fontWeight: '700' },
  metaDivider: { width: 1, height: 32 },

  routeSummary: { marginBottom: 24, paddingLeft: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#06C167', marginTop: 5 },
  routeDotBlack: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#000', marginTop: 5 },
  routeText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  routeLine: { width: 2, height: 24, marginLeft: 4 },

  actionRow: { flexDirection: 'row', gap: 12 },
  declineBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  acceptBtn: { flex: 1, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  acceptText: { fontSize: 18, fontWeight: '700' },
});

export default OrderRequestScreen;
