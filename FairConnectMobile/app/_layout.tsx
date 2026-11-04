import { useFonts } from 'expo-font';
import { Stack, ThemeProvider, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { AuthProvider } from '../context/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// ── FairConnect light theme ─────────────────────────────────────────────────
const FairConnectTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#059669',        // emerald-600
    background: '#f9fafb',    // gray-50
    card: '#ffffff',
    text: '#111827',
    border: '#e5e7eb',
    notification: '#059669',
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <ThemeProvider value={FairConnectTheme}>
        <StatusBar style="dark" />
        <Stack>
          {/* Main tab navigator */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Auth screens */}
          <Stack.Screen
            name="(auth)/login"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="(auth)/register"
            options={{ title: 'Create Account', headerTintColor: '#059669' }}
          />
          <Stack.Screen
            name="(auth)/verify-otp"
            options={{ title: 'Verify Email', headerTintColor: '#059669' }}
          />

          {/* QR Scanner — full screen */}
          <Stack.Screen
            name="qr-scan"
            options={{
              title: 'Scan QR Certificate',
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />

          {/* Worker Verification screen as modal */}
          <Stack.Screen
            name="verification"
            options={{
              title: 'Certificate Verification',
              headerTintColor: '#059669',
              headerStyle: { backgroundColor: '#fff' },
            }}
          />

          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}

