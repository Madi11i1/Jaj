// تهيئة Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAI30r2_rI6vsuoaZIvzZQkauZ0d7KlhwI",
  authDomain: "infohive-fda92.firebaseapp.com",
  projectId: "infohive-fda92",
  storageBucket: "infohive-fda92.firebasestorage.com",
  messagingSenderId: "938794496627",
  appId: "1:938794496627:web:467f85ce9e035a2136b006",
  measurementId: "G-TE8QT8BVD5" // أضيف إذا كان متاحًا
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// التصديرات الأساسية فقط
export { app, db, auth };