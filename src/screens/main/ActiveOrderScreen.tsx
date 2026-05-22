// ActiveOrderScreen — Pickup & Delivery with slide buttons, cancel modal, order-not-ready
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Linking, TextInput, PanResponder, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, darkMapStyle } from '../../constants';
import { useTheme } from '../../theme/ThemeContext';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActiveOrder, clearOrder, addEarnings } from '../../store/slices/orderSlice';
import { formatCurrency, formatDistance, formatDuration, haversineKm, estimatedMinutes, formatCustomerName, shortOrderId } from '../../utils';
import type { Order } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_THRESHOLD = SCREEN_WIDTH * 0.6;

// Slide-to-confirm button component
const SlideButton: React.FC<{ label: string; color: string; onSlideComplete: () => void }> = ({ label, color, onSlideComplete }) => {
  const { colors } = useTheme();
  const slideX = useRef(new Animated.Value(0)).current;
  const maxSlide = SCREEN_WIDTH - 120;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      if (g.dx >= 0 && g.dx <= maxSlide) slideX.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SLIDE_THRESHOLD) {
        Animated.timing(slideX, { toValue: maxSlide, duration: 200, useNativeDriver: true }).start(() => onSlideComplete());
      } else {
        Animated.spring(slideX, { toValue: 0, damping: 15, stiffness: 150, useNativeDriver: true }).start();
      }
    },
  })).current;

  return (
    <View style={[slideStyles.track, { backgroundColor: color + '20' }]}>
      <Text style={[slideStyles.label, { color }]}>{label}</Text>
      <Animated.View style={[slideStyles.thumb, { backgroundColor: color, transform: [{ translateX: slideX }] }]} {...panResponder.panHandlers}>
        <Icon name="chevron-right" size={28} color={color === colors.white || color === '#FFFFFF' ? colors.black : colors.white} />
      </Animated.View>
    </View>
  );
};

const slideStyles = StyleSheet.create({
  track: { height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  label: { fontSize: 16, fontWeight: '700', position: 'absolute' },
  thumb: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', position: 'absolute', left: 2, top: 2 },
});

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
  const sheetHeight = useRef(new Animated.Value(160)).current;
  const isCancellingRef = useRef(false);
  const order = activeOrder;

  useEffect(() => {
    if (!order) return;
    const unsub = firestore().collection('orders').doc(order.orderId)
      .onSnapshot(doc => {
        if (doc.exists()) {
          const data = { orderId: doc.id, ...doc.data() } as Order;
          // Don't override Redux state if we're in the middle of cancelling
          if (isCancellingRef.current) return;
          dispatch(setActiveOrder(data));
          if (data.status === 'PICKED_UP' || data.status === 'ON_THE_WAY') setPhase('delivery');
          if (data.status === 'DELIVERED' || data.status === 'CANCELLED') {
            dispatch(clearOrder());
            navigation.replace('Home');
          }
        }
      });
    return () => unsub();
  }, [order?.orderId]);

  useEffect(() => {
    if (!order) return;
    const dest = phase === 'pickup'
      ? { latitude: order.restaurantLat || 0, longitude: order.restaurantLng || 0 }
      : { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng };
    const coords = [
      { latitude: location.latitude || 0, longitude: location.longitude || 0 },
      dest,
    ];
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 }, animated: true,
      });
    }, 500);
  }, [phase, order]);

  // Write live location to RTDB continuously
  useEffect(() => {
    if (!rider || !order || location.latitude === 0) return;
    database().ref(`liveLocations/${rider.uid}`).update({
      lat: location.latitude, lng: location.longitude,
      heading: location.heading || 0, speed: location.speed || 0,
      updatedAt: Date.now(), isOnline: true, activeOrderId: order.orderId,
    });
  }, [location.latitude, location.longitude, rider, order]);

  const toggleSheet = () => {
    const target = sheetExpanded ? 160 : 500;
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
  }, [order]);

  const handleCompleteDelivery = useCallback(async () => {
    if (!order) return;
    if (order.deliveryPin && pinInput !== order.deliveryPin) {
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
  }, [order, pinInput, rider]);

  const handleOrderNotReady = useCallback(async () => {
    if (!order) return;
    await firestore().collection('orders').doc(order.orderId).update({
      orderNotReady: true, updatedAt: Date.now(),
    });
  }, [order]);

  const handleCancelOrder = useCallback(async () => {
    if (!order || !cancelReason) return;
    // Set guard to prevent listener from overriding state during cancel
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
      // Navigate FIRST — clearOrder causes order=null which unmounts this component via `if (!order) return null`
      setShowConfirmCancel(false);
      setShowCancel(false);
      navigation.replace('Home');
      // Clear Redux state AFTER navigation has started (delay to avoid unmount race)
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={styles.addressBar}>
        <Icon name="map-marker" size={20} color={colors.background} />
        <Text style={styles.addressText} numberOfLines={2}>
          {phase === 'pickup' ? (order.restaurantAddress || order.restaurantName) : order.deliveryAddress.fullAddress}
        </Text>
      </View>

      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        customMapStyle={theme === 'dark' ? darkMapStyle : undefined}
        initialRegion={{ ...destCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation={false} showsMyLocationButton={false}>
        {/* Route polyline: during pickup show driver→restaurant, during delivery use OSRM route or straight line */}
        {phase === 'pickup' ? (
          <Polyline
            coordinates={[
              { latitude: location.latitude, longitude: location.longitude },
              destCoord,
            ]}
            strokeColor={colors.routeColor || '#000000'}
            strokeWidth={4}
          />
        ) : order.routeCoordinates && order.routeCoordinates.length > 0 ? (
          <Polyline coordinates={order.routeCoordinates} strokeColor={colors.routeColor || '#000000'} strokeWidth={4} />
        ) : (
          <Polyline coordinates={[{ latitude: location.latitude, longitude: location.longitude }, destCoord]} strokeColor={colors.routeColor || '#000000'} strokeWidth={4} />
        )}
        <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.destMarker, { backgroundColor: phase === 'pickup' ? colors.onlineGreen : colors.textPrimary }]}>
            <Icon name={phase === 'pickup' ? 'silverware-fork-knife' : 'map-marker'} size={16} color={phase === 'pickup' ? colors.white : colors.background} />
          </View>
        </Marker>
        {location.latitude !== 0 && (
          <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderMarker}><Icon name="navigation" size={18} color={colors.white} /></View>
          </Marker>
        )}
      </MapView>

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
              <View>
                <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                <View style={styles.addressRow}>
                  <Icon name="map-marker" size={18} color={colors.textSecondary} />
                  <Text style={styles.addressDetail}>{order.restaurantAddress || order.restaurantName}</Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.pickupCount}>{order.items.length} order for pick-up</Text>
                <View style={styles.customerRow}>
                  <View>
                    <Text style={styles.customerName}>{order.customerName || 'Customer'}</Text>
                    <Text style={styles.orderCode}>{shortOrderId(order.orderId)} · {order.items.length} items</Text>
                  </View>
                  <TouchableOpacity style={styles.detailsBtn} onPress={() => navigation.navigate('OrderDetails', { orderId: order.orderId })}>
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>
                {/* Order not ready button */}
                <TouchableOpacity style={styles.notReadyBtn} onPress={handleOrderNotReady} activeOpacity={0.7}>
                  <Icon name="clock-alert-outline" size={18} color={colors.warningOrange} />
                  <Text style={styles.notReadyText}>Order not ready</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.warningBtn} onPress={() => setShowCancel(true)}>
                    <Icon name="alert" size={24} color={colors.warningOrange} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <SlideButton label="Slide to start delivery" color={colors.onlineGreen} onSlideComplete={handleStartDelivery} />
                  </View>
                </View>
              </View>
            ) : (
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
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.warningBtn} onPress={() => setShowCancel(true)}>
                    <Icon name="alert" size={24} color={colors.warningOrange} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <SlideButton label="Slide to deliver" color={colors.textPrimary}
                      onSlideComplete={handleCompleteDelivery} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Cancel Modal — Full screen */}
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
                <TouchableOpacity key={reason} style={[styles.cancelOption, cancelReason === reason && styles.cancelOptionSelected]}
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

      {/* Confirm cancel bottom sheet */}
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
  addressBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingTop: (StatusBar.currentHeight || 44) + 8, paddingBottom: 12, paddingHorizontal: Spacing.lg, gap: Spacing.sm, zIndex: 10 },
  addressText: { flex: 1, color: colors.background, fontSize: 16, fontWeight: '700' },
  destMarker: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },
  riderMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.riderPin, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.white },
  navigateBtn: { position: 'absolute', bottom: 175, right: Spacing.lg, flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, alignItems: 'center', gap: 6, elevation: 6 },
  navigateBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: Spacing.xl, elevation: 10 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.offlineGray, alignSelf: 'center', marginTop: 8, marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  statusLabelText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sheetContent: { flex: 1, paddingBottom: 40 },
  restaurantName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: Spacing.md },
  addressDetail: { flex: 1, fontSize: 14, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: Spacing.md },
  pickupCount: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.md },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  orderCode: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  detailsBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  detailsBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  notReadyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme === 'dark' ? '#2A2100' : '#FFF8E1', borderRadius: 8, padding: 12, marginVertical: Spacing.md },
  notReadyText: { fontSize: 14, fontWeight: '600', color: colors.warningOrange },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: 20 },
  warningBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'center' },
  etaText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  customerNameLg: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginVertical: 8 },
  contactRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  contactBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  pinCard: { backgroundColor: colors.surface, borderRadius: 12, padding: Spacing.lg, marginBottom: Spacing.lg },
  pinOrderCode: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pinRestaurant: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  pinInput: { backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, textAlign: 'center', fontWeight: '700', letterSpacing: 4 },
  pinErrorText: { color: colors.errorRed, fontSize: 12, marginTop: 4, textAlign: 'center' },
  // Cancel overlay
  cancelOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  cancelSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, maxHeight: '85%', flex: 1 },
  cancelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  cancelTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cancelSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.md },
  cancelOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  cancelOptionSelected: { backgroundColor: colors.surface },
  cancelOptionText: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  confirmSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40 },
  confirmHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.offlineGray, alignSelf: 'center', marginBottom: 20 },
  confirmText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  confirmSubtext: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  yesCancelBtn: { backgroundColor: colors.errorRed, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  yesCancelText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  noGoBackBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  noGoBackText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
});

export default ActiveOrderScreen;
