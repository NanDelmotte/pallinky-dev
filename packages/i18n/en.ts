/**
 * Path: packages/i18n/en.ts
 * Description: English translation dictionary (human-centered, invitation-based tone for email confirmations).
 */

import type { TranslationKey } from './types';

export const en: Record<TranslationKey, string> = {
  formal_yes_headline: '{host} says Thank You',
  formal_yes_event_context: '{event}',
  formal_yes_support:
    'You’re joining. You can come back here anytime to see details or see who else is coming.',
  formal_yes_subject: '{event} organized by {host}',

  formal_maybe_headline: '{host} has received your response',
  formal_maybe_event_context: '{event}',
  formal_maybe_support:
    'You might be able to make it. You can update your response anytime.',
  formal_maybe_subject: '{event} organized by {host}',

  formal_no_headline: '{host} has received your response',
  formal_no_event_context: '{event}',
  formal_no_support:
    'You’re not joining this time. You can still change your mind by clicking below.',
  formal_no_subject: '{event} organized by {host}',

  poll_submitted_headline: '{host} thanks you for your vote',
  poll_submitted_event_context: '{event}',
  poll_submitted_support:
    'You can go back anytime to see the options or update your vote.',
  poll_submitted_subject: '{event} organized by {host}',

  poll_updated_headline: '{host} saw your updated vote',
  poll_updated_event_context: '{event}',
  poll_updated_support:
    'You can go back anytime to see the options or change your vote again.',
  poll_updated_subject: '{event} organized by {host}',
};