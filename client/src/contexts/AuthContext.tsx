import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  AuthError,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  getRedirectResult,
  MultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  MultiFactorInfo,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: FirebaseUser | null;
  isAdmin: boolean;
  mfaResolver: MultiFactorResolver | null;
  mfaHint: MultiFactorInfo | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  verifyMfaCode: (code: string) => Promise<void>;
  clearMfa: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [mfaHint, setMfaHint] = useState<MultiFactorInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });

    // Handle redirect result on page load
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect auth error:', error);
      toast({
        title: "Authentication Error",
        description: error.message || "Failed to sign in. Please try again.",
        variant: "destructive",
      });
    });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Sync user with backend
          const createdResp = await fetch('/api/auth/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.uid,
              email: user.email!,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }),
          });
          if (createdResp.ok) {
            try {
              const createdJson = await createdResp.json();
              if (typeof createdJson?.isAdmin === 'boolean') {
                setIsAdmin(createdJson.isAdmin);
              }
            } catch (_) {}
          }

          // Initialize demo data for new users
          await fetch('/api/init-demo-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
            body: JSON.stringify({ userId: user.uid }),
          });
        } catch (error) {
          console.error('Failed to sync user:', error);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [toast]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      toast({
        title: "Success",
        description: "Signed in successfully",
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Auth error:', error);
  if (error.code === 'auth/multi-factor-auth-required') {
      setMfaResolver(error.resolver);
      setMfaHint(error.resolver.hints[0]);
    } else {
      toast({
        title: "Authentication Failed",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Success",
        description: "Password reset email sent. Please check your inbox.",
      });
      return true;
    } catch (error: any) {
      handleAuthError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (password: string) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "No user is signed in.", variant: "destructive" });
      return false;
    }

    try {
      setLoading(true);
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await user.delete();
      toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });
      return true;
    } catch (error: any) {
      handleAuthError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };


  const verifyMfaCode = async (code: string) => {
    if (!mfaResolver) return;
    try {
      setLoading(true);
  // TODO: Replace 'verificationId' with the actual verification ID from your MFA flow
  const verificationId = '';
  const phoneAuthCredential = PhoneAuthProvider.credential(verificationId, code);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential);
      await mfaResolver.resolveSignIn(multiFactorAssertion);
      clearMfa();
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const clearMfa = () => {
    setMfaResolver(null);
    setMfaHint(null);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      isAdmin,
      loading, 
      mfaResolver,
      mfaHint,
      signInWithGoogle, 
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      deleteAccount,
      verifyMfaCode,
      clearMfa,
      signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
