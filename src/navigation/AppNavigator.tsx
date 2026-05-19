// AppNavigator — Root navigation with auth flow, drawer, and main stack
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAppSelector } from '../store/hooks';

// Auth screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Main screens
import HomeScreen from '../screens/main/HomeScreen';
import OrderRequestScreen from '../screens/main/OrderRequestScreen';
import ActiveOrderScreen from '../screens/main/ActiveOrderScreen';
import OrderDetailsScreen from '../screens/main/OrderDetailsScreen';
import PreferencesScreen from '../screens/main/PreferencesScreen';
import EarningsScreen from '../screens/main/EarningsScreen';

// Drawer
import DrawerContent from './DrawerContent';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Splash" component={SplashScreen} />
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Signup" component={SignupScreen} />
  </AuthStack.Navigator>
);

const MainStackNavigator = () => (
  <MainStack.Navigator screenOptions={{ headerShown: false }}>
    <MainStack.Screen name="Home" component={HomeScreen} />
    <MainStack.Screen name="Preferences" component={PreferencesScreen} />
    <MainStack.Screen name="OrderRequest" component={OrderRequestScreen} options={{ presentation: 'fullScreenModal' }} />
    <MainStack.Screen name="ActiveOrder" component={ActiveOrderScreen} />
    <MainStack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ presentation: 'modal' }} />
    <MainStack.Screen name="Earnings" component={EarningsScreen} />
  </MainStack.Navigator>
);

const DrawerNavigator = () => (
  <Drawer.Navigator
    drawerContent={(props) => <DrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerType: 'front',
      drawerStyle: { width: '80%' },
    }}>
    <Drawer.Screen name="MainHome" component={MainStackNavigator} />
  </Drawer.Navigator>
);

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAppSelector(s => s.auth);

  return (
    <NavigationContainer>
      {isAuthenticated ? <DrawerNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
