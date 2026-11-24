import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';
import { auth } from '../firebase/firebase';
import { requestNotificationPermissions } from '../utils/notifications';
import { ThemeProvider, useTheme } from '../utils/theme';
import '../utils/webAlert';
import { AppErrorBoundary } from '../utils/errorTracking';
import { getPendingImport } from '../utils/gradeImport';

// Navigation theme in the app's own colors — the default is white, which flashed
// between pages in dark mode
function AppNavigationTheme({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.background, card: colors.card, border: colors.border, primary: colors.accent, text: colors.text } };
  return <NavigationThemeProvider value={theme}>{children}</NavigationThemeProvider>;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [onboarded, setOnboarded] = useState<boolean | undefined>(undefined);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    requestNotificationPermissions();
    // Grading feature was removed — wipe any Skyward credentials/sync state it left on the device
    AsyncStorage.multiRemove([
      'skywardUrl', 'skywardUsername', 'skywardPassword',
      'gradesLastSynced', 'gradesLastSyncedAt', 'gradesAutoSync',
    ]);
    AsyncStorage.getItem('hasSeenOnboarding').then((val) => {
      // Onboarding teaches swipe gestures and is sized for phones — skip it on web
      setOnboarded(Platform.OS === 'web' || val === 'true');
    });
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined || onboarded === undefined) return;

    const inLogin = segments[0] === 'login';
    const inOnboarding = segments[0] === 'onboarding';
    const inWelcome = segments[0] === 'welcome';
    // Pages anyone can open without signing in
    if (segments[0] === 'privacy' || segments[0] === 'terms') return;

    if (user) {
      // Logged in — grades waiting from the browser extension go to the import screen first
      if (getPendingImport() && segments[0] !== 'import-grades') router.replace('/import-grades');
      // Otherwise always go to tabs (unless already there)
      else if (inLogin || inOnboarding || inWelcome) router.replace('/(tabs)');
    } else if (Platform.OS === 'web') {
      // Website visitors who aren't signed in see the landing page first
      if (!inLogin && !inWelcome) router.replace('/welcome');
    } else if (!onboarded && !inOnboarding && !inLogin) {
      // First launch — show onboarding (but don't redirect if already on login,
      // which means onboarding just finished and navigated here)
      router.replace('/onboarding');
    } else if (onboarded && !inLogin) {
      // Returning user, not logged in — go to login
      router.replace('/login');
    }
  }, [user, onboarded, segments, router]);

  if (user === undefined || onboarded === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f8fc' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
    <ThemeProvider>
      <AppNavigationTheme>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="add-task" />
          <Stack.Screen name="add-bill" />
          <Stack.Screen name="add-homework" />
          <Stack.Screen name="add-reminder" />
          <Stack.Screen name="edit-task" />
          <Stack.Screen name="edit-bill" />
          <Stack.Screen name="edit-homework" />
          <Stack.Screen name="edit-reminder" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="grades" />
          <Stack.Screen name="class-detail" />
          <Stack.Screen name="import-grades" />
          <Stack.Screen name="welcome" />
        </Stack>
        <StatusBar style="auto" />
      </AppNavigationTheme>
    </ThemeProvider>
    </AppErrorBoundary>
  );
}
