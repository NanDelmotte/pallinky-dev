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

  common_manage: 'Manage',
common_view_event: 'View Event',
common_hide_card_title: 'Hide card',
common_hide_card_body:
  'This hides the card from your feed. You can always restore it in settings.',
common_cancel: 'Cancel',
common_hide: 'Hide',
common_error: 'Error',
common_hide_card_error: 'Could not hide card.',
event_card_date_tbd: 'Date TBD',
event_card_badge_past: 'PAST',
event_card_badge_planned: 'PLANNED',
event_card_badge_pending: 'PENDING',
event_card_badge_joined: 'JOINED',
event_card_badge_plan: 'PLAN',
event_card_badge_series: 'SERIES',
event_card_you_organized: 'You organized',
event_card_host_organized: '{host} organized',
event_card_you_are_organizing: 'You are organizing',
event_card_host_is_organizing: '{host} is organizing',
event_card_badge_planning: 'PLANNING',


people_may_know_someone: 'someone',
people_may_know_this_person: 'this person',
people_may_know_mutual_with_others: 'You both know {name} + {count} others',
people_may_know_mutual_one: 'You both know {name}',
people_may_know_friend_of_friend: 'Friend of a friend',
people_may_know_already_in_contacts: 'Already in your contacts',
people_may_know_suggested_connection: 'Widen your circles',
people_may_know_error_already_in_circle: 'That person is already in this circle.',
people_may_know_error_update_circle: 'Could not update circle.',
people_may_know_error_create_circle: 'Could not create circle.',
people_may_know_empty_title: 'No connect signals yet',
people_may_know_empty_subtitle:
  'As you add people and build circles, connect suggestions will appear here.',
people_may_know_modal_title: 'Add to a Circle',
people_may_know_modal_subtitle: 'Where does {name} fit in?',
people_may_know_search_placeholder: 'Search circles...',
people_may_know_create_placeholder: 'Or create a new circle...',
people_may_know_create_add: 'Create & Add',
common_start: 'Start',

home_title: 'Social Feed',
home_subtitle: 'Plans and people moving around you.',
home_start_something_title: 'Start Something',
home_start_something_cold_subtitle: 'The fastest way to get motion into your feed.',
home_start_something_warm_subtitle: "Let's go out!",
home_happening_title: 'What is Happening?',
home_happening_cold_subtitle: 'Once plans and people start showing up, they will appear here.',
home_happening_active_subtitle: 'Your active plans',
home_friends_active_title: 'Your friends active plans',
home_friends_active_subtitle:
  "Don't worry, they said you could peek, and we won't show them that you did",
home_connect_title: 'Connect',
home_connect_subtitle:
  'Widen your circles. These are people you may know based on your network and contacts.',

home_idea_make_plan_title: 'Make a Plan',
home_idea_make_plan_subtitle: 'Start a plan and invite friends',
home_idea_coffee_title: 'Coffee this week',
home_idea_coffee_subtitle: 'Low-friction catch-up',
home_idea_drinks_title: 'Drinks tonight',
home_idea_drinks_subtitle: 'See who is around',
home_idea_dinner_title: 'Dinner this weekend',
home_idea_dinner_subtitle: 'Start a real plan',
home_idea_walk_title: 'Walk in the park',
home_idea_walk_subtitle: 'Easy outdoor plan',
home_idea_movie_title: 'Movie night',
home_idea_movie_subtitle: 'Quick group invite',

home_import_coffee_title: 'Invite someone for coffee',
home_import_coffee_subtitle: 'One easy plan is enough to get things moving.',
home_empty_activity_title: 'No live activity yet',
home_empty_activity_subtitle:
  'As soon as plans, invites, or network activity appear, this section will populate.',
};