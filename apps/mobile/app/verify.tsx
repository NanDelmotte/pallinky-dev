/** * Path: app/verify.tsx 
 * Description: Magic Link destination. Captures email, saves to SecureStore, 
 * ensures a database Profile exists, and redirects. */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

export default function VerifyIdentity() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  useEffect(() => {
    async function completeVerification() {
      if (!email) {
        router.replace('/(tabs)');
        return;
      }

      try {
        const cleanEmail = decodeURIComponent(email).toLowerCase().trim();

        // 1. Ensure Profile exists (Triggers 'My Beasties' circle creation via SQL)
        const { error } = await supabase
          .from('profiles')
          .upsert({ 
            email_lc: cleanEmail,
            updated_at: new Date() 
          }, { onConflict: 'email_lc' });

        if (error) throw error;

        // 2. Save Identity locally
        await SecureStore.setItemAsync('pallinky_user_email', cleanEmail);

        // 3. Success Redirect
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);

      } catch (err) {
        console.error(err);
        Alert.alert("Verification Failed", "We couldn't verify your identity. Please try again.");
        router.replace('/');
      }
    }

    completeVerification();
  }, [email]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#43691b" />
      <StyledText style={styles.text}>Recognizing you...</StyledText>
      <StyledText style={styles.subtext}>Unlocking your Beasties map</StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8e9dc' },
  text: { marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#1f2a1b' },
  subtext: { marginTop: 8, fontSize: 14, color: '#43691b', opacity: 0.8 }
});