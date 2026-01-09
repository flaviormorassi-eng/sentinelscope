import admin from 'firebase-admin';

// Initialize Firebase Admin
// We attempt to initialize with default credentials.
// If GOOGLE_APPLICATION_CREDENTIALS is set, it uses that.
// Otherwise, we explicitly set the projectId to ensure verifyIdToken works
// for checking the 'aud' claim.

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'sentinelscope-fb845',
    });
    console.log('[FirebaseAdmin] Initialized successfully');
  } catch (error) {
    console.error('[FirebaseAdmin] Initialization failed:', error);
  }
}

export const firebaseAdmin = admin;
export const auth = admin.auth();
