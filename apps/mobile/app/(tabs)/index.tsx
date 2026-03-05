/** * Path: app/(tabs)/index.tsx 
 * Description: Home Page Orchestrator. Removed hidden card/deletion logic. */

import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@tarti-flette/core';
import { StyledText, DASHBOARD_THEMES } from '@tarti-flette/ui';

import MyPlansList from '../../components/dashboard/MyPlansList';
import PendingInvites from '../../components/dashboard/PendingInvites';
import FriendsActivities from '../../components/dashboard/FriendsActivities';
import PeopleYouMayKnow from '../../components/dashboard/PeopleYouMayKnow';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [themeKey, setThemeKey] = useState('classic');
  const [data, setData] = useState<any>({ 
    events: [], 
    rsvps: [], 
    socialCircles: [],
    userEmail: ''
  });

  const loadData = async () => {
    try {
      const email = await SecureStore.getItemAsync('pallinky_user_email');
      const theme = await SecureStore.getItemAsync('pallinky_theme');
      
      if (!email) return router.replace('/');
      if (theme) setThemeKey(theme);

      const emailLower = email.toLowerCase().trim();

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email_lc', emailLower)
        .single();

      const [evs, rsvs, circles] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('rsvps').select('*').eq('email_lc', emailLower),
        profile 
          ? supabase.from('social_circles').select('*').eq('user_id', profile.id)
          : Promise.resolve({ data: [] })
      ]);

      setData({ 
        events: evs.data || [], 
        rsvps: rsvs.data || [], 
        socialCircles: circles.data || [],
        userEmail: emailLower
      });
    } catch (error) {
      console.error("Data load failed", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const theme = DASHBOARD_THEMES[themeKey] || DASHBOARD_THEMES.classic;

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#43691b" /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <StyledText style={[styles.mainTitle, { color: theme.text }]}>My Social Hub</StyledText>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <MyPlansList data={data} theme={theme} onRefresh={loadData} />
        <PendingInvites data={data} theme={theme} />
        <FriendsActivities data={data} theme={theme} />
        <PeopleYouMayKnow data={data} theme={theme} />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  mainTitle: { fontSize: 26, fontWeight: '900' },
  olivePill: { backgroundColor: '#43691b', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }
});