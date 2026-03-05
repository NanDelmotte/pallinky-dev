/** * Path: apps/web/app/event/[slug]/page.tsx 
 * Description: Step 177 - Fixed Next.js 15 params type error by awaiting params promise.
 */
import { createClient } from '../../../lib/supabase/server';
import { notFound } from 'next/navigation';
import RSVPButton from './RSVPButton';

// Next.js 15: params is now a Promise
type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EventPage({ params }: Props) {
  // Await the params before using them
  const { slug } = await params;
  
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event) {
    notFound();
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {event.cover_image_url && (
          <img 
            src={event.cover_image_url} 
            alt="Cover" 
            style={{ width: '100%', borderRadius: '24px', marginBottom: '24px' }} 
          />
        )}
        
        <h1 style={{ fontSize: '34px', fontWeight: '900', marginBottom: '8px' }}>{event.title}</h1>
        <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '32px' }}>Hosted by {event.host_name}</p>

        {event.description && (
          <p style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>{event.description}</p>
        )}

        <RSVPButton event={event} />
      </div>
    </main>
  );
}