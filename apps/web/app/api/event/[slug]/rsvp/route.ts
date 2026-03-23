// apps/web/app/api/event/[slug]/rsvp/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  status?: 'yes' | 'maybe' | 'no' | 'interested';
  selectedDates?: string[];
  note?: string;
};

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}
function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as Body;

    const cleanName = (body.name || '').trim();
const cleanEmail = normalizeEmail(body.email || '');
const cleanPhone = (body.phone || '').trim() || null;
const selectedDates = Array.isArray(body.selectedDates) ? body.selectedDates : [];
const note = (body.note || '').trim();
const allowedStatuses = new Set(['yes', 'maybe', 'no', 'interested']);
const status = allowedStatuses.has(body.status || '')
  ? body.status
  : 'interested';
    if (!cleanName) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }

   if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const isFormal = event.event_type === 'formal' || !!event.starts_at;

    if (!isFormal && Array.isArray(event.proposed_dates) && event.proposed_dates.length > 0 && selectedDates.length === 0) {
      return NextResponse.json({ error: 'Pick at least one date.' }, { status: 400 });
    }

    const { error: rsvpError } = await supabase.rpc('submit_rsvp_enriched', {
  p_event_id: event.id,
  p_name: cleanName,
  p_email: cleanEmail,
  p_status: status,
  p_phone_e164: cleanPhone,
  p_message: note || null,
});

if (rsvpError) {
  return NextResponse.json({ error: 'Failed to save RSVP.' }, { status: 500 });
}
    if (!isFormal) {
      const { error: vibeError } = await supabase.from('vibe_responses').upsert(
        {
          event_id: event.id,
          user_email: cleanEmail,
          guest_name: cleanName,
          selected_dates: selectedDates,
          note: note || null,
        },
        { onConflict: 'event_id,user_email' }
      );

      if (vibeError) {
        return NextResponse.json({ error: 'Failed to save vote.' }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      redirectTo: `/event/${event.slug}/thanks?status=${status}`,
    });
  } catch {
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}