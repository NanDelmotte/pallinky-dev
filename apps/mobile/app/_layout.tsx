/**
 * Path: apps/mobile/app/_layout.tsx
 * Version: v19.3 (Android Native Push Registration + Push Tap Routing)
 */

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase, SessionProvider } from '@pallinky/core';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Push: not a physical device');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push: permission denied');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Push: missing projectId');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    console.log('Push token:', token);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      console.log('Push: no user email');
      return;
    }

    const { error } = await supabase.rpc('save_push_token', {
      p_email: email,
      p_device_token: token,
      p_platform: Platform.OS,
    });

    if (error) {
      console.log('Push token save error:', error);
    } else {
      console.log('Push token saved');
    }
  } catch (err) {
    console.log('Push registration error:', err);
  }
}

function AppNavigator() {
  const router = useRouter();

  useEffect(() => {
    const openNotificationTarget = async (
      response: Notifications.NotificationResponse
    ) => {
      try {
        const data = response.notification.request.content.data as {
          event_id?: string;
          type?: string;
        };

        const eventId = data?.event_id;
        if (!eventId) return;

        const { data: eventRow, error } = await supabase
          .from('events')
          .select('slug')
          .eq('id', eventId)
          .maybeSingle();

        if (error) {
          console.log('Push route lookup error:', error);
          router.push('/(tabs)' as any);
          return;
        }

        if (!eventRow?.slug) {
          console.log('Push route lookup: no slug found');
          router.push('/(tabs)' as any);
          return;
        }

        router.push(`/event/${eventRow.slug}/details` as any);
      } catch (err) {
        console.log('Push route open error:', err);
        router.push('/(tabs)' as any);
      }
    };

    const linkingSubscription = Linking.addEventListener('url', async ({ url }) => {
  if (!url) return;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path || '';

    if (path.startsWith('event/')) {
      const parts = path.split('/').filter(Boolean);
      const slug = parts[1];

      if (slug) {
        router.push(`/event/${slug}/details` as any);
        return;
      }
    }

    if (
      url.startsWith('pallinky://auth-callback') ||
      url.includes('access_token=') ||
      url.includes('refresh_token=') ||
      url.includes('code=')
    ) {
      await supabase.auth.exchangeCodeForSession(url);
      await registerForPushNotifications();
    }
  } catch (err) {
    console.log('Deep link open error:', err);
  }
});
void Linking.getInitialURL().then(async (url) => {
  if (!url) return;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path || '';

    if (path.startsWith('event/')) {
      const parts = path.split('/').filter(Boolean);
      const slug = parts[1];

      if (slug) {
        router.push(`/event/${slug}/details` as any);
        return;
      }
    }

    if (
      url.startsWith('pallinky://auth-callback') ||
      url.includes('access_token=') ||
      url.includes('refresh_token=') ||
      url.includes('code=')
    ) {
      await supabase.auth.exchangeCodeForSession(url);
      await registerForPushNotifications();
    }
  } catch (err) {
    console.log('Initial deep link open error:', err);
  }
});
    const notificationSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void openNotificationTarget(response);
      });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void openNotificationTarget(response);
      }
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        session?.user?.email
      ) {
        void registerForPushNotifications();
      }
    });

    void registerForPushNotifications();

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="m" />
      <Stack.Screen
        name="auth"
        options={{
          presentation: 'card',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppNavigator />
    </SessionProvider>
  );
}