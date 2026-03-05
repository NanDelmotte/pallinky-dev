/** * Path: components/dashboard/PeopleYouMayKnow.tsx 
 * Description: Suggests new people from RSVPs. Removed global hidden card logic. */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { StyledText } from '@tarti-flette/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@tarti-flette/core';

interface PeopleProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
    socialCircles: any[];
  };
  theme: any;
  onRefresh?: () => void;
}

export default function PeopleYouMayKnow({ data, theme, onRefresh }: PeopleProps) {
  const { rsvps = [], userEmail = "", socialCircles = [] } = data;
  const emailLower = userEmail ? userEmail.toLowerCase().trim() : "";
  
  const [removedEmails, setRemovedEmails] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const myCircleEmails = new Set(socialCircles.flatMap(c => (c.members || []).map((m: string) => m.toLowerCase())));
  if (emailLower) myCircleEmails.add(emailLower);

  const uniqueSuggestions = Array.from(
    new Map(
      rsvps.filter(r => {
        const rEmail = (r.email_lc || r.email || "").toLowerCase();
        return rEmail && rEmail !== emailLower && !myCircleEmails.has(rEmail) && !removedEmails.includes(rEmail);
      }).map(item => [item.email_lc || item.email, item])
    ).values()
  );

  const filteredCircles = socialCircles.filter(c => 
    (c.circle_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveLocally = (email: string) => {
    setRemovedEmails(prev => [...prev, email.toLowerCase()]);
  };

  const addToExistingCircle = async (circle: any) => {
    if (!selectedPerson) return;
    const targetEmail = (selectedPerson.email_lc || selectedPerson.email).toLowerCase();
    setLoading(true);
    try {
      const updatedMembers = [...new Set([...(circle.members || []), targetEmail])];
      const { error } = await supabase.from('social_circles').update({ members: updatedMembers }).eq('id', circle.id);
      if (error) throw error;
      handleRemoveLocally(targetEmail);
      closeModal();
      if (onRefresh) onRefresh();
    } catch (err) {
      Alert.alert("Error", "Could not update circle.");
    } finally {
      setLoading(false);
    }
  };

  const createAndAdd = async () => {
    if (!newCircleName.trim() || !selectedPerson || !emailLower) return;
    const targetEmail = (selectedPerson.email_lc || selectedPerson.email).toLowerCase();
    setLoading(true);

    try {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email_lc', emailLower).single();
      if (!profile) throw new Error("Profile not found.");

      const { error } = await supabase.from('social_circles').insert({
        circle_name: newCircleName,
        user_id: profile.id,
        members: [emailLower, targetEmail]
      });

      if (error) throw error;
      handleRemoveLocally(targetEmail);
      closeModal();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert("Error", "Could not create circle.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPerson(null);
    setNewCircleName('');
    setSearchQuery('');
  };

  if (uniqueSuggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <StyledText style={[styles.label, { color: theme.label }]}>People you may know</StyledText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        {uniqueSuggestions.map((person, i) => (
          <View key={`suggestion-${i}`} style={styles.personWrapper}>
            <TouchableOpacity 
              style={styles.dismissBtn} 
              onPress={() => handleRemoveLocally(person.email_lc || person.email)}
            >
              <Ionicons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.avatarAction}
              onPress={() => { setSelectedPerson(person); setModalVisible(true); }}
            >
              <View style={[styles.avatarCircle, { backgroundColor: theme.cardBg || '#fff', borderColor: theme.border || '#eee' }]}>
                <Text style={[styles.initials, { color: theme.accent }]}>
                  {(person.name || person.full_name || "?").substring(0, 1).toUpperCase()}
                </Text>
                <View style={styles.plusBadge}>
                  <Ionicons name="add" size={12} color="#fff" />
                </View>
              </View>
              <StyledText style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                {(person.name || person.full_name || "Guest").split(' ')[0]}
              </StyledText>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Add to a Circle</StyledText>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color="#1f2a1b" />
              </TouchableOpacity>
            </View>

            <StyledText style={styles.subTitle}>Where does {selectedPerson?.name || selectedPerson?.full_name} fit in?</StyledText>

            {socialCircles.length > 0 && (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={16} color="#999" style={{ marginLeft: 10 }} />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Search circles..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            )}
            
            <ScrollView style={styles.circlesList}>
              {filteredCircles.map((circle) => (
                <TouchableOpacity key={circle.id} style={styles.circleOption} onPress={() => addToExistingCircle(circle)}>
                  <StyledText style={styles.circleOptionText}>{circle.circle_name}</StyledText>
                  <Ionicons name="chevron-forward" size={18} color="#43691b" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.newCircleSection}>
              <TextInput 
                style={styles.input} 
                placeholder="Or create a new circle..." 
                value={newCircleName}
                onChangeText={setNewCircleName}
              />
              <TouchableOpacity 
                style={[styles.createBtn, (!newCircleName.trim() || loading) && { opacity: 0.5 }]} 
                onPress={createAndAdd}
                disabled={!newCircleName.trim() || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <StyledText style={styles.createBtnText}>Create & Add</StyledText>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '800', marginLeft: 16, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  scrollPadding: { paddingHorizontal: 16 },
  personWrapper: { marginRight: 15, width: 70, position: 'relative' },
  avatarAction: { alignItems: 'center' },
  dismissBtn: { position: 'absolute', top: -5, right: 0, zIndex: 10 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 6, position: 'relative' },
  plusBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#43691b', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  initials: { fontSize: 20, fontWeight: 'bold' },
  nameText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1f2a1b' },
  subTitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, marginBottom: 10 },
  searchInput: { flex: 1, padding: 10, fontSize: 14 },
  circlesList: { maxHeight: 200 },
  circleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  circleOptionText: { fontSize: 16, color: '#1f2a1b', fontWeight: '600' },
  newCircleSection: { marginTop: 20 },
  input: { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 10 },
  createBtn: { backgroundColor: '#43691b', padding: 15, borderRadius: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '800' }
});