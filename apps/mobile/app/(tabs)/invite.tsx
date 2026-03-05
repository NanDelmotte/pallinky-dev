/** * Path: app/(tabs)/invite.tsx 
 * Description: Redirects the 'Invite' tab directly to the event creation flow. */
import { Redirect } from 'expo-router';

export default function InviteRedirect() {
  return <Redirect href="/create" />;
}