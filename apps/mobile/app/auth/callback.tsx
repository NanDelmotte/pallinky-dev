/** * Path: app/auth/callback.tsx 
 * Description: Step 122 - Updated to fetch session from web token-exchange API if URL tokens are missing.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';

export default function AuthCallback() {
  const router = useRouter();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ 
    access_token?: string; 
    refresh_token?: string; 
    next?: string 
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      let { access_token, refresh_token, next } = params;

      // LOGIC: If tokens are missing from URL, try the Token Exchange API
      if (!access_token || !refresh_token) {
        try {
          const response = await fetch('https://pallinky-prod.fly.dev/api/token-exchange');
          const data = await response.json();
          
          if (data.token) {
            refresh_token = data.token;
            // Note: with just a refresh token, setSession will still work
          }
        } catch (e) {
          console.error("Token Exchange API failed", e);
        }
      }

      if (refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: access_token || '', // Supabase handles empty access_token if refresh is valid
          refresh_token,
        });

        if (!error && data.session?.user?.email) {
          await signIn(data.session.user.email);
          
          let target = '/(tabs)/ideas';
          if (next && next !== 'hatchery') {
            target = `/event/${next}/fishingRSVP`;
          }
          router.replace(target as any);
        } else {
          Alert.alert("Session Error", "Could not verify your login.");
          router.replace('/auth');
        }
      } else {
        router.replace('/auth');
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0f2fe' }}>
      <ActivityIndicator size="large" color="#0077b6" />
    </View>
  );
}