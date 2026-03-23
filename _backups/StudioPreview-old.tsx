/** * Path: components/StudioPreview.tsx 
 * Description: Modular preview screens for the Design Studio. 
 * Fix: Connected Feed Card styles to the active theme/font so it updates in real-time. */
import React, { useState } from 'react';
import { View, StyleSheet, Image, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface PreviewProps {
  theme: { bg: string; accent: string; text: string; isDark: boolean };
  fontStyle: { fontFamily: string };
  event: any;
  coverImageUrl: string;
  thanksGifUrl: string;
}

export const StudioPreview = ({ theme, fontStyle, event, coverImageUrl, thanksGifUrl }: PreviewProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIndex(Math.round(x / (width - 40)));
  };

  const formattedDate = event?.starts_at 
    ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) 
    : 'Date TBD';

  return (
    <View>
      <ScrollView 
        horizontal 
        pagingEnabled 
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false} 
        style={styles.pager}
      >
        {/* SCREEN 1: FEED CARD - Now reacts to theme/font */}
        <View style={styles.slide}>
          <StyledText style={styles.slideLabel}>1. Feed Card</StyledText>
          <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.accent }]}>
            <Image source={{ uri: coverImageUrl || 'https://via.placeholder.com/150' }} style={styles.cardImg} />
            <View style={styles.cardBody}>
              <StyledText style={[styles.cardDate, { color: theme.accent }, fontStyle]}>{formattedDate}</StyledText>
              <StyledText style={[styles.cardTitle, { color: theme.text }, fontStyle]} numberOfLines={1}>{event?.title}</StyledText>
              {event?.location && (
                <StyledText style={[styles.cardLocation, { color: theme.text }]} numberOfLines={1}>📍 {event.location}</StyledText>
              )}
              <View style={styles.cardFooter}>
                <StyledText style={[styles.hostText, { color: theme.text }]}>By {event?.host_name || 'Host'}</StyledText>
              </View>
            </View>
          </View>
        </View>

        {/* SCREEN 2: RSVP PAGE */}
        <View style={styles.slide}>
          <StyledText style={styles.slideLabel}>2. RSVP Page</StyledText>
          <View style={[styles.rsvpPreview, { backgroundColor: theme.bg }]}>
            <Image source={{ uri: coverImageUrl || 'https://via.placeholder.com/150' }} style={styles.rsvpImg} />
            <View style={styles.rsvpContent}>
              <StyledText style={[styles.rsvpTitle, { color: theme.text }, fontStyle]}>{event?.title}</StyledText>
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={12} color={theme.accent} />
                <StyledText style={[styles.infoText, { color: theme.text }]}>{formattedDate} @ {event?.time || 'Time'}</StyledText>
              </View>
              <StyledText style={[styles.description, { color: theme.text }]} numberOfLines={3}>
                {event?.description || "No description provided."}
              </StyledText>
              <View style={styles.btnRow}>
                <View style={[styles.mockBtn, { backgroundColor: theme.accent }]}><StyledText style={{color: theme.isDark ? theme.bg : '#fff', fontWeight:'800', fontSize:10}}>GOING</StyledText></View>
                <View style={[styles.mockBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent }]}><StyledText style={{color: theme.accent, fontWeight:'800', fontSize:10}}>MAYBE</StyledText></View>
              </View>
            </View>
          </View>
        </View>

        {/* SCREEN 3: SUCCESS SCREEN */}
        <View style={styles.slide}>
          <StyledText style={styles.slideLabel}>3. Success Screen</StyledText>
          <View style={[styles.thanks, { backgroundColor: theme.bg }]}>
            <Image source={{ uri: thanksGifUrl }} style={styles.gif} />
            <StyledText style={[styles.thanksTitle, { color: theme.text }, fontStyle]}>See you there!</StyledText>
          </View>
        </View>
      </ScrollView>

      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: activeIndex === i ? theme.accent : '#ddd' }]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pager: { height: 350 },
  slide: { width: width - 40, marginHorizontal: 20 },
  slideLabel: { fontSize: 9, fontWeight: '900', color: '#ccc', marginBottom: 8, textTransform: 'uppercase' },
  card: { height: 130, borderRadius: 20, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardImg: { width: 110, height: '100%' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardDate: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardLocation: { fontSize: 12, marginTop: 2 },
  cardFooter: { marginTop: 4 },
  hostText: { fontSize: 11, fontStyle: 'italic', opacity: 0.7 },
  rsvpPreview: { height: 280, borderRadius: 24, overflow: 'hidden' },
  rsvpImg: { width: '100%', height: '40%' },
  rsvpContent: { padding: 15 },
  rsvpTitle: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoText: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
  description: { fontSize: 12, lineHeight: 16, marginBottom: 12, opacity: 0.9 },
  btnRow: { flexDirection: 'row', gap: 8 },
  mockBtn: { flex: 1, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  thanks: { height: 280, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  gif: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  thanksTitle: { fontSize: 22, fontWeight: '900' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 }
});