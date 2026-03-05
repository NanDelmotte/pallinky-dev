/** * Path: apps/web/app/api/token-exchange/route.ts 
 * Description: Step 8 - Web-to-App token exchange. 
 * Generates a single-use token to allow seamless login when transitioning to the mobile app.
 */
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Verify the user has a valid web session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    /**
     * 2. Generate a refresh token for the mobile app.
     * The mobile app will use this to "take over" the session.
     */
    const refreshToken = session.refresh_token;

    return NextResponse.json({ 
      token: refreshToken,
      email: session.user.email 
    });
  } catch (err: any) {
    console.error('Token Exchange Error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}