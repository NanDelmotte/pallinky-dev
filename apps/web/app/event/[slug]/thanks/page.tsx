/** * Path: apps/web/app/event/[slug]/thanks/page.tsx 
 * Description: Step 187 - Simplified thanks page without auth checks.
 */
import { createClient } from '../../../../lib/supabase/server';
import Link from 'next/link';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "submerged": { bg: "#e0f2fe", accent: "#0077b6", text: "#003049", isDark: false },
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; theme?: string }>;
};

export default async function ThanksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { status, theme: themeKey } = await searchParams;
  
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('*').eq('slug', slug).single();
  if (!event) return <div>Not found</div>;

  const theme = (themeKey && PALETTES[themeKey]) ? PALETTES[themeKey] : PALETTES.zen;
  const isFormal = !!event.starts_at;

  const vibeGif = 'https://media1.giphy.com/media/v1.Y2lkPTJkNzUyNDZlOG03eHk5bnh1NWJ4YjJxZXZwZjFjMTU3c3ZncHkxOWU2aGNhbndqaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/30lffTNIXXB4AE4gzy/200.gif';
  const formalGif = event.thanks_gif_url || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueGZ3bm5qZzR4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7abKhOpu0NwenH3O/giphy.gif';

  return (
    <main style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ width: '200px', height: '200px', borderRadius: '100px', border: `6px solid ${theme.accent}`, overflow: 'hidden', marginBottom: '32px' }}>
        <img src={!isFormal ? vibeGif : formalGif} alt="Success" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      
      <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '12px' }}>
        {status === 'yes' ? "You're on the list!" : status === 'interested' ? "You're Hooked!" : "Response recorded!"}
      </h1>

      <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '40px', maxWidth: '300px', lineHeight: '1.4' }}>
        Download the app to see who else is coming and chat with the group!
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
        <a 
          href="https://apps.apple.com/app/your-app-id"
          style={{ padding: '20px', borderRadius: '20px', backgroundColor: theme.accent, color: theme.bg, fontWeight: '800', fontSize: '18px', textDecoration: 'none' }}
        >
          Get the App
        </a>

        <Link href={`/event/${slug}`} style={{ marginTop: '12px', padding: '12px', color: theme.text, opacity: 0.6, fontSize: '15px', textDecoration: 'none', fontWeight: '600' }}>
          Back to Details
        </Link>
      </div>
    </main>
  );
}