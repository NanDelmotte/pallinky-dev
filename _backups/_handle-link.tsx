/** * Path: packages/core/src/app/handle-link.tsx 
 * Description: Share utility and landing bridge. Optimized for cross-platform link sharing.
 */

import { Share, Platform, Linking } from 'react-native';

/**
 * Opens the native share sheet or triggers a direct app link.
 * @param title - The name of the event/vibe.
 * @param fullUrl - The public https://pallinky.com/e/slug link.
 * @param customNote - Optional message from the host.
 */
export const shareEvent = async (title: string, fullUrl: string, customNote?: string) => {
  const message = customNote ? `${customNote}\n\n${fullUrl}` : `Join me for ${title}!\n\n${fullUrl}`;

  try {
    if (Platform.OS === 'android') {
      // Android combines message and URL into one string for best compatibility
      await Share.share({
        message: message,
      });
    } else {
      // iOS prefers the URL in its own field to generate a rich preview card
      await Share.share({
        message: customNote || `You've been invited to ${title}!`,
        url: fullUrl,
      });
    }
  } catch (error) {
    console.error('Share error:', error);
  }
};

/**
 * Specifically handles direct WhatsApp sharing to bypass standard share sheet.
 */
export const shareToWhatsApp = async (fullUrl: string) => {
  const url = `whatsapp://send?text=${encodeURIComponent(fullUrl)}`;
  const supported = await Linking.canOpenURL(url);
  
  if (supported) {
    await Linking.openURL(url);
  } else {
    // Fallback to standard share if WhatsApp isn't installed
    await shareEvent('the event', fullUrl);
  }
};