/** * Path: packages/core/src/supabase.ts 
 * Description: Universal Supabase client for shared core logic.
 */
import { createClient } from '@supabase/supabase-js';

// This handles both Next.js and Expo environment variable prefixes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);