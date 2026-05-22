// HomeScreen — Main map screen with GO button, earnings pill, bottom panel
// With relocate button, proper GPS centering, always-visible driver marker
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, darkMapStyle } from '../../constants';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { useTheme } from '../../theme/ThemeContext';
import { setOnline, setIncomingOrder } from '../../store/slices/orderSlice';
import { updateLocation } from '../../store/slices/locationSlice';
import { updateRider } from '../../store/slices/authSlice';
import { formatCurrency } from '../../utils';
import type { Order } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_COLLAPSED = 120;
const BOTTOM_PANEL_EXPANDED = SCREEN_HEIGHT * 0.55;

const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, theme), [colors, theme]);
  const dispatch = useAppDispatch();
  const rider = useAppSelector(state => state.auth.rider);
  const isOnline = useAppSelector(state => state.order.isOnline);
  const activeOrder = useAppSelector(state => state.order.activeOrder);
  const todayEarnings = useAppSelector(state => state.order.todayEarnings);
  const location = useAppSelector(state => state.location);

  const mapRef = useRef<MapView>(null);
  const goButtonScale = useRef(new Animated.Value(1)).current;
  const goButtonOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const panelHeight = useRef(new Animated.Value(BOTTOM_PANEL_COLLAPSED)).current;
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const watchId = useRef<number | null>(null);
  const orderListenerRef = useRef<(() => void) | null>(null);

  // Guard: track which orderId we already navigated to — prevents double-navigation
  const lastHandledOrderId = useRef<string | null>(null);
  // Guard: are we currently navigating to OrderRequest?
  const isNavigatingRef = useRef(false);

  // ─── GPS: Get quick cached position first, then watch for accurate updates ───
  const getInitialLocation = useCallback(() => {
    // STEP 1: Get instant cached/low-accuracy position immediately so map shows GPS dot
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        dispatch(updateLocation({ latitude, longitude }));
        setLocationReady(true);
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
          800,
        );
      },
      _error => {
        // Low-accuracy failed, still mark as ready so app doesn't hang
        setLocationReady(true);
      },
      {
        enableHighAccuracy: false, // Use cell/wifi for instant result
        timeout: 5000,
        maximumAge: 60000, // Accept position up to 1 minute old
      },
    );

    // STEP 2: Also request a high-accuracy fix — updates when available
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        dispatch(updateLocation({ latitude, longitude }));
        setLocationReady(true);
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
          500,
        );
      },
      _error => {
        // Fine to ignore — low-accuracy already handled above
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      },
    );
  }, [dispatch]);

  // Request location permission on Android, then get location
  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            getInitialLocation();
          }
        } catch (err) {
          console.log('Permission error:', err);
          getInitialLocation();
        }
      } else {
        getInitialLocation();
      }
    };
    requestPermission();
  }, []);

  // Pulsing ring animation for GO button
  useEffect(() => {
    if (!isOnline) {
      const pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [isOnline]);

  // Throttle ref to avoid updating Firestore too often
  const lastFirestoreUpdate = useRef<number>(0);

  // ─── GPS tracking — watch position with NO distanceFilter so first fix fires instantly ───
  useEffect(() => {
    watchId.current = Geolocation.watchPosition(
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
        // Centre map if we don't have a location yet
        if (!locationReady) {
          setLocationReady(true);
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
            800,
          );
        }

        if (isOnline && rider) {
          // 1. Always update RTDB for real-time map tracking
          database()
            .ref(`liveLocations/${rider.uid}`)
            .set({
              lat: latitude,
              lng: longitude,
              heading: heading ?? 0,
              speed: speed ?? 0,
              updatedAt: Date.now(),
              isOnline: true,
              activeOrderId: null,
            })
            .catch(err => console.log('RTDB write error:', err));

          // 2. Also update Firestore riders doc every 15s
          const now = Date.now();
          if (now - lastFirestoreUpdate.current > 15000) {
            lastFirestoreUpdate.current = now;
            firestore()
              .collection('riders')
              .doc(rider.uid)
              .update({
                currentLat: latitude,
                currentLng: longitude,
                updatedAt: now,
              })
              .catch(err => console.log('Firestore location update error:', err));
          }
        }
      },
      error => console.log('Watch error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,   // Fire immediately on first fix — no distance gate
        interval: 3000,
        fastestInterval: 1000,
      },
    );
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
    };
  }, [isOnline, rider]);

  // ─── Listen for incoming orders when online ───
  useEffect(() => {
    if (isOnline && rider) {
      orderListenerRef.current = firestore()
        .collection('orders')
        .where('riderId', '==', rider.uid)
        .where('status', '==', 'RIDER_ASSIGNED')
        .onSnapshot(snapshot => {
          if (snapshot && !snapshot.empty) {
            const doc = snapshot.docs[0];
            const orderId = doc.id;

            // Guard 1: don't navigate if we already handled this specific order
            if (orderId === lastHandledOrderId.current) return;

            // Guard 2: don't navigate if driver already has an active order
            if (activeOrder !== null) return;

            // Guard 3: don't navigate if we're already navigating
            if (isNavigatingRef.current) return;

            const orderData = { orderId, ...doc.data() } as Order;
            lastHandledOrderId.current = orderId;
            isNavigatingRef.current = true;

            dispatch(setIncomingOrder(orderData));

            // Navigate to OrderRequestScreen to show the incoming order
            navigation.navigate('OrderRequest', { orderId });

            // Release navigation lock after a short delay
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 2000);
          }
        });

      return () => {
        if (orderListenerRef.current) {
          orderListenerRef.current();
        }
      };
    }
  }, [isOnline, rider, activeOrder]);

  // Relocate / re-center map on driver's location
  const handleRelocate = useCallback(() => {
    if (location.latitude !== 0 && location.longitude !== 0) {
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    } else {
      getInitialLocation();
    }
  }, [location, getInitialLocation]);

  // ─── Go Online: Check GPS is enabled before allowing ───
  const handleGoOnline = useCallback(async () => {
    if (!rider) return;

    // Check GPS is available by attempting a position fix
    const checkGPS = () =>
      new Promise<boolean>(resolve => {
        Geolocation.getCurrentPosition(
          () => resolve(true),
          error => {
            // Error code 2 = position unavailable (GPS off)
            // Error code 3 = timeout (GPS on but no signal yet — allow)
            if (error.code === 2) {
              resolve(false);
            } else {
              resolve(true);
            }
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 30000 },
        );
      });

    const gpsAvailable = await checkGPS();

    if (!gpsAvailable) {
      Alert.alert(
        'GPS Required',
        'Please enable GPS/Location Services to go online. Customers need your real-time location to track orders.',
        [
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      );
      return;
    }

    // GPS is available — proceed to go online
    Animated.parallel([
      Animated.timing(goButtonScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(goButtonOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    dispatch(setOnline(true));
    await firestore().collection('riders').doc(rider.uid).update({
      isOnline: true,
      updatedAt: Date.now(),
    });
    dispatch(updateRider({ isOnline: true }));

    // Reset the order ID guard when going online fresh
    lastHandledOrderId.current = null;
    isNavigatingRef.current = false;
  }, [rider]);

  const handleGoOffline = useCallback(async () => {
    if (!rider) return;
    dispatch(setOnline(false));
    // Animate GO button back in
    Animated.parallel([
      Animated.spring(goButtonScale, {
        toValue: 1,
        damping: 15,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(goButtonOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    // Reset pulse animation
    pulseAnim.setValue(1);
    pulseOpacity.setValue(0.4);

    // Update Firestore
    await firestore().collection('riders').doc(rider.uid).update({
      isOnline: false,
      updatedAt: Date.now(),
    });
    // Update RTDB
    await database().ref(`liveLocations/${rider.uid}`).update({
      isOnline: false,
    });
    dispatch(updateRider({ isOnline: false }));

    // Reset order guards
    lastHandledOrderId.current = null;
    isNavigatingRef.current = false;

    // Collapse panel
    togglePanel(false);
  }, [rider]);

  const togglePanel = (expand?: boolean) => {
    const target =
      expand !== undefined
        ? expand
          ? BOTTOM_PANEL_EXPANDED
          : BOTTOM_PANEL_COLLAPSED
        : isPanelExpanded
        ? BOTTOM_PANEL_COLLAPSED
        : BOTTOM_PANEL_EXPANDED;
    Animated.spring(panelHeight, {
      toValue: target,
      damping: 20,
      stiffness: 120,
      useNativeDriver: false,
    }).start();
    setIsPanelExpanded(
      expand !== undefined ? expand : !isPanelExpanded,
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          togglePanel(true);
        } else if (gestureState.dy > 50) {
          togglePanel(false);
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={theme === 'dark' ? darkMapStyle : undefined}
        initialRegion={{
          latitude: location.latitude || 18.5204,
          longitude: location.longitude || 73.8567,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard">
        {/* Rider location marker — always visible */}
        {location.latitude !== 0 && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderMarkerOuter}>
              <View
                style={[
                  styles.riderMarker,
                  {
                    transform: [{ rotate: `${location.heading || 0}deg` }],
                  },
                ]}>
                <Icon name="navigation" size={20} color={colors.white} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top Bar Overlay */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => navigation.openDrawer()}
          activeOpacity={0.7}>
          <Icon name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.earningsPill}>
          <Text style={styles.earningsText}>
            {formatCurrency(todayEarnings)}
          </Text>
        </View>

        <TouchableOpacity style={styles.topBarBtn} activeOpacity={0.7}>
          <Icon name="magnify" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* TODAY label below earnings pill */}
      {!isOnline && (
        <View style={styles.todayLabel}>
          <Text style={styles.todayText}>TODAY</Text>
        </View>
      )}

      {/* Relocate / My Location Button */}
      <TouchableOpacity
        style={styles.relocateBtn}
        onPress={handleRelocate}
        activeOpacity={0.7}>
        <Icon name="crosshairs-gps" size={22} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* GO Button (visible only when offline) */}
      {!isOnline && (
        <View style={styles.goButtonContainer}>
          {/* Pulsing ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              {
                transform: [{ scale: goButtonScale }],
                opacity: goButtonOpacity,
              },
            ]}>
            <TouchableOpacity
              style={styles.goButton}
              onPress={handleGoOnline}
              activeOpacity={0.85}>
              <Text style={styles.goButtonText}>GO</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Bottom Panel */}
      <Animated.View
        style={[styles.bottomPanel, { height: panelHeight }]}
        {...panResponder.panHandlers}>
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* Status Row */}
        <View style={styles.statusRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Preferences')}
            activeOpacity={0.6}>
            <Icon name="tune-variant" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text
            style={[
              styles.statusText,
              isOnline && styles.statusTextOnline,
            ]}>
            {isOnline ? "You're online" : "You're offline"}
          </Text>

          <TouchableOpacity activeOpacity={0.6}>
            <Icon
              name="format-list-bulleted"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Expanded Panel Content */}
        {isPanelExpanded && (
          <View style={styles.expandedContent}>
            {isOnline ? (
              /* Online expanded: GO OFFLINE button */
              <View style={styles.offlineSection}>
                <TouchableOpacity
                  style={styles.goOfflineButton}
                  onPress={handleGoOffline}
                  activeOpacity={0.85}>
                  <Icon name="hand-back-left" size={32} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.goOfflineLabel}>GO OFFLINE</Text>
              </View>
            ) : (
              /* Offline expanded: Recommendations */
              <View style={styles.offlineContent}>
                <View style={styles.divider} />
                <Text style={styles.recommendedTitle}>
                  Recommended for you
                </Text>
                <Text style={styles.laterTodayText}>Later Today</Text>

                <TouchableOpacity style={styles.recommendRow} activeOpacity={0.7}>
                  <View style={styles.recommendIcon}>
                    <Icon name="star" size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.recommendText}>
                    See upcoming promotions
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.recommendRow} activeOpacity={0.7}>
                  <View style={styles.recommendIcon}>
                    <Icon
                      name="steering"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={styles.recommendText}>See driving time</Text>
                </TouchableOpacity>

                <View style={styles.divider} />
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.waybillLink}>Waybill</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Waybill link when collapsed and offline */}
        {!isPanelExpanded && !isOnline && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.waybillLink}>Waybill</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
};

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  // Top Bar
  topBar: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 52,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  earningsPill: {
    backgroundColor: colors.earningsPillBg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  earningsText: {
    color: colors.earningsPillText,
    fontSize: 18,
    fontWeight: '700',
  },
  todayLabel: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 72 : 110,
    alignSelf: 'center',
  },
  todayText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Relocate button
  relocateBtn: {
    position: 'absolute',
    bottom: BOTTOM_PANEL_COLLAPSED + 20,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  // GO Button
  goButtonContainer: {
    position: 'absolute',
    bottom: BOTTOM_PANEL_COLLAPSED + 40,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.goBlue,
  },
  goButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.goBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.goBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  goButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },

  // Rider marker
  riderMarkerOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme === 'dark' ? 'rgba(75,139,255,0.15)' : 'rgba(39,110,241,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.riderPin,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Bottom Panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.xl,
    elevation: 10,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.offlineGray,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusTextOnline: {
    color: colors.onlineGreen,
  },

  // Expanded Content
  expandedContent: {
    flex: 1,
  },
  offlineContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: Spacing.md,
  },
  recommendedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  laterTodayText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  recommendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  recommendIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  waybillLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.goBlue,
    paddingVertical: Spacing.md,
  },

  // Go Offline
  offlineSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom: 40,
  },
  goOfflineButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.errorRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  goOfflineLabel: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: '700',
    color: colors.errorRed,
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
