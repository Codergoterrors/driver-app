// HomeScreen — Main map screen with GO button, earnings pill, bottom panel
// Replicates Uber Driver home screen exactly
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
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
// setAccessToken is now called once in App.tsx - do not call here (causes crash on New Architecture)


// Free OpenStreetMap tile style — no API key, no cost
const OSM_STYLE = JSON.stringify({
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
});

import Geolocation from '@react-native-community/geolocation';
import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing } from '../../constants';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setOnline, setIncomingOrder } from '../../store/slices/orderSlice';
import { updateLocation } from '../../store/slices/locationSlice';
import { updateRider } from '../../store/slices/authSlice';
import { formatCurrency } from '../../utils';
import type { Order } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_COLLAPSED = 120;
const BOTTOM_PANEL_EXPANDED = SCREEN_HEIGHT * 0.55;


const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const rider = useAppSelector(state => state.auth.rider);
  const isOnline = useAppSelector(state => state.order.isOnline);
  const todayEarnings = useAppSelector(state => state.order.todayEarnings);
  const location = useAppSelector(state => state.location);

  const cameraRef = useRef<any>(null);

  const goButtonScale = useRef(new Animated.Value(1)).current;
  const goButtonOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const panelHeight = useRef(new Animated.Value(BOTTOM_PANEL_COLLAPSED)).current;
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const watchId = useRef<number | null>(null);
  // Two listeners: one for new proposal flow (proposedRiderId), one for legacy flow (riderId)
  const proposedListenerRef = useRef<(() => void) | null>(null);
  const assignedListenerRef = useRef<(() => void) | null>(null);
  // Guard to prevent navigating twice for the same order
  const navigatedOrderRef = useRef<string | null>(null);

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

  // Request permissions and start GPS tracking
  useEffect(() => {
    let bgWatchId: number | null = null;

    const requestAndTrack = async () => {
      try {
        if (Platform.OS === 'android') {
          const fineGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'Driver App needs access to your location to receive orders and show your position on the map.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (fineGranted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Fine location denied');
            return;
          }
        }

        // Get current position first
        Geolocation.getCurrentPosition(
          position => {
            const { latitude, longitude } = position.coords;
            dispatch(updateLocation({ latitude, longitude }));
          },
          error => {
            console.log('getCurrentPosition error:', error.code, error.message);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
        );

        // Start watching position
        bgWatchId = Geolocation.watchPosition(
          position => {
            const { latitude, longitude, heading, speed } = position.coords;
            dispatch(updateLocation({
              latitude,
              longitude,
              heading: heading ?? 0,
              speed: speed ?? 0,
            }));
          },
          error => {
            console.log('watchPosition error:', error.code, error.message);
          },
          {
            enableHighAccuracy: true,
            distanceFilter: 15,
            interval: 5000,
            fastestInterval: 3000,
          },
        );
      } catch (err) {
        console.warn('Permission request error:', err);
      }
    };

    requestAndTrack();

    return () => {
      if (bgWatchId !== null) {
        Geolocation.clearWatch(bgWatchId);
      }
    };
  }, []);

  // Animate camera to user location once map is ready and we have a location
  useEffect(() => {
    if (mapReady && location.latitude !== 0 && cameraRef.current) {
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: 14,
          animationDuration: 500,
        });
      }, 300);
    }
  }, [mapReady]);

  // Relocate camera to driver's current GPS position
  const handleRelocate = useCallback(() => {
    if (!mapReady) return;
    if (location.latitude !== 0) {
      cameraRef.current?.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: 14,
        animationDuration: 500,
      });
    } else {
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          dispatch(updateLocation({ latitude, longitude }));
          if (mapReady) {
            cameraRef.current?.setCamera({
              centerCoordinate: [longitude, latitude],
              zoomLevel: 14,
              animationDuration: 500,
            });
          }
        },
        error => console.log('Relocate error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
  }, [location, mapReady]);

  // GPS tracking when online
  useEffect(() => {
    if (isOnline && rider) {
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
          // Write to Firebase RTDB
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
            });
        },
        error => console.log('Watch error:', error),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 3000,
          fastestInterval: 2000,
        },
      );
      return () => {
        if (watchId.current !== null) {
          Geolocation.clearWatch(watchId.current);
        }
      };
    }
  }, [isOnline, rider]);

  // Reset navigation guard every time HomeScreen is focused (e.g. after declining an order)
  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      navigatedOrderRef.current = null;
    });
    return unsubFocus;
  }, [navigation]);

  // Listen for incoming orders when online.
  // Uses TWO single-field queries (no composite Firestore index needed):
  //   • proposedListenerRef — new proposal flow: proposedRiderId set, status PLACED
  //   • assignedListenerRef — legacy direct-assign flow: riderId set, status RIDER_ASSIGNED
  useEffect(() => {
    if (!isOnline || !rider) return;

    // Reset navigation guard on each online session
    navigatedOrderRef.current = null;

    const navigateToOrder = (orderId: string, data: any) => {
      if (navigatedOrderRef.current === orderId) return; // already navigating
      navigatedOrderRef.current = orderId;
      const orderData = { orderId, ...data } as Order;
      dispatch(setIncomingOrder(orderData));
      navigation.navigate('OrderRequest', { orderId });
    };

    // Listener 1 — new proposal flow (proposedRiderId assigned, status PLACED)
    proposedListenerRef.current = firestore()
      .collection('orders')
      .where('proposedRiderId', '==', rider.uid)
      .onSnapshot(
        snapshot => {
          if (!snapshot || snapshot.empty) return;
          const doc = snapshot.docs.find(d => d.data().status === 'PLACED');
          if (doc) navigateToOrder(doc.id, doc.data());
        },
        error => console.error('[OrderListener/proposed]', error),
      );

    // Listener 2 — legacy direct-assign flow (riderId set, status RIDER_ASSIGNED)
    assignedListenerRef.current = firestore()
      .collection('orders')
      .where('riderId', '==', rider.uid)
      .onSnapshot(
        snapshot => {
          if (!snapshot || snapshot.empty) return;
          const doc = snapshot.docs.find(d => d.data().status === 'RIDER_ASSIGNED');
          if (doc) navigateToOrder(doc.id, doc.data());
        },
        error => console.error('[OrderListener/assigned]', error),
      );

    return () => {
      proposedListenerRef.current?.();
      assignedListenerRef.current?.();
    };
  }, [isOnline, rider]);

  const handleGoOnline = useCallback(async () => {
    if (!rider) return;
    // Animate GO button out
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
    // Update Firestore
    await firestore().collection('riders').doc(rider.uid).update({
      isOnline: true,
      updatedAt: Date.now(),
    });
    dispatch(updateRider({ isOnline: true }));
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

      {/* Full Screen OSM Map (MapLibre — free, no API key) */}
      <Map
        style={styles.map}
        styleURL={OSM_STYLE}
        onDidFinishLoadingMap={() => setMapReady(true)}
        attributionEnabled={true}
        logoEnabled={false}
        compassEnabled={false}>
        <Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={[
            location.longitude || 73.8567,
            location.latitude || 18.5204,
          ]}
          animationDuration={500}
        />
        {/* Rider location marker */}
        {location.latitude !== 0 && (
          <Marker
            id="rider-location"
            coordinate={[location.longitude, location.latitude]}>
            <View
              style={[
                styles.riderMarker,
                { transform: [{ rotate: `${location.heading}deg` }] },
              ]}>
              <Icon name="navigation" size={24} color={Colors.black} />
            </View>
          </Marker>
        )}
      </Map>

      {/* Top Bar Overlay */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => navigation.openDrawer()}
          activeOpacity={0.7}>
          <Icon name="menu" size={24} color={Colors.black} />
        </TouchableOpacity>

        <View style={styles.earningsPill}>
          <Text style={styles.earningsText}>
            {formatCurrency(todayEarnings)}
          </Text>
        </View>

        <TouchableOpacity style={styles.topBarBtn} activeOpacity={0.7}>
          <Icon name="magnify" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      {/* TODAY label below earnings pill */}
      {!isOnline && (
        <View style={styles.todayLabel}>
          <Text style={styles.todayText}>TODAY</Text>
        </View>
      )}

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

      {/* Relocate Button */}
      <TouchableOpacity
        style={styles.relocateBtn}
        onPress={handleRelocate}
        activeOpacity={0.85}>
        <Icon name="crosshairs-gps" size={22} color={Colors.black} />
      </TouchableOpacity>

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
            <Icon name="tune-variant" size={24} color={Colors.black} />
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
              color={Colors.black}
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
                  <Icon name="hand-back-left" size={32} color={Colors.white} />
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
                    <Icon name="star" size={24} color={Colors.textSecondary} />
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
                      color={Colors.textSecondary}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  earningsPill: {
    backgroundColor: Colors.earningsPillBg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  earningsText: {
    color: Colors.earningsPillText,
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
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
    backgroundColor: Colors.goBlue,
  },
  goButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.goBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.goBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  goButtonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
  },

  // Rider marker
  riderMarker: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Relocate button
  relocateBtn: {
    position: 'absolute',
    bottom: BOTTOM_PANEL_COLLAPSED + 16,
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.xl,
    elevation: 10,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.offlineGray,
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
    color: Colors.black,
  },
  statusTextOnline: {
    color: Colors.onlineGreen,
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
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },
  recommendedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  laterTodayText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.black,
  },
  waybillLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: Colors.goBlue,
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
    backgroundColor: Colors.errorRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.errorRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  goOfflineLabel: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.errorRed,
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
