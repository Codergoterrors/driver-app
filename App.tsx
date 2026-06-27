// App.tsx — Root component with Redux Provider + PersistGate
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { store, persistor } from './src/store';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { LocationManager } from '@maplibre/maplibre-react-native';

// Initialize MapLibre — no access token needed for open-source tile servers
LocationManager.start();

const App: React.FC = () => {

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
