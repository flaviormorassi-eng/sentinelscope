import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  AuthError,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  sendMfaCode: () => Promise<string>;
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
  const [verificationId, setVerificationId] = useState<string>('');
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

    let authResolved = false;

    const handleAuthChange = async (user: FirebaseUser | null) => {
      if (authResolved && !user) return; // Prevent overwriting if already resolved, unless user is signing out/changing
      authResolved = true;

      // Dev auth override check
      // Allow dev auth if we are in dev mode OR if the flag is explicitly set
      const isDevMode = import.meta.env.DEV || import.meta.env.VITE_DISABLE_FIREBASE_AUTH === 'true';
      let devUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('devUserId') : null;
      
      // Default to 'demo' in dev mode if not set, to match queryClient behavior and ensure access
      if (isDevMode && !devUserId) {
        devUserId = 'demo';
      }
      
      // Only use mock user if we are in dev mode AND a devUserId is set in localStorage
      if (isDevMode && devUserId && !user) {
        // Mock user object for dev mode
        const mockUser = {
          uid: devUserId,
          email: `${devUserId}@example.com`,
          displayName: `Dev User (${devUserId})`,
          emailVerified: true,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          refreshToken: '',
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => 'dev-token',
          getIdTokenResult: async () => ({ token: 'dev-token' } as any),
          reload: async () => {},
          toJSON: () => ({}),
          phoneNumber: null,
          photoURL: null,
          providerId: 'dev',
        } as unknown as FirebaseUser;
        
        console.log('[Auth] Using dev mock user:', devUserId);
        setUser(mockUser);
        // Also sync the dev user
        try {
          // Use a short timeout for the dev sync to prevent blocking
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          await fetch('/api/auth/user', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': mockUser.uid
            },
            body: JSON.stringify({
              id: mockUser.uid,
              email: mockUser.email,
              displayName: mockUser.displayName,
              photoURL: mockUser.photoURL,
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          setIsAdmin(true); // Dev users are admins by default
        } catch (e: any) {
           // Ignore abort errors or log them gently
           if (e.name !== 'AbortError') {
             console.error('Failed to sync dev user', e);
           }
        }
        setLoading(false);
        return;
      }

      setUser(user);
      
      if (user) {
        try {
          const token = await user.getIdToken();
          // Sync user with backend
          const createdResp = await fetch('/api/auth/user', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              id: user.uid,
              email: user.email || '',
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
    };

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, handleAuthChange);

    // Fallback timeout: If Firebase takes too long (e.g. network block), force check dev mode
    const fallbackTimeout = setTimeout(() => {
      if (!authResolved) {
        console.warn('[Auth] Firebase auth timed out, forcing state check...');
        handleAuthChange(auth.currentUser);
      }
    }, 2500);

    return () => {
      clearTimeout(fallbackTimeout);
      unsubscribe();
    }
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
      
      let description = error.message || "Failed to sign in. Please try again.";
      
      if (error.code === 'auth/popup-blocked') {
        description = "Popup was blocked by your browser. Please allow popups for this site.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        description = "Sign-in popup was closed before completion.";
      } else if (error.code === 'auth/unauthorized-domain') {
        description = "This domain (localhost) is not authorized in Firebase Console. Please add it to Authorized Domains.";
      } else if (error.code === 'auth/operation-not-allowed') {
        description = "Google Sign-In is not enabled in Firebase Console.";
      }

      toast({
        title: "Authentication Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    try {
      setLoading(true);
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error('Sign in redirect error:', error);
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to initiate sign in.",
        variant: "destructive",
      });
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


  const sendMfaCode = async () => {
    if (!mfaResolver || !mfaHint) {
      throw new Error('No MFA resolver or hint available');
    }
    
    try {
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verId = await phoneAuthProvider.verifyPhoneNumber({
        multiFactorHint: mfaHint,
        session: mfaResolver.session
      }, window.recaptchaVerifier);
      
      setVerificationId(verId);
      return verId;
    } catch (error: any) {
      console.error('Error sending MFA code:', error);
      toast({
        title: "MFA Error",
        description: error.message || "Failed to send verification code.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const verifyMfaCode = async (code: string) => {
    if (!mfaResolver) return;
    try {
      setLoading(true);
      
      if (!verificationId) {
        throw new Error('Verification ID not found. Please request a code first.');
      }

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
    setVerificationId('');
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
      mfaResolver,
      mfaHint,
      loading,
      signInWithGoogle,
      signInWithGoogleRedirect,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      deleteAccount,
      sendMfaCode,
      verifyMfaCode,
      clearMfa,
      signOut,
    }}>
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
