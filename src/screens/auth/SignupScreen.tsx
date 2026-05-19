// Signup Screen — Full name, phone, email, password, vehicle details
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Colors, Spacing } from '../../constants';
import { useAppDispatch } from '../../store/hooks';
import { setRider } from '../../store/slices/authSlice';
import type { Rider } from '../../types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SignupScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<'bike' | 'bicycle'>('bike');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignup = async () => {
    if (
      !fullName.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setErrorMsg('Please fill in all required fields');
      return;
    }
    if (vehicleType === 'bike' && !vehiclePlate.trim()) {
      setErrorMsg('Please enter vehicle plate number');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const userCred = await auth().createUserWithEmailAndPassword(
        email.trim(),
        password,
      );

      const riderData: Rider = {
        uid: userCred.user.uid,
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        rating: 5.0,
        totalDeliveries: 0,
        totalEarnings: 0,
        isOnline: false,
        activeOrderId: null,
        currentLat: 0,
        currentLng: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await firestore()
        .collection('riders')
        .doc(userCred.user.uid)
        .set(riderData);

      dispatch(setRider(riderData));
    } catch (error: any) {
      const code = error.code;
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('Email is already registered');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password is too weak');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Invalid email address');
      } else {
        setErrorMsg('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.black} />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Join our delivery fleet and start earning
        </Text>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={Colors.textDisabled}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={Colors.textDisabled}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textDisabled}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={Colors.textDisabled}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {/* Vehicle Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          <Text style={styles.radioLabel}>Vehicle Type</Text>
          <View style={styles.radioRow}>
            <TouchableOpacity
              style={[
                styles.radioOption,
                vehicleType === 'bike' && styles.radioOptionSelected,
              ]}
              onPress={() => setVehicleType('bike')}
              activeOpacity={0.7}>
              <Icon
                name="motorbike"
                size={28}
                color={
                  vehicleType === 'bike' ? Colors.black : Colors.textDisabled
                }
              />
              <Text
                style={[
                  styles.radioText,
                  vehicleType === 'bike' && styles.radioTextSelected,
                ]}>
                Bike
              </Text>
              {vehicleType === 'bike' && (
                <Icon
                  name="check"
                  size={20}
                  color={Colors.black}
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                vehicleType === 'bicycle' && styles.radioOptionSelected,
              ]}
              onPress={() => setVehicleType('bicycle')}
              activeOpacity={0.7}>
              <Icon
                name="bicycle"
                size={28}
                color={
                  vehicleType === 'bicycle'
                    ? Colors.black
                    : Colors.textDisabled
                }
              />
              <Text
                style={[
                  styles.radioText,
                  vehicleType === 'bicycle' && styles.radioTextSelected,
                ]}>
                Bicycle
              </Text>
              {vehicleType === 'bicycle' && (
                <Icon
                  name="check"
                  size={20}
                  color={Colors.black}
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Vehicle Plate Number"
            placeholderTextColor={Colors.textDisabled}
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            placeholder="Vehicle Model (e.g. Honda Activa)"
            placeholderTextColor={Colors.textDisabled}
            value={vehicleModel}
            onChangeText={setVehicleModel}
          />
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.createBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxxxl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.black,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  radioRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  radioOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'relative',
  },
  radioOptionSelected: {
    borderColor: Colors.black,
    backgroundColor: Colors.surfaceElevated,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDisabled,
  },
  radioTextSelected: {
    color: Colors.black,
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  errorText: {
    color: Colors.errorRed,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  createBtn: {
    backgroundColor: Colors.black,
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default SignupScreen;
