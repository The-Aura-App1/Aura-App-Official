import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signIn, signUp, signOut, confirmSignUp,
  getCurrentUser, fetchUserAttributes, resendSignUpCode,
  fetchAuthSession,
} from 'aws-amplify/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [attrs, setAttrs]         = useState(null);
  const [dbProfile, setDbProfile] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const currentUser = await getCurrentUser();
      const userAttrs   = await fetchUserAttributes();
      setUser(currentUser);
      setAttrs(userAttrs);

      // Load DynamoDB profile to get correct username
      const session = await fetchAuthSession();
      const token   = session.tokens?.idToken?.toString();
      if (token) {
        const res = await fetch('https://7uob369et4.execute-api.us-east-1.amazonaws.com/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const profile = await res.json();
          setDbProfile(profile);
        }
      }
    } catch {
      setUser(null);
      setAttrs(null);
      setDbProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function register({ email, password, username, birthYear }) {
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 13) {
      throw new Error('You must be at least 13 years old to create an account.');
    }
    return await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          preferred_username:   username,
          'custom:accountType': 'regular',
          'custom:isPremium':   'false',
          'custom:isCreator':   'false',
          'custom:displayName': username,
        },
      },
    });
  }

  async function confirmEmail({ email, code }) {
    return await confirmSignUp({ username: email, confirmationCode: code });
  }

  async function resendCode({ email }) {
    return await resendSignUpCode({ username: email });
  }

  async function login({ email, password }) {
    let result;
    try {
      result = await signIn({ username: email, password });
    } catch (err) {
      // A leftover session (e.g. another account in the same browser) blocks
      // signing in; replace it with the account being signed into.
      if (err.name !== 'UserAlreadyAuthenticatedException') throw err;
      await signOut();
      result = await signIn({ username: email, password });
    }
    await loadUser();
    return result;
  }

  async function logout() {
    await signOut();
    setUser(null);
    setAttrs(null);
    setDbProfile(null);
  }

  const isPremium       = attrs?.['custom:isPremium']  === 'true';
  const isCreator       = attrs?.['custom:isCreator']  === 'true';
  const accountType     = attrs?.['custom:accountType'] ?? 'regular';
  const displayName     = dbProfile?.displayName ?? attrs?.['custom:displayName'] ?? attrs?.preferred_username ?? '';
  const username        = dbProfile?.username ?? attrs?.preferred_username ?? '';
  const profileComplete = !!attrs &&
    !!attrs['custom:displayName'] &&
    attrs['custom:displayName'] !== user?.userId;

  return (
    <AuthContext.Provider value={{
      user, attrs, dbProfile, loading,
      isPremium, isCreator, accountType, displayName, username,
      profileComplete,
      register, confirmEmail, resendCode, login, logout,
      refreshUser: loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};