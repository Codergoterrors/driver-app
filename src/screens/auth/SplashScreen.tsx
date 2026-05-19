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
        if (doc.exists) {
          dispatch(setRider(doc.data() as Rider));
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
