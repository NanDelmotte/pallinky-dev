/** * Path: app/create/index.tsx 
 * Description: The 'Launchpad' selection screen. Purely for routing the user 
 * to either the 'Fishing' (Vibe) flow or the 'Real Plan' (Formal) flow. 
 * Updated: Changed router.back() to router.replace() for more reliable exit logic. */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LaunchpadScreen() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Safety fix: replace instead of back */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="close" size={30} color="#1f2a1b" />
        </TouchableOpacity>
        
        <StyledText style={styles.title}>What's the move?</StyledText>
        
        <TouchableOpacity 
          style={styles.choiceCard} 
          onPress={() => router.push('/create/vibe')}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#0077b6' }]}>
            <MaterialCommunityIcons name="waves" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <StyledText style={styles.choiceTitle}>Throw a Line</StyledText>
            <StyledText style={styles.choiceSub}>Fishing for interest. Suggest some dates & see who waves.</StyledText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.choiceCard} 
          onPress={() => router.push('/create/formal')}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#43691b' }]}>
            <Ionicons name="calendar" size={30} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <StyledText style={styles.choiceTitle}>Seal a Deal</StyledText>
            <StyledText style={styles.choiceSub}>Real plan. You have a specific date and time in mind.</StyledText>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f8e9dc' },
  container: { padding: 20, paddingTop: 80 },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#1f2a1b', marginBottom: 30 },
  choiceCard: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 24, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  choiceTitle: { fontSize: 22, fontWeight: '900', color: '#1f2a1b' },
  choiceSub: { fontSize: 15, color: '#666', marginTop: 4, lineHeight: 20 },
});