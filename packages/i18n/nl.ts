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
common_manage: 'Beheren',
common_view_event: 'Bekijk event',
common_hide_card_title: 'Kaart verbergen',
common_hide_card_body:
  'Dit verbergt de kaart uit je feed. Je kunt deze altijd herstellen in instellingen.',
common_cancel: 'Annuleren',
common_hide: 'Verbergen',
common_error: 'Fout',
common_hide_card_error: 'Kon kaart niet verbergen.',
event_card_date_tbd: 'Datum volgt',
event_card_badge_past: 'GEWEEST',
event_card_badge_planned: 'GEPLAND',
event_card_badge_pending: 'IN AFWACHTING',
event_card_badge_joined: 'AANGEMELD',
event_card_badge_plan: 'PLAN',
event_card_badge_series: 'REEKS',
event_card_you_organized: 'Jij organiseerde',
event_card_host_organized: '{host} organiseerde',
event_card_you_are_organizing: 'Jij organiseert',
event_card_host_is_organizing: '{host} organiseert',
event_card_badge_planning: 'IN PLANNING',
people_may_know_someone: 'iemand',
people_may_know_this_person: 'deze persoon',
people_may_know_mutual_with_others: 'Jullie kennen allebei {name} + {count} anderen',
people_may_know_mutual_one: 'Jullie kennen allebei {name}',
people_may_know_friend_of_friend: 'Vriend van een vriend',
people_may_know_already_in_contacts: 'Al in je contacten',
people_may_know_suggested_connection: 'Voorgestelde connectie',
people_may_know_error_already_in_circle: 'Deze persoon zit al in deze cirkel.',
people_may_know_error_update_circle: 'Kan cirkel niet bijwerken.',
people_may_know_error_create_circle: 'Kan cirkel niet maken.',
people_may_know_empty_title: 'Nog geen connectiesignalen',
people_may_know_empty_subtitle:
  'Wanneer je mensen toevoegt en cirkels opbouwt, verschijnen hier connectiesuggesties.',
people_may_know_modal_title: 'Toevoegen aan een cirkel',
people_may_know_modal_subtitle: 'Waar past {name} bij?',
people_may_know_search_placeholder: 'Cirkels zoeken...',
people_may_know_create_placeholder: 'Of maak een nieuwe cirkel...',
people_may_know_create_add: 'Maken en toevoegen',
common_start: 'Start',

home_title: 'Sociale feed',
home_subtitle: 'Plannen en mensen die om je heen in beweging zijn.',
home_start_something_title: 'Start iets',
home_start_something_cold_subtitle:
  'De snelste manier om beweging in je feed te krijgen.',
home_start_something_warm_subtitle: 'Laten we eropuit gaan!',
home_happening_title: 'Wat gebeurt er?',
home_happening_cold_subtitle:
  'Zodra plannen en mensen verschijnen, komen ze hier te staan.',
home_happening_active_subtitle: 'Je actieve plannen',
home_friends_active_title: 'De actieve plannen van je vrienden',
home_friends_active_subtitle:
  'Geen zorgen, ze zeiden dat je mocht kijken, en we laten hun niet zien dat je dat deed',
home_connect_title: 'Verbinden',
home_connect_subtitle:
  'Maak je cirkels groter. Dit zijn mensen die je misschien kent via je netwerk en contacten.',

home_idea_make_plan_title: 'Maak een plan',
home_idea_make_plan_subtitle: 'Start een plan en nodig vrienden uit',
home_idea_coffee_title: 'Koffie deze week',
home_idea_coffee_subtitle: 'Laagdrempelig bijpraten',
home_idea_drinks_title: 'Drankjes vanavond',
home_idea_drinks_subtitle: 'Kijk wie er in de buurt is',
home_idea_dinner_title: 'Diner dit weekend',
home_idea_dinner_subtitle: 'Start een echt plan',
home_idea_walk_title: 'Wandeling in het park',
home_idea_walk_subtitle: 'Eenvoudig buitenplan',
home_idea_movie_title: 'Filmavond',
home_idea_movie_subtitle: 'Snelle groepsuitnodiging',

home_import_coffee_title: 'Nodig iemand uit voor koffie',
home_import_coffee_subtitle: 'Eén eenvoudig plan is genoeg om beweging te krijgen.',
home_empty_activity_title: 'Nog geen live activiteit',
home_empty_activity_subtitle:
  'Zodra plannen, uitnodigingen of netwerkactiviteit verschijnen, wordt deze sectie gevuld.',
};