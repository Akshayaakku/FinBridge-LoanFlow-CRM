import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import type { UserAccount, UserRole } from '../types/crm';

export type PortalMode = 'admin' | 'mobile_admin' | 'staff';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserAccount | null;
  role: UserRole;
  loading: boolean;
  authError: string | null;
  unverifiedEmail: string | null;
  accessDeniedNotice: string | null;
  clearAccessDeniedNotice: () => void;
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  inspectedStaffEmail: string;
  setInspectedStaffEmail: (email: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAPPED_ADMIN_EMAILS = ['b03328764@gmail.com', 'admin@loancrm.com'];

function detectPostLoginPortalMode(role: UserRole): PortalMode {
  const path = window.location.pathname.toLowerCase();
  if (role === 'staff') {
    if (path !== '/staff') {
      window.history.replaceState({}, '', '/staff');
    }
    return 'staff';
  }
  if (path.startsWith('/admin/mobile')) {
    return 'mobile_admin';
  }
  if (path !== '/admin') {
    window.history.replaceState({}, '', '/admin');
  }
  return 'admin';
}

function formatAuthError(err: unknown, context: 'google' | 'email' | 'reset'): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site and click "Continue with Google" again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completing. Click "Continue with Google" to try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return `This domain (${window.location.hostname}) is not authorized in Firebase Authentication -> Settings -> Authorized domains.`;
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method.';
  }
  if (code === 'auth/operation-not-allowed') {
    return context === 'google'
      ? 'Google sign-in is disabled in Firebase Console. Enable Google under Authentication -> Sign-in method.'
      : 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Use Google Sign-In for immediate access, or enable Email/Password in Firebase Console.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid work email address.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been disabled in Firebase Authentication. Contact your administrator.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Please wait a few minutes or use Forgot Password to recover access.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while reaching authentication servers. Check your connection and retry.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return context === 'reset'
      ? 'No matching Firebase Email/Password account was found for this address.'
      : 'Invalid email or password, or account not yet created in Firebase Authentication. Verify credentials or sign in with Google.';
  }
  return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [role, setRole] = useState<UserRole>('staff');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState<string | null>(null);
  const [portalMode, setPortalModeState] = useState<PortalMode>(() =>
    window.location.pathname.toLowerCase().startsWith('/admin/mobile') ? 'mobile_admin' : 'admin'
  );
  const [inspectedStaffEmail, setInspectedStaffEmail] = useState<string>('staff@loancrm.com');

  const setPortalMode = (mode: PortalMode) => {
    if (role === 'staff' && mode !== 'staff') {
      setAccessDeniedNotice('Administrator permissions are required to access Admin routes.');
      if (window.location.pathname !== '/staff') {
        window.history.replaceState({}, '', '/staff');
      }
      return;
    }
    setPortalModeState(mode);
    const targetPath =
      mode === 'mobile_admin' ? '/admin/mobile' : mode === 'staff' ? '/staff' : '/admin';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (role === 'staff') {
        if (path.startsWith('/admin')) {
          setAccessDeniedNotice('Administrator permissions are required to access Admin routes.');
          window.history.replaceState({}, '', '/staff');
        }
        setPortalModeState('staff');
      } else if (path.startsWith('/admin/mobile')) {
        setPortalModeState('mobile_admin');
      } else if (path.startsWith('/staff')) {
        setPortalModeState('staff');
      } else {
        setPortalModeState('admin');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [role]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthError(null);
      setUnverifiedEmail(null);
      if (!user) {
        setFirebaseUser(null);
        setUserProfile(null);
        setRole('staff');
        setLoading(false);
        return;
      }

      const email = (user.email || '').toLowerCase();
      if (!user.emailVerified) {
        setFirebaseUser(null);
        setUserProfile(null);
        setRole('staff');
        setUnverifiedEmail(email || 'your account');
        setAuthError(
          `Your email (${email}) is not yet verified. Open the verification link sent to your inbox, then sign in again.`
        );
        setLoading(false);
        return;
      }

      try {
        const requestedPath = window.location.pathname.toLowerCase();
        const isBootstrapAdmin = BOOTSTRAPPED_ADMIN_EMAILS.includes(email);
        const userRef = doc(db, 'users', user.uid);
        const adminMarkerRef = doc(db, 'admins', user.uid);

        if (isBootstrapAdmin) {
          const adminSnap = await getDoc(adminMarkerRef);
          if (!adminSnap.exists()) {
            await setDoc(adminMarkerRef, {
              email,
              createdAt: serverTimestamp(),
            });
          }
        }

        const existingUserSnap = await getDoc(userRef);
        let resolvedRole: UserRole = isBootstrapAdmin ? 'admin' : 'staff';

        if (existingUserSnap.exists()) {
          const data = existingUserSnap.data();
          if (data.role === 'admin' || isBootstrapAdmin) {
            resolvedRole = 'admin';
          }
          setUserProfile({
            id: existingUserSnap.id,
            uid: user.uid,
            email,
            fullName: String(data.fullName || user.displayName || email.split('@')[0]),
            role: resolvedRole,
            employeeId: data.employeeId ? String(data.employeeId) : undefined,
            status: data.status === 'inactive' ? 'inactive' : 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const adminSnap = await getDoc(adminMarkerRef);
          if (adminSnap.exists() || isBootstrapAdmin) {
            resolvedRole = 'admin';
          }
          const fullName = user.displayName || (isBootstrapAdmin ? 'CRM Operations Director' : email.split('@')[0]);
          await setDoc(userRef, {
            uid: user.uid,
            email,
            fullName,
            role: resolvedRole,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUserProfile({
            id: user.uid,
            uid: user.uid,
            email,
            fullName,
            role: resolvedRole,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (resolvedRole === 'staff' && requestedPath.startsWith('/admin')) {
          setAccessDeniedNotice(
            'Admin route access restricted: Staff accounts are routed exclusively to the Staff Call Centre Portal.'
          );
        } else {
          setAccessDeniedNotice(null);
        }

        setFirebaseUser(user);
        setRole(resolvedRole);
        setPortalModeState(detectPostLoginPortalMode(resolvedRole));
        if (resolvedRole === 'staff') {
          setInspectedStaffEmail(email);
        }
      } catch (err) {
        console.error('Error initializing user session:', err);
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to verify user permissions. Please ensure your email is verified.'
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setUnverifiedEmail(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setAuthError(formatAuthError(err, 'google'));
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    setUnverifiedEmail(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      setAuthError(formatAuthError(err, 'email'));
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: unknown) {
      setAuthError(formatAuthError(err, 'reset'));
      throw err;
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser) {
      setAuthError('Sign in with your email and password first to resend a verification email.');
      return;
    }
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthError(null);
    } catch (err: unknown) {
      setAuthError(formatAuthError(err, 'email'));
      throw err;
    }
  };

  const signOut = async () => {
    setAccessDeniedNotice(null);
    setUnverifiedEmail(null);
    setAuthError(null);
    await firebaseSignOut(auth);
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        role,
        loading,
        authError,
        unverifiedEmail,
        accessDeniedNotice,
        clearAccessDeniedNotice: () => setAccessDeniedNotice(null),
        portalMode,
        setPortalMode,
        inspectedStaffEmail,
        setInspectedStaffEmail,
        signInWithGoogle,
        signInWithEmail,
        resetPassword,
        resendVerification,
        signOut,
        clearAuthError: () => {
          setAuthError(null);
          setUnverifiedEmail(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
