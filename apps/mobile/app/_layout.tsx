/** * Path: apps/mobile/app/_layout.tsx 
 * Description: Main app controller. Fixed route name warnings by using 'auth' instead of 'auth/index'.
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useSession, SessionProvider } from '@pallinky/core';
import { View, ActivityIndicator } from 'react-native';

function NavigationGuard() {
  const { userEmail, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === '(auth)';

    if (!userEmail && !inAuthGroup) {
      router.replace('/auth');
    } else if (userEmail && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [userEmail, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0077b6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      <Stack.Screen name="m/[token]/studio" options={{ headerShown: true, title: 'Studio' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <NavigationGuard />
    </SessionProvider>
  );
}