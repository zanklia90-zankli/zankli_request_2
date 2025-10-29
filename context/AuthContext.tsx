import React, { createContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { User } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isInitializing: boolean;
  isAuthenticating: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children?: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // This effect handles auth state changes and is the single source of truth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);

        if (session?.user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email!,
              role: profile.role,
              fullName: profile.full_name,
            });
          } else {
            console.error("User authenticated but profile missing. Forcing logout.", error);
            await supabase.auth.signOut();
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
        
        // Mark both initial loading and any active authentication process as complete.
        setIsInitializing(false);
        setIsAuthenticating(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // If the API call itself fails, immediately stop the authenticating state.
      setIsAuthenticating(false); 
    }
    // On success, onAuthStateChange will fire and set isAuthenticating to false.
    return { error: error ? error.message : null };
  }, []);

  const logout = useCallback(async () => {
    setIsAuthenticating(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
      // If sign out fails, stop the authenticating state to prevent UI from being stuck.
      setIsAuthenticating(false);
    }
    // On success, onAuthStateChange will fire, clearing the user and setting isAuthenticating to false.
  }, []);

  const value = useMemo(() => ({ 
    session, 
    currentUser, 
    login, 
    logout, 
    isInitializing,
    isAuthenticating
  }), [session, currentUser, isInitializing, isAuthenticating, login, logout]);

  if (isInitializing) {
      return (
          <div className="flex flex-col justify-center items-center min-h-screen bg-zankli-cream-50">
              <Loader2 className="h-10 w-10 animate-spin text-zankli-orange-500" />
              <p className="mt-4 text-gray-600">Initializing Session...</p>
          </div>
      );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};