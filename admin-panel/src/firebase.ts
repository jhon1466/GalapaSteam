import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDGE4jG3OOD9ayXqb8H0bxbyQgwqvuZgbs",
  authDomain: "galapasteam-48065.firebaseapp.com",
  projectId: "galapasteam-48065",
  storageBucket: "galapasteam-48065.firebasestorage.app",
  messagingSenderId: "125449013674",
  appId: "1:125449013674:web:374b8eea04d23ef25243d3",
  measurementId: "G-YXSSWQT1ZT",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);
