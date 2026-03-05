/** * Path: apps/web/app/event/[slug]/RSVPButton.tsx 
 * Description: Step 186 - Removed all Magic Link/Auth logic for frictionless web RSVP.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "submerged": { bg: "#e0f2fe", accent: "#0077b6", text: "#003049", isDark: false },
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

const FONT_MAP: Record<string, string> = {
  'Sans': 'ui-sans-serif, system-ui, sans-serif',
  'Serif': 'ui-serif, Georgia, serif',
  'Cursive': '"Apple Chancery", cursive',
  'Gothic': 'Impact, sans-serif'
};

export default function RSVPButton({ event }: { event: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [allVotes, setAllVotes] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [note, setNote] = useState('');
  
  const isFormal = !!event.starts_at;
  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : (isFormal ? "zen" : "submerged");
  const theme = PALETTES[themeKey];
  const customFont = { fontFamily: FONT_MAP[event?.font_family] || FONT_MAP.Sans };

  useEffect(() => {
    async function fetchData() {
      if (isFormal) {
        const { data: guestData } = await supabase.rpc('get_guest_list', { p_slug: event.slug });
        if (guestData) setGuests(guestData);
      } else {
        const { data: voteData } = await supabase.from('vibe_responses').select('user_email, selected_dates, note').eq('event_id', event.id);
        if (voteData) setAllVotes(voteData);
      }
    }
    fetchData();
  }, [event.id, event.slug, isFormal, supabase]);

  const handleRSVP = async (statusOverride?: string) => {
    const finalStatus = statusOverride || 'interested';
    
    if (!email.includes('@')) return alert("Please enter a valid email.");
    if (!name.trim()) return alert("Please enter your name.");

    setLoading(true);
    try {
      // 1. Save the RSVP (Identity linked by email_lc)
      await supabase.from('rsvps').upsert({ 
        event_id: event.id, 
        email_lc: email.toLowerCase().trim(), 
        status: finalStatus, 
        name: name.trim() 
      }, { onConflict: 'event_id,email_lc' });

      // 2. Save Poll response
      if (!isFormal) {
        await supabase.from('vibe_responses').upsert({ 
          event_id: event.id, 
          user_email: email.toLowerCase().trim(), 
          guest_name: name.trim(), 
          selected_dates: selectedDates, 
          note: note.trim() 
        }, { onConflict: 'event_id,user_email' });
      }

      // 3. Move to thanks page immediately
      window.location.href = `/event/${event.slug}/thanks?status=${finalStatus}&theme=${themeKey}`;
    } catch (e: any) { 
      alert("Failed to save response. Please try again."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{ ...customFont, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input 
          placeholder="Your Name" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ width: '100%', padding: '16px', borderRadius: '14px', border: `1px solid ${theme.accent}30`, fontSize: '16px', outline: 'none' }} 
        />
        <input 
          placeholder="Email Address" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          style={{ width: '100%', padding: '16px', borderRadius: '14px', border: `1px solid ${theme.accent}30`, fontSize: '16px', outline: 'none' }} 
        />
      </div>

      {isFormal ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => handleRSVP('yes')} disabled={loading} style={{ height: '60px', backgroundColor: theme.accent, color: theme.bg, borderRadius: '16px', fontWeight: '800', fontSize: '19px', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Saving...' : "I'm Going"}
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => handleRSVP('maybe')} style={{ flex: 1, height: '55px', borderRadius: '16px', border: `1.5px solid ${theme.accent}`, color: theme.accent, backgroundColor: 'transparent', fontWeight: '700', cursor: 'pointer' }}>Maybe</button>
            <button onClick={() => handleRSVP('no')} style={{ flex: 1, height: '55px', borderRadius: '16px', border: `1.5px solid ${theme.accent}`, color: theme.accent, backgroundColor: 'transparent', fontWeight: '700', cursor: 'pointer' }}>No</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: theme.text, opacity: 0.6, letterSpacing: '1px', marginBottom: '12px' }}>Cast your votes:</p>
            {event.proposed_dates?.map((date: string) => {
              const isSelected = selectedDates.includes(date);
              const count = allVotes.filter(v => v.selected_dates?.includes(date)).length;
              return (
                <button key={date} onClick={() => setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px', borderRadius: '20px', marginBottom: '10px', border: `1.5px solid ${isSelected ? theme.accent : theme.accent + '30'}`, backgroundColor: isSelected ? theme.accent : 'transparent', color: isSelected ? theme.bg : theme.text, cursor: 'pointer' }}>
                  <span style={{ fontWeight: '700' }}>{new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {count > 0 && <div style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.accent + '15' }}>{count} votes</div>}
                </button>
              );
            })}
          </div>
          <textarea placeholder="Any thoughts?" value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', borderRadius: '20px', padding: '18px', height: '100px', fontSize: '16px', border: `1px solid ${theme.accent}30`, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', color: theme.text, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => handleRSVP('interested')} disabled={loading} style={{ padding: '22px', backgroundColor: theme.accent, color: theme.bg, borderRadius: '18px', fontWeight: '800', fontSize: '19px', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Processing...' : "I'm Interested"}
          </button>
        </div>
      )}
    </div>
  );
}