/** * Path: app/(tabs)/ideas.tsx 
 * Description: The Hatchery dashboard. Removed hidden/dismiss logic. */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Platform, RefreshControl, SafeAreaView, Modal, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@pallinky/core';
import * as SecureStore from 'expo-secure-store';
import PlanCard from '../../../../packages/ui/src/PlanCard';

export default function HatcheryScreen() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [insightModal, setInsightModal] = useState(false);

  const HATCHERY_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1493246318656-5bbd4afb293c?q=80&w=1000&auto=format&fit=crop";

  const fetchHatcheryData = useCallback(async () => {
    try {
      const email = await SecureStore.getItemAsync('pallinky_user_email');
      if (!email) return;
      const cleanEmail = email.toLowerCase().trim();
      setUserEmail(cleanEmail);

      const { data, error } = await supabase
        .from('events')
        .select(`*, responses:vibe_responses(*)`)
        .eq('event_type', 'vibe')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (e: any) {
      console.error("Hatchery load failed:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHatcheryData();
    }, [fetchHatcheryData])
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const myIdeas = ideas.filter(i => i.host_email?.toLowerCase() === userEmail);
  const friendIdeas = ideas.filter(i => i.host_email?.toLowerCase() !== userEmail);

  const renderInsights = () => {
    if (!selectedIdea) return null;
    const tallies: Record<string, number> = {};
    selectedIdea.proposed_dates?.forEach((d: string) => tallies[d] = 0);
    selectedIdea.responses?.forEach((r: any) => {
      r.selected_dates?.forEach((d: string) => { tallies[d] = (tallies[d] || 0) + 1; });
    });

    return (
      <Modal visible={insightModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Idea Insights</StyledText>
              <TouchableOpacity onPress={() => setInsightModal(false)}><Ionicons name="close-circle" size={32} color="#64748b" /></TouchableOpacity>
            </View>
            <ScrollView>
              {Object.entries(tallies).map(([date, count]) => (
                <View key={date} style={styles.tallyRow}>
                  <View style={styles.tallyInfo}>
                    <StyledText style={styles.tallyDate}>{formatDate(date)}</StyledText>
                    <TouchableOpacity 
                      style={styles.pickWinnerBtn} 
                      onPress={() => {
                        setInsightModal(false);
                        router.push({
                          pathname: "/create/formal",
                          params: { prefill_title: selectedIdea.title, prefill_date: date, from_vibe_id: selectedIdea.id }
                        });
                      }}
                    >
                      <StyledText style={styles.pickWinnerText}>Pick Winner</StyledText>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tallyBarContainer}>
                    <View style={[styles.tallyBar, { width: `${Math.max((count / (selectedIdea.responses?.length || 1)) * 100, 5)}%` }]} />
                    <StyledText style={styles.tallyCountText}>{count} votes</StyledText>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !ideas.length) return <View style={styles.centered}><ActivityIndicator color="#1e3a8a" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.blueHeader}>
        <View style={styles.headerTitleRow}>
            <StyledText style={styles.headerLabel}>THE HATCHERY</StyledText>
            <Ionicons name="fish-outline" size={20} color="rgba(255,255,255,0.6)" />
        </View>
        <StyledText style={styles.headerTitle}>Hatching ideas for plans.</StyledText>
      </View>

      <FlatList
        data={[...myIdeas, ...(friendIdeas.length > 0 ? [{ id: 'sep', isSep: true }] : []), ...friendIdeas]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHatcheryData} />}
        renderItem={({ item }) => {
          if (item.isSep) return (
            <View style={styles.friendSectionHeader}>
                <StyledText style={styles.separatorText}>Friend Ideas</StyledText>
                <View style={styles.headerLine} />
            </View>
          );
          
          const isHost = item.host_email?.toLowerCase() === userEmail;
          return (
            <View style={styles.cardWrapper}>
              <View style={styles.vibeCardEffect}>
                <PlanCard
                    id={item.id}
                    currentUserEmail={userEmail}
                    hostEmail={item.host_email}
                    title={item.title}
                    startsAt=""
                    location={item.location}
                    coverImageUrl={item.cover_image_url || HATCHERY_FALLBACK_IMAGE}
                    gifKey={item.gif_key}
                    fontFamily={item.font_family}
                    hostName={item.host_name}
                    badge={isHost ? "MY IDEA" : "HATCHING"}
                    actionLabel={isHost ? "Results" : "Vote on a date"}
                    onRefresh={fetchHatcheryData}
                    styleOverrides={{
                        buttonColor: '#fb8500', 
                        badgeColor: isHost ? '#1e3a8a' : '#fb8500'
                    }}
                    onPress={() => isHost ? (setSelectedIdea(item), setInsightModal(true)) : router.push(`/event/${item.slug}/fishingRSVP`)}
                />
              </View>
            </View>
          );
        }}
      />
      {renderInsights()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blueHeader: { backgroundColor: '#1e3a8a', padding: 25, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  listContent: { padding: 20 },
  cardWrapper: { position: 'relative', marginBottom: 25 },
  vibeCardEffect: {
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#fb8500',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    overflow: 'hidden',
    padding: 2,
  },
  friendSectionHeader: { marginTop: 30, marginBottom: 20 },
  separatorText: { fontSize: 22, fontWeight: '900', color: '#1e3a8a', marginBottom: 8 },
  headerLine: { height: 3, width: 40, backgroundColor: '#fb8500', borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1e3a8a' },
  tallyRow: { marginBottom: 20 },
  tallyInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tallyDate: { fontSize: 15, fontWeight: '700', color: '#1e3a8a' },
  pickWinnerBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pickWinnerText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  tallyBarContainer: { height: 24, backgroundColor: '#f1f5f9', borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  tallyBar: { height: '100%', backgroundColor: '#fb8500' },
  tallyCountText: { position: 'absolute', right: 10, fontSize: 11, fontWeight: '800', color: '#64748b' }
});