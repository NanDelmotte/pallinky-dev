/** * Path: packages/core/src/session.tsx 
 * Description: Identity provider. Renamed to .tsx to support JSX.
 * This manages global state for the email and guest token.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const GUEST_TOKEN_KEY = 'pallinky_guest_token';
const USER_EMAIL_KEY = 'pallinky_user_email';

interface SessionContextType {
  userEmail: string | null;
  guestToken: string | null;
  signIn: (email: string) => Promise<void>;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        let token = await SecureStore.getItemAsync(GUEST_TOKEN_KEY);
        if (!token) {
          token = Crypto.randomUUID();
          await SecureStore.setItemAsync(GUEST_TOKEN_KEY, token);
        }
        setGuestToken(token);

        const email = await SecureStore.getItemAsync(USER_EMAIL_KEY);
        setUserEmail(email);
      } catch (e) {
        console.error("Session Init Error:", e);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const signIn = async (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    await SecureStore.setItemAsync(USER_EMAIL_KEY, cleanEmail);
    setUserEmail(cleanEmail);
  };

  return (
    <SessionContext.Provider value={{ userEmail, guestToken, signIn, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionProvider');
  return context;
}