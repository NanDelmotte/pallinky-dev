import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient'; // Adjust path to your client

export default function HistoryInjector() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [names, setNames] = useState('');
  const [status, setStatus] = useState('');

  const injectHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Injecting...');

    const nameList = names.split(',').map(n => n.trim()).filter(n => n !== '');
    
    // 1. Create the Historical Event
    // We use a dummy host email (yours) and a past date
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert([{
        title: title,
        starts_at: date || new Date().toISOString(),
        host_email: 'nancy@pallinky.com', // Your primary email
        host_name: 'Nancy',
        keyword: title.toLowerCase().replace(/\s+/g, '-'),
        slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(Math.random() * 1000)}`,
        status: 'past',
        manage_handle: crypto.randomUUID(),
        manage_token_hash: 'historical-seed'
      }])
      .select()
      .single();

    if (eventError) {
      setStatus(`Error creating event: ${eventError.message}`);
      return;
    }

    // 2. Create RSVPs for everyone mentioned
    const rsvpData = nameList.map(name => ({
      event_id: event.id,
      name: name,
      status: 'yes',
      // We generate a "Ghost Email" and use the name as the code
      email: `${name.toLowerCase()}@ghost.pallinky.com`,
      guest_token: `CODE-${name.toUpperCase()}-${Math.floor(Math.random() * 999)}`
    }));

    const { error: rsvpError } = await supabase.from('rsvps').insert(rsvpData);

    if (rsvpError) {
      setStatus(`Error creating RSVPs: ${rsvpError.message}`);
    } else {
      setStatus(`Success! Logged "${title}" with ${nameList.length} friends.`);
      setTitle('');
      setNames('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: 'auto', fontFamily: 'system-ui' }}>
      <h2>History Injector</h2>
      <p style={{ fontSize: '0.9rem', color: '#666' }}>Seed your social graph with past events.</p>
      
      <form onSubmit={injectHistory} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="text" 
          placeholder="Event Title (e.g. Dinner at Nancy's)" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: '10px' }}
        />
        <textarea 
          placeholder="Names (comma separated: Jenni, Angela, Ed)" 
          value={names} 
          onChange={(e) => setNames(e.target.value)}
          required 
          style={{ padding: '10px', minHeight: '80px' }}
        />
        <button type="submit" style={{ padding: '12px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Inject into Database
        </button>
      </form>
      
      {status && <p style={{ marginTop: '20px', fontWeight: 'bold' }}>{status}</p>}
    </div>
  );
}