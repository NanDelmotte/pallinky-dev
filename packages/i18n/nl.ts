/**
 * Path: packages/i18n/nl.ts
 * Description: Dutch translation dictionary (human-centered, invitation-based tone aligned with English keys).
 */

import type { TranslationKey } from './types';

export const nl: Record<TranslationKey, string> = {
  formal_yes_headline: '{host} bedankt je',
formal_yes_event_context: '{event}',
formal_yes_support:
  'Je komt. Je kunt hier altijd terugkomen om de details te bekijken of te zien wie er nog meer komt.',
formal_yes_subject: 'Jouw reactie op {event} georganiseerd door {host}',

formal_maybe_headline: '{host} heeft je reactie ontvangen',
formal_maybe_event_context: '{event}',
formal_maybe_support:
  'Misschien kun je komen. Je kunt je reactie altijd aanpassen.',
formal_maybe_subject: 'Jouw reactie op {event} georganiseerd door {host}',

formal_no_headline: '{host} heeft je reactie ontvangen',
formal_no_event_context: '{event}',
formal_no_support:
  'Je komt deze keer niet. Je kunt nog steeds van gedachten veranderen door hieronder te klikken.',
formal_no_subject: 'Jouw reactie op {event} georganiseerd door {host}',

poll_submitted_headline: '{host} bedankt je voor je stem',
poll_submitted_event_context: '{event}',
poll_submitted_support:
  'Je kunt altijd terugkomen om de opties te bekijken of je stem aan te passen.',
poll_submitted_subject: 'Jouw reactie op {event} georganiseerd door {host}',

poll_updated_headline: '{host} heeft je bijgewerkte stem gezien',
poll_updated_event_context: '{event}',
poll_updated_support:
  'Je kunt altijd terugkomen om de opties te bekijken of je stem opnieuw te wijzigen.',
poll_updated_subject: '{host} heeft je bijgewerkte stem gezien',
};