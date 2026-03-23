//packages/core/src/invite/buildInviteMessage.ts

export function buildInviteMessage(input: {
  title?: string | null;
  link: string;
  ctaLabel?: string;
}) {
  const safeTitle = input.title?.trim() || 'this event';
  const ctaLabel = input.ctaLabel?.trim() || 'Open the invite';

  return `${safeTitle}\n\nJoin here:\n${input.link}`;
}