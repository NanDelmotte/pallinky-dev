/** * Path: apps/web/app/api/rsvp/route.ts 
 * Description: Step 8 - RSVP API handler. 
 * Saves the guest's interest to the database using the server-side Supabase client.
 */
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { eventId, status } = await request.json();

    // Verify the user is authenticated (via Magic Link/Session)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Upsert the RSVP: If it exists, update it; otherwise, create it.
    const { data, error } = await supabase
      .from('rsvps')
      .upsert({
        event_id: eventId,
        user_id: user.id,
        status: status || 'interested',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('RSVP API Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}