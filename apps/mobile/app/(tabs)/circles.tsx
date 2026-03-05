/** * Path: app/(tabs)/circles.tsx 
 * Description: Circles & Connections screen. Removed hidden card filtering logic. */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, TouchableOpacity, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StyledText } from '@tarti-flette/ui';
import { supabase } from '@tarti-flette/core';
import { differenceInDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import PlanCard from '../../../../packages/ui/src/PlanCard';

export default function CirclesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCircleId, setEditingCircleId] = useState<string | null>(null);
  const [newCircleName, setNewCircleName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [data, setData] = useState<any>({ predicted: [], recentEvents: [], myCircles: [] });

  const fetchCirclesData = useCallback(async () => {
    setLoading(true);
    try {
      const email = await SecureStore.getItemAsync('pallinky_user_email');
      const emailLower = email?.toLowerCase().trim() || '';
      setUserEmail(emailLower);

      const [predRes, eventRes, circleRes] = await Promise.all([
        supabase.from('predicted_circles').select('*').order('total_hangouts', { ascending: false }),
        supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(5),
        supabase.from('social_circles').select('*').order('created_at', { ascending: false })
      ]);

      setData({
        predicted: predRes.data || [],
        recentEvents: eventRes.data || [],
        myCircles: circleRes.data || []
      });
    } catch (error) {
      console.error("Circles load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCirclesData();
    }, [fetchCirclesData])
  );

  const openCreateModal = () => {
    setEditingCircleId(null);
    setNewCircleName('');
    setSelectedMembers([]);
    setModalVisible(true);
  };

  const openEditModal = (circle: any) => {
    setEditingCircleId(circle.id);
    setNewCircleName(circle.circle_name);
    setSelectedMembers(circle.members || []);
    setModalVisible(true);
  };

  const saveCircle = async () => {
    if (!newCircleName.trim()) return;

    if (editingCircleId) {
      await supabase.from('social_circles')
        .update({ circle_name: newCircleName, members: selectedMembers })
        .eq('id', editingCircleId);
    } else {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email_lc', userEmail).single();
      
      await supabase.from('social_circles').insert([
        { 
          circle_name: newCircleName, 
          members: selectedMembers, 
          user_id: profile?.id 
        }
      ]);
    }
    
    setModalVisible(false);
    fetchCirclesData();
  };

  const deleteCircle = async () => {
    if (!editingCircleId) return;
    await supabase.from('social_circles').delete().eq('id', editingCircleId);
    setModalVisible(false);
    fetchCirclesData();
  };

  const toggleMember = (name: string) => {
    setSelectedMembers(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const getFriendlyTime = (date: string) => {
    const days = differenceInDays(new Date(), new Date(date));
    if (days <= 30) return "Almost a month ago";
    if (days <= 60) return "Over a month ago";
    if (days <= 120) return "A few months ago";
    return "Over a few months ago";
  };

  if (loading && !data.predicted.length) return <View style={styles.centered}><ActivityIndicator color="#6A4C93" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <StyledText style={styles.headerTitle}>Circles</StyledText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <StyledText style={styles.sectionLabel}>My Circles</StyledText>
            <TouchableOpacity onPress={openCreateModal}>
              <Ionicons name="add-circle" size={28} color="#6A4C93" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {data.myCircles.length === 0 ? (
              <TouchableOpacity style={styles.emptyCard} onPress={openCreateModal}>
                <StyledText style={styles.emptyText}>+ Create your first circle</StyledText>
              </TouchableOpacity>
            ) : (
              data.myCircles.map((circle: any) => (
                <TouchableOpacity key={circle.id} style={styles.groupCard} onPress={() => openEditModal(circle)}>
                  <View style={styles.groupIcon}><StyledText style={styles.groupEmoji}>⭕</StyledText></View>
                  <StyledText style={styles.groupName}>{circle.circle_name}</StyledText>
                  <StyledText style={styles.groupCount}>{circle.members?.length || 0} members</StyledText>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>Top Friends</StyledText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {data.predicted.slice(0, 8).map((friend: any, i: number) => (
              <View key={i} style={styles.avatarWrapper}>
                <Image 
                  source={{ uri: friend.avatar_url || `https://ui-avatars.com/api/?name=${friend.name}&background=6A4C93&color=fff` }} 
                  style={styles.avatarImg} 
                />
                <StyledText style={styles.avatarName}>{friend.name.split(' ')[0]}</StyledText>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>Recent Events</StyledText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {data.recentEvents.map((ev: any) => (
              <View key={ev.id} style={styles.planCardWrapper}>
                <PlanCard 
                  id={ev.id}
                  currentUserEmail={userEmail}
                  hostEmail={ev.host_email}
                  title={ev.title} 
                  startsAt={ev.starts_at} 
                  location={ev.location} 
                  coverImageUrl={ev.cover_image_url} 
                  gifKey={ev.gif_key} 
                  hostName={ev.host_name} 
                  onPress={() => router.push(`/peek/${ev.id}`)} 
                  onRefresh={fetchCirclesData}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>Connections to rekindle</StyledText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {data.predicted.filter((p: any) => differenceInDays(new Date(), new Date(p.last_seen)) > 15).map((person: any, i: number) => (
              <View key={i} style={styles.catchUpCard}>
                  <StyledText style={styles.catchUpName}>{person.name}</StyledText>
                  <StyledText style={styles.daysText}>{getFriendlyTime(person.last_seen)}</StyledText>
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><StyledText style={styles.modalCancel}>Cancel</StyledText></TouchableOpacity>
              <StyledText style={styles.modalTitle}>{editingCircleId ? 'Edit Circle' : 'New Circle'}</StyledText>
              <TouchableOpacity onPress={saveCircle}><StyledText style={styles.modalDone}>{editingCircleId ? 'Update' : 'Create'}</StyledText></TouchableOpacity>
            </View>
            
            <TextInput style={styles.input} placeholder="Circle Name (e.g. Inner Circle)" value={newCircleName} onChangeText={setNewCircleName} placeholderTextColor="#999" />

            <StyledText style={styles.selectionLabel}>Add from Top Friends:</StyledText>
            <FlatList
              data={data.predicted}
              keyExtractor={(item) => item.name}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.memberItem, selectedMembers.includes(item.name) && styles.memberItemSelected]} 
                  onPress={() => toggleMember(item.name)}
                >
                  <StyledText style={[styles.memberName, selectedMembers.includes(item.name) && styles.memberNameSelected]}>{item.name}</StyledText>
                  {selectedMembers.includes(item.name) && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                </TouchableOpacity>
              )}
            />

            {editingCircleId && (
              <TouchableOpacity style={styles.deleteButton} onPress={deleteCircle}>
                <StyledText style={styles.deleteText}>Delete Circle</StyledText>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#6A4C93' },
  header: { padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  scrollContent: { backgroundColor: '#F8F9FB', borderTopLeftRadius: 30, borderTopRightRadius: 30, flexGrow: 1 },
  section: { marginTop: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  sectionLabel: { fontSize: 18, fontWeight: '900', color: '#1A1A1A', marginLeft: 20, marginBottom: 15 },
  horizontalScroll: { paddingLeft: 20 },
  groupCard: { backgroundColor: '#fff', padding: 15, borderRadius: 20, marginRight: 15, width: 130, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  emptyCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginRight: 20, width: 200, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#ccc' },
  emptyText: { color: '#666', fontWeight: '700' },
  groupIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0E6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  groupEmoji: { fontSize: 20 },
  groupName: { fontWeight: '800', fontSize: 14, textAlign: 'center' },
  groupCount: { fontSize: 11, color: '#6A4C93', marginTop: 2 },
  avatarWrapper: { alignItems: 'center', marginRight: 20 },
  avatarImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eee' },
  avatarName: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  planCardWrapper: { width: 280, marginRight: -10 },
  catchUpCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, alignItems: 'center', marginRight: 15, width: 150, borderWidth: 1, borderColor: '#eee' },
  catchUpName: { fontWeight: '800', fontSize: 15, textAlign: 'center' },
  daysText: { fontSize: 12, color: '#6A4C93', marginTop: 4, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, backgroundColor: '#fff', padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalCancel: { color: '#666', fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalDone: { color: '#6A4C93', fontSize: 16, fontWeight: '900' },
  input: { backgroundColor: '#F2F2F7', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 25 },
  selectionLabel: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 10 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  memberItemSelected: { backgroundColor: '#6A4C93', borderRadius: 12, borderBottomColor: 'transparent' },
  memberName: { fontSize: 16, color: '#1A1A1A' },
  memberNameSelected: { color: '#fff', fontWeight: '700' },
  deleteButton: { marginTop: 20, padding: 10, alignItems: 'center' },
  deleteText: { color: '#FF3B30', fontWeight: '700', fontSize: 16 }
});