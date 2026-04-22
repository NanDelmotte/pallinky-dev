/**
 * Path: packages/i18n/types.ts
 * Description: Central type definitions for localization system (languages + translation keys).
 */

export type AppLanguage = 'en' | 'nl' | 'fr';

export type TranslationKey =
  | 'formal_yes_headline'
  | 'formal_yes_event_context'
  | 'formal_yes_support'
  | 'formal_yes_subject'
  | 'formal_maybe_headline'
  | 'formal_maybe_event_context'
  | 'formal_maybe_support'
  | 'formal_maybe_subject'
  | 'formal_no_headline'
  | 'formal_no_event_context'
  | 'formal_no_support'
  | 'formal_no_subject'
  | 'poll_submitted_headline'
  | 'poll_submitted_event_context'
  | 'poll_submitted_support'
  | 'poll_submitted_subject'
  | 'poll_updated_headline'
  | 'poll_updated_event_context'
  | 'poll_updated_support'
  | 'poll_updated_subject';