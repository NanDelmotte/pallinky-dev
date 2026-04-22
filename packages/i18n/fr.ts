/**
 * Path: packages/i18n/fr.ts
 * Description: French translation dictionary (human-centered, invitation-based tone aligned with English keys).
 */

import type { TranslationKey } from './types';

export const fr: Record<TranslationKey, string> = {
formal_yes_headline: '{host} vous remercie',
formal_yes_event_context: '{event}',
formal_yes_support:
  'Vous participez. Vous pouvez revenir ici à tout moment pour voir les détails ou voir qui d’autre vient.',
formal_yes_subject: 'Votre réponse à {event} organisé par {host}',

formal_maybe_headline: '{host} a bien reçu votre réponse',
formal_maybe_event_context: '{event}',
formal_maybe_support:
  'Vous pourrez peut-être venir. Vous pouvez modifier votre réponse à tout moment.',
formal_maybe_subject: 'Votre réponse à {event} organisé par {host}',

formal_no_headline: '{host} a bien reçu votre réponse',
formal_no_event_context: '{event}',
formal_no_support:
  'Vous ne participez pas cette fois. Vous pouvez toujours changer d’avis en cliquant ci-dessous.',
formal_no_subject: 'Votre réponse à {event} organisé par {host}',

poll_submitted_headline: '{host} vous remercie pour votre vote',
poll_submitted_event_context: '{event}',
poll_submitted_support:
  'Vous pouvez revenir à tout moment pour voir les options ou mettre à jour votre vote.',
poll_submitted_subject: 'Votre réponse à {event} organisé par {host}',

poll_updated_headline: '{host} a vu votre vote mis à jour',
poll_updated_event_context: '{event}',
poll_updated_support:
  'Vous pouvez revenir à tout moment pour voir les options ou modifier votre vote à nouveau.',
poll_updated_subject: '{host} a vu votre vote mis à jour',
};