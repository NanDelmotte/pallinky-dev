/** * Path: app/circles/manage-members.tsx 
 * Description: Interface to tag profiles into social circles. 
 * Allows the user to easily add/remove friends from defined groups.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StyledText } from '@tarti-flette/ui';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@tarti-flette/core';

interface Profile {
  id: string;
  full_name: string;
  email_lc: string;
  avatar_url: string;
}

interface Circle {
  id: string;
  circle_name: string;
  members: string[]; // Array of email_lc
}

export default function ManageMembers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: profs } = await supabase.from('profiles').select('*').order('full_name');
      const { data: circs } = await supabase.from('social_circles').select('*').order('circle_name');
      
      setProfiles(profs || []);
      setCircles(circs || []);
      if (circs && circs.length > 0) setSelectedCircle(circs[0]);
    } catch (e) {
      Alert.alert("Error", "Could not load friends or circles.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberInCircle = async (email: string) => {
    if (!selectedCircle) return;

    const isMember = selectedCircle.members.includes(email);
    const newMembers = isMember 
      ? selectedCircle.members.filter(m => m !== email)
      : [...selectedCircle.members, email];

    // Optimistic Update
    const updatedCircle = { ...selectedCircle, members: newMembers };
    setSelectedCircle(updatedCircle);
    setCircles(prev => prev.map(c => c.id === selectedCircle.id ? updatedCircle : c));

    try {
      const { error } = await supabase
        .from('social_circles')
        .update({ members: newMembers })
        .eq('id', selectedCircle.id);
      
      if (error) throw error;
    } catch (e) {
      Alert.alert("Save Failed", "Could not update the circle.");
      loadData(); // Revert on error
    }
  };

  return (
    <View style={styles.container}>
      {/* Circle Selector Tabs */}
      <View style={styles.topBar}>
        <StyledText style={styles.sectionTitle}>Tap a circle to edit it:</StyledText>
        <FlatList
          horizontal
          data={circles}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.tab, selectedCircle?.id === item.id && styles.activeTab]}
              onPress={() => setSelectedCircle(item)}
            >
              <StyledText style={[styles.tabText, selectedCircle?.id === item.id && styles.activeTabText]}>
                {item.circle_name}
              </StyledText>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#0077b6" />
      ) : (
        <FlatList
          data={profiles}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMember = selectedCircle?.members.includes(item.email_lc);
            return (
              <TouchableOpacity 
                style={styles.friendRow} 
                onPress={() => toggleMemberInCircle(item.email_lc)}
              >
                <View style={styles.friendInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <StyledText style={styles.avatarLetter}>
                      {item.full_name?.charAt(0) || '?'}
                    </StyledText>
                  </View>
                  <View>
                    <StyledText style={styles.friendName}>{item.full_name}</StyledText>
                    <StyledText style={styles.friendEmail}>{item.email_lc}</StyledText>
                  </View>
                </View>
                
                <Ionicons 
                  name={isMember ? "checkmark-circle" : "add-circle-outline"} 
                  size={28} 
                  color={isMember ? "#2a9d8f" : "#ccc"} 
                />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <StyledText style={styles.backBtnText}>Done Organizing</StyledText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  topBar: { paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sectionTitle: { paddingHorizontal: 20, fontSize: 14, color: '#666', marginBottom: 10 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginHorizontal: 5 },
  activeTab: { backgroundColor: '#0077b6' },
  tabText: { fontWeight: '700', color: '#666' },
  activeTabText: { color: '#fff' },
  list: { padding: 20 },
  friendRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9'
  },
  friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e9ecef', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontWeight: 'bold', color: '#495057' },
  friendName: { fontSize: 16, fontWeight: '600' },
  friendEmail: { fontSize: 12, color: '#999' },
  backBtn: { margin: 20, backgroundColor: '#1f2a1b', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '800' }
});