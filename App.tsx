// App.tsx — Root component with Redux Provider + PersistGate
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { store, persistor } from './src/store';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import MapLibreGL from '@maplibre/maplibre-react-native';

const App: React.FC = () => {
  useEffect(() => {
    // Must be called inside a component lifecycle (useEffect), NOT at module level.
    // On the New Architecture (Fabric/TurboModules), native modules aren't available
    // during bundle evaluation — calling setAccessToken at module scope causes
    // "Cannot read property 'setAccessToken' of undefined" crash on launch.
    MapLibreGL.setAccessToken(null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate
          loading={<View style={{ flex: 1 }}><ActivityIndicator style={{ flex: 1 }} /></View>}
          persistor={persistor}
        >
          <ThemeProvider>
            <SafeAreaProvider>
              <AppNavigator />
            </SafeAreaProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;
