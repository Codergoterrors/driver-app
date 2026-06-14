// Splash Screen — White bg, logo fade-in, auth check
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Colors } from '../../constants';
import { useAppDispatch } from '../../store/hooks';
import { setRider, setLoading } from '../../store/slices/authSlice';
import { setActiveOrder, setOnline, clearOrder } from '../../store/slices/orderSlice';
import type { Rider } from '../../types';

const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();

    // Check auth after 2 seconds
    const timer = setTimeout(() => {
      checkAuth();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const checkAuth = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      try {
        const doc = await firestore()
          .collection('riders')
          .doc(currentUser.uid)
          .get();
        if (doc.exists()) {
          const riderData = doc.data() as Rider;

          // ─── Session Recovery ────────────────────────────────────────────────
          // If the driver had an active order when the app was killed / restarted,
          // we restore it into Redux BEFORE calling setRider. This means HomeScreen
          // will already see the activeOrder and online=true on its very first mount
          // and will redirect to ActiveOrderScreen automatically.
          //
          // IMPORTANT: Do NOT call navigation.replace('ActiveOrder') here.
          // This screen lives in AuthStack; ActiveOrder is in MainStack (DrawerNavigator).
          // Cross-stack navigation from Splash silently fails — HomeScreen handles it.
          if (riderData.activeOrderId) {
            try {
              const orderDoc = await firestore()
                .collection('orders')
                .doc(riderData.activeOrderId)
                .get();
              if (orderDoc.exists()) {
                const orderData = orderDoc.data();
                const activeStatuses = [
                  'PLACED', 'CONFIRMED', 'PREPARING',
                  'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY',
                ];
                if (orderData && activeStatuses.includes(orderData.status)) {
                  // Active order still running — pre-load it so HomeScreen redirects
                  dispatch(setActiveOrder({ orderId: orderDoc.id, ...orderData } as any));
                  dispatch(setOnline(true));
                } else {
                  // Order was completed / cancelled while app was closed — wipe stale cache
                  dispatch(clearOrder());
                  dispatch(setOnline(false));
                }
              } else {
                // Order document deleted — clear stale persisted state
                dispatch(clearOrder());
              }
            } catch (orderErr) {
              console.log('[SPLASH] Error fetching active order:', orderErr);
            }
          }
          // Calling setRider sets isAuthenticated=true → AppNavigator swaps
          // AuthNavigator for DrawerNavigator → HomeScreen mounts with full state.
          dispatch(setRider(riderData));
          // ── HomeScreen's session recovery effect takes it from here ──────────
          return;
        } else {
          dispatch(setLoading(false));
          navigation.replace('Login');
        }
      } catch (error) {
        dispatch(setLoading(false));
        navigation.replace('Login');
      }
    } else {
      dispatch(setLoading(false));
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>🚗</Text>
        </View>
        <Text style={styles.appName}>Eats Driver</Text>
        <Text style={styles.tagline}>Deliver with confidence</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 48,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});

export default SplashScreen;
