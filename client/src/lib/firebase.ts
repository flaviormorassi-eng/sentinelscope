// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD-oemnIwBy9W7bpZAmg4hdOPi-MAkPhb8",
  authDomain: "sentinelscope-fb845.firebaseapp.com",
  projectId: "sentinelscope-fb845",
  storageBucket: "sentinelscope-fb845.firebasestorage.app",
  messagingSenderId: "880809360603",
  appId: "1:880809360603:web:cc8b31cfd5100432eca0fe",
  measurementId: "G-HS545JSSFV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();