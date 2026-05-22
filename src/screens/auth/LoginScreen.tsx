// Login Screen — Email/Password with black pill button
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
import { setRider, setError } from '../../store/slices/authSlice';
import type { Rider } from '../../types';

const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const userCred = await auth().signInWithEmailAndPassword(
        email.trim(),
        password,
      );
      const doc = await firestore()
        .collection('riders')
        .doc(userCred.user.uid)
        .get();
      if (doc.exists()) {
        dispatch(setRider(doc.data() as Rider));
      } else {
        setErrorMsg('No rider account found. Please sign up first.');
        await auth().signOut();
      }
    } catch (error: any) {
      const code = error.code;
      if (code === 'auth/user-not-found') {
        setErrorMsg('No account found with this email');
      } else if (code === 'auth/wrong-password') {
        setErrorMsg('Incorrect password');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Invalid email address');
      } else {
        setErrorMsg('Login failed. Please try again.');
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
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Welcome back, start delivering today
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={Colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.showHideBtn}
              onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.showHideText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.continueBtnText}>Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLinkText}>Sign up instead</Text>
          </TouchableOpacity>
        </View>
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
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
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
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    position: 'relative',
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
  passwordInput: {
    paddingRight: 70,
  },
  showHideBtn: {
    position: 'absolute',
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  showHideText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.goBlue,
  },
  errorText: {
    color: Colors.errorRed,
    fontSize: 13,
    marginTop: -4,
  },
  continueBtn: {
    backgroundColor: Colors.black,
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginTop: Spacing.sm,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  signupLinkText: {
    color: Colors.goBlue,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;
