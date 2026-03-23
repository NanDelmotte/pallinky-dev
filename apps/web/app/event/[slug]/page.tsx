/**
 * Path: apps/web/app/event/[slug]/page.tsx
 * Description: Public event page aligned to the current mobile RSVP surfaces.
 */

import { createClient } from '../../../lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import RSVPButton from './RSVPButton';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
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

type Props = {
  params: Promise<{ slug: string }>;
};

function formatEventDate(isoString?: string | null) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from('events').select('*').eq('slug', slug).single();

  if (!event) notFound();

  const isFormal = event.event_type === 'formal' || !!event.starts_at;
  const themeKey =
    event?.gif_key && PALETTES[event.gif_key]
      ? event.gif_key
      : isFormal
        ? 'zen'
        : 'submerged';

  const theme = PALETTES[themeKey];
  const pageFont = FONT_MAP[event?.font_family] || FONT_MAP.Sans;

  const hasLocationInDesc = event?.description?.includes('Location: ');
  const displayDescription = hasLocationInDesc
    ? event.description.split('Location: ')[0].trim()
    : event?.description;
  const locationText = hasLocationInDesc
    ? event.description.split('Location: ')[1].trim()
    : event?.location;

  return (
    <main
      style={{
        fontFamily: pageFont,
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
      }}
    >
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '20px 20px 56px',
        }}
      >
        <div
          style={{
            paddingTop: '10px',
            paddingBottom: '10px',
          }}
        >
          <Link
            href={`/event/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '20px',
              border: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft}`,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : SYSTEM.surface,
              color: theme.text,
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            <span aria-hidden="true">←</span>
            <span>Event</span>
          </Link>
        </div>

        {event.cover_image_url ? (
          <div
            style={{
              width: '100%',
              paddingTop: '5px',
              marginBottom: '0',
            }}
          >
            <img
              src={event.cover_image_url}
              alt={event.title || 'Event cover'}
              style={{
                width: '100%',
                height: '220px',
                objectFit: 'cover',
                borderRadius: '24px',
                display: 'block',
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            padding: '25px',
            paddingTop: '15px',
          }}
        >
          {isFormal ? (
            <>
              <h1
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  letterSpacing: '-1px',
                  margin: '0 0 4px',
                  lineHeight: 1.05,
                }}
              >
                {event.title}
              </h1>

              <p
                style={{
                  fontSize: '18px',
                  margin: '0 0 25px',
                  color: theme.text,
                  opacity: 0.7,
                }}
              >
                Hosted by {event.host_name}
              </p>

              <div style={{ marginBottom: '30px' }}>
                {event.starts_at ? (
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: locationText ? '8px' : '0',
                    }}
                  >
                    {formatEventDate(event.starts_at)}
                  </div>
                ) : null}

                {locationText ? (
                  <div style={{ marginBottom: '5px' }}>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(locationText)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: theme.accent,
                        fontSize: '18px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      📍 {locationText}
                    </a>
                    <div
                      style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        marginLeft: '24px',
                        fontWeight: 700,
                        color: theme.accent,
                        marginTop: '2px',
                      }}
                    >
                      Open in Maps
                    </div>
                  </div>
                ) : null}
              </div>

              {displayDescription ? (
                <div style={{ marginBottom: '35px', padding: '5px' }}>
                  <p
                    style={{
                      fontSize: '17px',
                      lineHeight: 1.53,
                      margin: 0,
                      color: theme.text,
                      opacity: 0.9,
                    }}
                  >
                    {displayDescription}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    color: theme.accent,
                    fontSize: '20px',
                    lineHeight: 1,
                  }}
                >
                  ≋
                </span>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.accent,
                  }}
                >
                  {event.host_name}&apos;s Idea
                </div>
              </div>

              <h1
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  margin: '0 0 12px',
                  lineHeight: 1.05,
                }}
              >
                {event.title}
              </h1>

              {event.description ? (
                <p
                  style={{
                    fontSize: '18px',
                    lineHeight: '26px',
                    fontWeight: 500,
                    margin: '0 0 25px',
                    color: theme.text,
                    opacity: 0.8,
                  }}
                >
                  {event.description}
                </p>
              ) : null}
            </>
          )}

          <RSVPButton event={event} />
        </div>
      </div>
    </main>
  );
}