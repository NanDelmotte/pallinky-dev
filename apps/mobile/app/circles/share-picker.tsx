import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StyledText } from '@tarti-flette/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@tarti-flette/core';

interface Circle {
  id: string;
  circle_name: string;
  members: string[]; 
}

export default function CircleSharePicker() {
  const { message, slug } = useLocalSearchParams<{ message: string; slug: string }>();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetchCircles();
  }, []);

  const fetchCircles = async () => {
    try {
      const { data, error } = await supabase
        .from('social_circles')
        .select('id, circle_name, members');
      
      if (error) throw error;
      setCircles(data || []);
    } catch (e: any) {
      Alert.alert("Error", "Could not load your circles.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCircle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    if (selectedIds.length === 0) return;
    setSharing(true);
    
    try {
      // 1. Get all unique members from the selected circles
      const selectedCircles = circles.filter(c => selectedIds.includes(c.id));
      const allMembers = Array.from(new Set(selectedCircles.flatMap(c => c.members || [])));

      // 2. Update the event record with the guest list
      const { error } = await supabase
        .from('events')
        .update({ invited_members: allMembers }) // Matches your logic to use existing table
        .eq('slug', slug);

      if (error) throw error;

      Alert.alert("Success!", "Casted your line to the selected circles. 🌊");
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error("Share error:", e.message);
      Alert.alert("Error", "Failed to share with circles.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#1f2a1b" />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>Select Circles</StyledText>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color="#0077b6" />
      ) : (
        <FlatList
          data={circles}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.circleCard, selectedIds.includes(item.id) && styles.selectedCard]} 
              onPress={() => toggleCircle(item.id)}
            >
              <View style={styles.circleInfo}>
                <MaterialCommunityIcons 
                  name="account-group" 
                  size={24} 
                  color={selectedIds.includes(item.id) ? "#fff" : "#0077b6"} 
                />
                <View>
                  <StyledText style={[styles.circleName, selectedIds.includes(item.id) && {color: '#fff'}]}>
                    {item.circle_name}
                  </StyledText>
                  <StyledText style={[styles.memberCount, selectedIds.includes(item.id) && {color: '#e0f2fe'}]}>
                    {item.members?.length || 0} members
                  </StyledText>
                </View>
              </View>
              <Ionicons 
                name={selectedIds.includes(item.id) ? "checkbox" : "square-outline"} 
                size={24} 
                color={selectedIds.includes(item.id) ? "#fff" : "#ccc"} 
              />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.shareBtn, (selectedIds.length === 0 || sharing) && styles.disabledBtn]} 
          onPress={handleShare}
          disabled={selectedIds.length === 0 || sharing}
        >
          {sharing ? <ActivityIndicator color="#fff" /> : (
            <>
              <StyledText style={styles.shareBtnText}>
                Share with {selectedIds.length} Circle{selectedIds.length !== 1 ? 's' : ''}
              </StyledText>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f8e9dc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1f2a1b' },
  list: { padding: 20 },
  circleCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 18, 
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  selectedCard: { backgroundColor: '#0077b6', borderColor: '#005f91' },
  circleInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  circleName: { fontSize: 17, fontWeight: '800', color: '#1f2a1b' },
  memberCount: { fontSize: 13, color: '#666' },
  footer: { padding: 20, paddingBottom: 40, backgroundColor: '#fff' },
  shareBtn: { 
    backgroundColor: '#0077b6', 
    height: 56, 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10 
  },
  disabledBtn: { backgroundColor: '#ccc' },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});