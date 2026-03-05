/** * Path: app/_layout.tsx 
 * Description: Main app controller. Uses SessionProvider to protect routes. 
 * Resolves the "bugging" issue by reacting instantly to identity changes.
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useSession, SessionProvider } from '@tarti-flette/core';
import { View, ActivityIndicator } from 'react-native';
import WelcomeModal from '../components/WelcomeModal';

function NavigationGuard() {
  const { userEmail, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    // Best Practice: The Navigation Guard
    if (!userEmail && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/auth');
    } else if (userEmail && inAuthGroup) {
      // Redirect to app if already authenticated
      router.replace('/(tabs)');
    }
  }, [userEmail, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8e9dc' }}>
        <ActivityIndicator size="large" color="#0077b6" />
      </View>
    );
  }

  return (
    <>
      <WelcomeModal />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="m/[token]/studio" options={{ headerShown: true, title: 'Studio' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <NavigationGuard />
    </SessionProvider>
  );
}