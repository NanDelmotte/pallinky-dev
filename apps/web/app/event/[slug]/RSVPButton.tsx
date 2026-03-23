/**
 * Path: apps/web/app/event/[slug]/RSVPButton.tsx
 * Description: Web RSVP form visually aligned with the current mobile RSVP screens.
 */

'use client';

import React, { useMemo, useState } from 'react';

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

function formatVoteDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RSVPButton({ event }: { event: any }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const isFormal = event.event_type === 'formal' || !!event.starts_at;
  const proposedDates = Array.isArray(event.proposed_dates) ? event.proposed_dates : [];
  const isDatePoll = !isFormal && proposedDates.length > 0;

  const themeKey =
    event?.gif_key && PALETTES[event.gif_key]
      ? event.gif_key
      : isFormal
        ? 'zen'
        : 'submerged';

  const theme = PALETTES[themeKey];

  const customFont = useMemo(
    () => ({
      fontFamily: FONT_MAP[event?.font_family] || FONT_MAP.Sans,
    }),
    [event?.font_family]
  );

  const inputBg = theme.isDark ? 'rgba(255,255,255,0.05)' : SYSTEM.surface;
  const inputBorder = theme.isDark ? `${theme.accent}33` : SYSTEM.border;
  const cardBorder = theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft;
  const secondaryBg = theme.isDark ? 'transparent' : SYSTEM.surface;
  const secondaryText = theme.accent;

  const handleSubmit = async (statusOverride?: string) => {
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isDatePoll && selectedDates.length === 0) {
      setError('Pick at least one date.');
      return;
    }

    const finalStatus = statusOverride || 'interested';

    setLoading(true);

    try {
      const response = await fetch(`/api/event/${event.slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || null,
          status: finalStatus,
          selectedDates,
          note,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || 'Failed to save your response. Please try again.');
        return;
      }

      window.location.href =
        result?.redirectTo || `/event/${event.slug}/thanks?status=${finalStatus}`;
    } catch {
      setError('Failed to save your response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

    if (isFormal) {
    return (
      <div style={{ ...customFont }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 800,
            marginBottom: '15px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${theme.isDark ? `${theme.accent}40` : SYSTEM.border}`,
            color: theme.text,
          }}
        >
          RSVP Details
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: inputBg,
              color: theme.text,
            }}
          />
          <input
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: inputBg,
              color: theme.text,
            }}
          />
          <input
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: inputBg,
              color: theme.text,
            }}
          />
          <textarea
            placeholder="Note for the host..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              width: '100%',
              height: '80px',
              padding: '15px',
              borderRadius: '12px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: inputBg,
              color: theme.text,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error ? (
          <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '50px' }}>
          <button
            type="button"
            onClick={() => handleSubmit('yes')}
            disabled={loading}
            style={{
              height: '60px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: theme.accent,
              color: theme.bg,
              fontSize: '19px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Saving...' : "I’m Going"}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleSubmit('maybe')}
              disabled={loading}
              style={{
                flex: 1,
                height: '55px',
                borderRadius: '16px',
                border: `1.5px solid ${theme.accent}`,
                backgroundColor: secondaryBg,
                color: secondaryText,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Maybe
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('no')}
              disabled={loading}
              style={{
                flex: 1,
                height: '55px',
                borderRadius: '16px',
                border: `1.5px solid ${theme.accent}`,
                backgroundColor: secondaryBg,
                color: secondaryText,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDatePoll) {
    return (
      <div style={{ ...customFont, display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <div style={{ marginBottom: '0' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '1px',
              color: theme.text,
              opacity: 0.6,
            }}
          >
            Cast your votes:
          </div>

          {proposedDates.map((date: string, index: number) => {
            const isSelected = selectedDates.includes(date);

            return (
              <button
                key={`${date}-${index}`}
                type="button"
                onClick={() =>
                  setSelectedDates((prev) =>
                    prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
                  )
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px',
                  borderRadius: '20px',
                  marginBottom: '10px',
                  border: `1.5px solid ${
                    isSelected ? theme.accent : theme.isDark ? `${theme.accent}33` : SYSTEM.border
                  }`,
                  backgroundColor: isSelected
                    ? theme.accent
                    : theme.isDark
                      ? 'rgba(255,255,255,0.04)'
                      : SYSTEM.surface,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? theme.bg : theme.accent,
                      fontSize: '18px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {isSelected ? '✓' : '○'}
                  </div>

                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isSelected ? theme.bg : theme.text,
                      textAlign: 'left',
                    }}
                  >
                    {formatVoteDate(date)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: '0' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '1px',
              color: theme.text,
              opacity: 0.6,
            }}
          >
            Any thoughts?
          </div>

          <textarea
            placeholder="Suggest something else..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              width: '100%',
              borderRadius: '20px',
              padding: '18px',
              height: '100px',
              fontSize: '16px',
              border: `1px solid ${inputBorder}`,
              backgroundColor: inputBg,
              color: theme.text,
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '-8px',
            letterSpacing: '1px',
            color: theme.text,
            opacity: 0.6,
          }}
        >
          Your details
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '0',
          }}
        >
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: SYSTEM.surface,
              color: '#111111',
            }}
          />
          <input
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: SYSTEM.surface,
              color: '#111111',
            }}
          />
          <input
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: `1px solid ${inputBorder}`,
              fontSize: '16px',
              outline: 'none',
              backgroundColor: SYSTEM.surface,
              color: '#111111',
            }}
          />
        </div>

        {error ? (
          <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: 0 }}>{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => handleSubmit('interested')}
          disabled={loading}
          style={{
            padding: '22px',
            borderRadius: '18px',
            border: 'none',
            backgroundColor: theme.accent,
            color: theme.bg,
            fontSize: '19px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Saving...' : 'I’m Interested'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...customFont, display: 'flex', flexDirection: 'column', gap: '25px' }}>
      <div style={{ marginBottom: '0' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '1px',
            color: theme.text,
            opacity: 0.6,
          }}
        >
          Any thoughts?
        </div>

        <textarea
          placeholder="Suggest something else..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: '100%',
            borderRadius: '20px',
            padding: '18px',
            height: '100px',
            fontSize: '16px',
            border: `1px solid ${inputBorder}`,
            backgroundColor: inputBg,
            color: theme.text,
            outline: 'none',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          marginBottom: '-8px',
          letterSpacing: '1px',
          color: theme.text,
          opacity: 0.6,
        }}
      >
        Your details
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: `1px solid ${inputBorder}`,
            fontSize: '16px',
            outline: 'none',
            backgroundColor: SYSTEM.surface,
            color: '#111111',
          }}
        />
        <input
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: `1px solid ${inputBorder}`,
            fontSize: '16px',
            outline: 'none',
            backgroundColor: SYSTEM.surface,
            color: '#111111',
          }}
        />
        <input
          placeholder="Phone number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: `1px solid ${inputBorder}`,
            fontSize: '16px',
            outline: 'none',
            backgroundColor: SYSTEM.surface,
            color: '#111111',
          }}
        />
      </div>

      {error ? (
        <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: 0 }}>{error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => handleSubmit('interested')}
        disabled={loading}
        style={{
          padding: '22px',
          borderRadius: '18px',
          border: 'none',
          backgroundColor: theme.accent,
          color: theme.bg,
          fontSize: '19px',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {loading ? 'Saving...' : 'I’m Interested'}
      </button>
    </div>
  );
}