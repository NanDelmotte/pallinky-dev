/**
 * Path: apps/mobile/components/dashboard/PeopleYouMayKnow.tsx
 * Description: Reconnect suggestions driven by feed signals when available.
 * Falls back to RSVP-derived suggestions if signals are not passed.
 * When there are no suggestions yet, renders a Reconnect fallback card instead of null.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';
import { useRouter } from 'expo-router';
import ReconnectFeedCard from '../../../../packages/ui/src/ReconnectFeedCard';

interface PeopleProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
    socialCircles: any[];
  };
  theme: any;
  onRefresh?: () => void;
  signals?: any[];
}

export default function PeopleYouMayKnow({
  data,
  theme,
  onRefresh,
  signals = [],
}: PeopleProps) {
  const router = useRouter();
  const { rsvps = [], userEmail = '', socialCircles = [] } = data;
  const emailLower = userEmail ? userEmail.toLowerCase().trim() : '';

  const [removedEmails, setRemovedEmails] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const myCircleEmails = new Set(
    socialCircles.flatMap((c) => (c.members || []).map((m: string) => m.toLowerCase()))
  );
  if (emailLower) myCircleEmails.add(emailLower);

  const uniqueSuggestions =
    signals.length > 0
      ? Array.from(
          new Map(
            signals
              .filter((s) => s.type === 'suggested_connection')
              .map((s) => s.payload)
              .filter(Boolean)
              .filter((person) => {
                const personEmail = (person.email_lc || person.email || '').toLowerCase();
                return personEmail && !removedEmails.includes(personEmail);
              })
              .map((item) => [item.email_lc || item.email, item])
          ).values()
        )
      : Array.from(
          new Map(
            rsvps
              .filter((r) => {
                const rEmail = (r.email_lc || r.email || '').toLowerCase();
                return (
                  rEmail &&
                  rEmail !== emailLower &&
                  !myCircleEmails.has(rEmail) &&
                  !removedEmails.includes(rEmail)
                );
              })
              .map((item) => [item.email_lc || item.email, item])
          ).values()
        );

  const filteredCircles = socialCircles.filter((c) =>
    (c.circle_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveLocally = (email: string) => {
    setRemovedEmails((prev) => [...prev, email.toLowerCase()]);
  };

  const addToExistingCircle = async (circle: any) => {
    if (!selectedPerson) return;
    const targetEmail = (selectedPerson.email_lc || selectedPerson.email).toLowerCase();
    setLoading(true);
    try {
      const updatedMembers = [...new Set([...(circle.members || []), targetEmail])];
      const { error } = await supabase
        .from('social_circles')
        .update({ members: updatedMembers })
        .eq('id', circle.id);

      if (error) throw error;
      handleRemoveLocally(targetEmail);
      closeModal();
      if (onRefresh) onRefresh();
    } catch {
      Alert.alert('Error', 'Could not update circle.');
    } finally {
      setLoading(false);
    }
  };

  const createAndAdd = async () => {
    if (!newCircleName.trim() || !selectedPerson || !emailLower) return;
    const targetEmail = (selectedPerson.email_lc || selectedPerson.email).toLowerCase();
    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email_lc', emailLower)
        .single();

      if (!profile) throw new Error('Profile not found.');

      const { error } = await supabase.from('social_circles').insert({
        circle_name: newCircleName,
        user_id: profile.id,
        members: [emailLower, targetEmail],
      });

      if (error) throw error;
      handleRemoveLocally(targetEmail);
      closeModal();
      if (onRefresh) onRefresh();
    } catch {
      Alert.alert('Error', 'Could not create circle.');
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

  if (uniqueSuggestions.length === 0) {
    return (
      <View style={styles.container}>
        <Pressable
          onPress={() => router.push('/circles' as any)}
          style={({ pressed }) => [
            styles.emptyCard,
            {
              borderColor: theme.border || '#e5e7eb',
              backgroundColor: theme.cardBg || '#ffffff',
            },
            pressed && { opacity: 0.92 },
          ]}
        >
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={20} color="#1f2a1b" />
          </View>

          <View style={{ flex: 1 }}>
            <StyledText style={styles.emptyTitle}>No reconnect signals yet</StyledText>
            <StyledText style={styles.emptySubtitle}>
              As you add people and build circles, reconnect suggestions will appear here.
            </StyledText>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollPadding}
      >
        {uniqueSuggestions.map((person, i) => {
          const email = (person.email_lc || person.email || '').toLowerCase();
          const subtitle =
            person.reason ||
            person.subtitle ||
            person.signal_reason ||
            "You haven’t seen each other in a while";

          return (
            <View key={`suggestion-${i}`} style={styles.cardWrapper}>
              <ReconnectFeedCard
                person={person}
                subtitle={subtitle}
                onPress={() => {
                  setSelectedPerson(person);
                  setModalVisible(true);
                }}
                onDismiss={() => handleRemoveLocally(email)}
              />
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Add to a Circle</StyledText>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color="#1f2a1b" />
              </TouchableOpacity>
            </View>

            <StyledText style={styles.subTitle}>
              Where does {selectedPerson?.name || selectedPerson?.full_name} fit in?
            </StyledText>

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
                <TouchableOpacity
                  key={circle.id}
                  style={styles.circleOption}
                  onPress={() => addToExistingCircle(circle)}
                >
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
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <StyledText style={styles.createBtnText}>Create & Add</StyledText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 10 },
  scrollPadding: { paddingHorizontal: 16 },
  cardWrapper: { width: 250, marginRight: 12 },

  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
    lineHeight: 17,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1f2a1b' },
  subTitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, padding: 10, fontSize: 14 },
  circlesList: { maxHeight: 200 },
  circleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  circleOptionText: { fontSize: 16, color: '#1f2a1b', fontWeight: '600' },
  newCircleSection: { marginTop: 20 },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  createBtn: {
    backgroundColor: '#43691b',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '800' },
});