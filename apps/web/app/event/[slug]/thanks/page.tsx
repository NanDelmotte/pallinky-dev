/**
 * Path: apps/web/app/event/[slug]/thanks/page.tsx
 * Description: Web thanks page visually aligned with the current mobile thanks screen.
 */

import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
};

const FONT_MAP: Record<string, string> = {
  Sans: 'Arial, ui-sans-serif, system-ui, sans-serif',
  Serif: '"Times New Roman", ui-serif, Georgia, serif',
  Cursive: '"Snell Roundhand", "Apple Chancery", cursive',
  Gothic: '"Copperplate", Impact, sans-serif',
};

const IOS_BETA_URL = 'https://testflight.apple.com/join/u2pMz6wB';
const ANDROID_BETA_URL = 'https://pallinky.com/pallinky.apk';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; theme?: string }>;
};

function getStatusMessage(status?: string) {
  if (status === 'yes') return "You're on the list!";
  if (status === 'maybe') return "We've marked you as a maybe.";
  if (status === 'interested') return "You're Hooked!";
  if (status === 'no') return "Sorry you can't make it!";
  return 'Response recorded!';
}

function DownloadCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        width: '100%',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '20px',
          borderRadius: '24px',
          width: '100%',
          border: `1px solid ${SYSTEM.border}`,
          backgroundColor: SYSTEM.surface,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: SYSTEM.secondaryBg,
            color: SYSTEM.secondary,
            fontSize: '22px',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: SYSTEM.text,
              marginBottom: '2px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: SYSTEM.textMuted,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </a>
  );
}

export default async function ThanksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { status, theme: themeKey } = await searchParams;

  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('*').eq('slug', slug).single();

  if (!event) {
    return <div>Not found</div>;
  }

  const isHatchery = status === 'interested' || event.event_type === 'vibe';

  const resolvedThemeKey =
    isHatchery
      ? 'submerged'
      : (themeKey && PALETTES[themeKey] && themeKey) ||
        (event?.gif_key && PALETTES[event.gif_key] && event.gif_key) ||
        'zen';

  const theme = PALETTES[resolvedThemeKey];
  const pageFont = FONT_MAP[event?.font_family] || FONT_MAP.Sans;

  const vibeGif =
    'https://media1.giphy.com/media/v1.Y2lkPTJkNzUyNDZlOG03eHk5bnh1NWJ4YjJxZXZwZjFjMTU3c3ZncHkxOWU2aGNhbndqaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/30lffTNIXXB4AE4gzy/200.gif';
  const formalGif =
    event.thanks_gif_url ||
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTV1bmo3bXRrcGc1cmZtM3lzY2prdnV3aDcxazduOWUxY29uZDNteCZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/89x4osEodHEoo/giphy.gif';
  const finalGif = isHatchery ? vibeGif : formalGif;

  const canOpenChat = ['yes', 'maybe', 'interested'].includes(String(status || '').toLowerCase());

  return (
    <main
      style={{
        fontFamily: pageFont,
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          margin: '0 auto',
          padding: '40px 40px 60px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '220px',
            height: '220px',
            borderRadius: '110px',
            border: `6px solid ${theme.accent}`,
            overflow: 'hidden',
            marginBottom: '30px',
            backgroundColor: 'rgba(0,0,0,0.05)',
          }}
        >
          <img
            src={finalGif}
            alt="Success"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            textAlign: 'center',
            margin: '0 0 12px',
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
          }}
        >
          {getStatusMessage(status)}
        </h1>

        <p
          style={{
            fontSize: '18px',
            textAlign: 'center',
            margin: '0 0 30px',
            fontWeight: 500,
            color: theme.text,
            opacity: 0.7,
          }}
        >
          {event.host_name} has been notified.
        </p>

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '30px',
          }}
        >
          <DownloadCard
            href={IOS_BETA_URL}
            icon="🍎"
            title="Download on iPhone"
            subtitle="Join the Pallinky beta in TestFlight."
          />
          <DownloadCard
            href={ANDROID_BETA_URL}
            icon="🤖"
            title="Download on Android"
            subtitle="Install the latest Pallinky beta for Android."
          />
        </div>

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {canOpenChat ? (
            <Link
              href={`https://pallinky.com/event/${slug}`}
              style={{
                width: '100%',
                padding: '18px 20px',
                borderRadius: '20px',
                border: `2px solid ${theme.accent}`,
                backgroundColor: theme.accent,
                color: theme.bg,
                textDecoration: 'none',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              You need the App to Open the Chat
            </Link>
          ) : null}

          <Link
            href={`https://pallinky.com/event/${slug}`}
            style={{
              width: '100%',
              padding: '18px 20px',
              borderRadius: '20px',
              border: `2px solid ${theme.accent}`,
              backgroundColor: SYSTEM.surface,
              color: theme.accent,
              textDecoration: 'none',
              textAlign: 'center',
              fontSize: '16px',
              fontWeight: 800,
            }}
          >
            Back to RSVP
          </Link>

          <Link
            href="/"
            style={{
              marginTop: '25px',
              padding: '10px',
              color: theme.text,
              opacity: 0.6,
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'underline',
            }}
          >
            
          </Link>
        </div>
      </div>
    </main>
  );
}