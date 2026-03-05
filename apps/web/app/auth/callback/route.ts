/** * Path: apps/web/app/auth/callback/route.ts 
 * Description: Step 166 - Adding cache-buster to redirect to ensure the RSVP page sees the new session.
 */
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? 'hatchery';
  const baseUrl = 'https://pallinky.com';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const targetPath = next === 'hatchery' ? '/ideas' : `/event/${next}`;
      // Adding ?v=date forces the browser to refresh the session state
      return NextResponse.redirect(`${baseUrl}${targetPath}?verified=true&v=${Date.now()}`);
    }
    
    console.error('Auth Error:', error.message);
  }

  return NextResponse.redirect(`${baseUrl}/auth/login?error=auth-failed`);
}