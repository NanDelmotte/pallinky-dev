/** * Path: packages/core/src/auth.ts 
 * Description: Core Auth helpers for the "Invisible Identity" RSVP flow. Added getUserProfile and signOut. 
 */

import { supabase } from './supabase';

/**
 * Sends a magic link to the user's email for passwordless login.
 */
export const sendMagicLink = async (email: string, slug: string, isWeb: boolean = true) => {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // The callback route that will process the token and redirect to the event
    const baseUrl = isWeb ? 'https://pallinky.com' : 'pallinky://';
    const redirectTo = `${baseUrl}/auth/callback?next=/e/${slug}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('Auth Error (sendMagicLink):', err);
    throw err;
  }
};

/**
 * Gets the current session to check if the guest is already "Verified".
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth Error (getSession):', error);
      return null;
    }
    
    return session;
  } catch (err) {
    return null;
  }
};

/**
 * Fetches the user profile details for the currently logged-in user.
 */
export const getUserProfile = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;

    return data;
  } catch (err) {
    console.error('Auth Error (getUserProfile):', err);
    return null;
  }
};

/**
 * Signs the user out of the current session.
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Auth Error (signOut):', err);
    throw err;
  }
};