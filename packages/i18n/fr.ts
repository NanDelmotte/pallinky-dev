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
common_manage: 'Gérer',
common_view_event: "Voir l'événement",
common_hide_card_title: 'Masquer la carte',
common_hide_card_body:
  'Cela masque la carte de votre fil. Vous pouvez toujours la restaurer dans les paramètres.',
common_cancel: 'Annuler',
common_hide: 'Masquer',
common_error: 'Erreur',
common_hide_card_error: 'Impossible de masquer la carte.',
event_card_date_tbd: 'Date à confirmer',
event_card_badge_past: 'PASSÉ',
event_card_badge_planned: 'PLANIFIÉ',
event_card_badge_pending: 'EN ATTENTE',
event_card_badge_joined: 'INSCRIT',
event_card_badge_plan: 'PLAN',
event_card_badge_series: 'SÉRIE',
event_card_you_organized: 'Vous avez organisé',
event_card_host_organized: '{host} a organisé',
event_card_you_are_organizing: 'Vous organisez',
event_card_host_is_organizing: '{host} organise',
event_card_badge_planning: 'EN COURS',

people_may_know_someone: 'quelqu’un',
people_may_know_this_person: 'cette personne',
people_may_know_mutual_with_others: 'Vous connaissez tous les deux {name} + {count} autres personnes',
people_may_know_mutual_one: 'Vous connaissez tous les deux {name}',
people_may_know_friend_of_friend: 'Ami d’un ami',
people_may_know_already_in_contacts: 'Déjà dans vos contacts',
people_may_know_suggested_connection: 'Connexion suggérée',
people_may_know_error_already_in_circle: 'Cette personne est déjà dans ce cercle.',
people_may_know_error_update_circle: 'Impossible de mettre à jour le cercle.',
people_may_know_error_create_circle: 'Impossible de créer le cercle.',
people_may_know_empty_title: 'Aucune suggestion de connexion pour le moment',
people_may_know_empty_subtitle:
  'À mesure que vous ajoutez des personnes et créez des cercles, les suggestions de connexion apparaîtront ici.',
people_may_know_modal_title: 'Ajouter à un cercle',
people_may_know_modal_subtitle: 'Où placer {name} ?',
people_may_know_search_placeholder: 'Rechercher des cercles...',
people_may_know_create_placeholder: 'Ou créer un nouveau cercle...',
people_may_know_create_add: 'Créer et ajouter',
common_start: 'Commencer',

home_title: 'Fil social',
home_subtitle: 'Les plans et les personnes qui bougent autour de vous.',
home_start_something_title: 'Lancer quelque chose',
home_start_something_cold_subtitle:
  'Le moyen le plus rapide de mettre votre fil en mouvement.',
home_start_something_warm_subtitle: 'Sortons !',
home_happening_title: 'Que se passe-t-il ?',
home_happening_cold_subtitle:
  'Lorsque des plans et des personnes commenceront à apparaître, ils s’afficheront ici.',
home_happening_active_subtitle: 'Vos plans actifs',
home_friends_active_title: 'Les plans actifs de vos amis',
home_friends_active_subtitle:
  'Ne vous inquiétez pas, ils ont dit que vous pouviez jeter un œil, et nous ne leur montrerons pas que vous l’avez fait',
home_connect_title: 'Se connecter',
home_connect_subtitle:
  'Élargissez vos cercles. Voici des personnes que vous pourriez connaître grâce à votre réseau et vos contacts.',

home_idea_make_plan_title: 'Créer un plan',
home_idea_make_plan_subtitle: 'Lancez un plan et invitez des amis',
home_idea_coffee_title: 'Café cette semaine',
home_idea_coffee_subtitle: 'Retrouvailles simples',
home_idea_drinks_title: 'Verres ce soir',
home_idea_drinks_subtitle: 'Voir qui est disponible',
home_idea_dinner_title: 'Dîner ce week-end',
home_idea_dinner_subtitle: 'Lancer un vrai plan',
home_idea_walk_title: 'Promenade au parc',
home_idea_walk_subtitle: 'Plan simple en plein air',
home_idea_movie_title: 'Soirée film',
home_idea_movie_subtitle: 'Invitation rapide en groupe',

home_import_coffee_title: 'Inviter quelqu’un à prendre un café',
home_import_coffee_subtitle: 'Un plan simple suffit pour lancer le mouvement.',
home_empty_activity_title: 'Aucune activité en direct pour le moment',
home_empty_activity_subtitle:
  'Dès que des plans, invitations ou activités de réseau apparaîtront, cette section se remplira.',
};