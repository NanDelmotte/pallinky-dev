/** * Path: apps/mobile/app/_layout.tsx 
 * Description: Safety Layout. Removed automatic redirection loop to stabilize the UI.
 */
import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '@pallinky/core';
import { View, ActivityIndicator } from 'react-native';

function RootLayoutNav() {
  const { loading, userEmail } = useSession();

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