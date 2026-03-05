/** * Path: apps/mobile/app/_layout.tsx 
 * Description: Final Layout with Deep Link listener to catch Magic Links.
 */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { SessionProvider, useSession, supabase } from '@pallinky/core';
import { View, ActivityIndicator } from 'react-native';

function RootLayoutNav() {
  const { loading, userEmail } = useSession();

  useEffect(() => {
    // This catches the link if the app was already open in the background
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        // Force Supabase to check for the new session immediately
        supabase.auth.getSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8e9dc' }}>
        <ActivityIndicator size="large" color="#43691b" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* If no email, only show Auth. If email exists, show the Tabs (Hub) */}
      {!userEmail ? (
        <Stack.Screen name="auth/index" options={{ title: 'Login', gestureEnabled: false }} />
      ) : (
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      )}
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootLayoutNav />
    </SessionProvider>
  );
}