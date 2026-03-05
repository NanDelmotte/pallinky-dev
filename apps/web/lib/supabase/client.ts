/** * Path: apps/web/lib/supabase/client.ts 
 * Description: Supabase browser client for client-side interactions. 
 */
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );