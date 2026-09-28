// CONFIGURACIÓN DE FIREBASE
// 1) Crea un proyecto en Firebase.
// 2) Activa Authentication > Email/Password, Firestore y Storage.
// 3) Pega aquí la configuración de tu Web App.
// 4) Cambia DEMO_MODE a false.
//
// Mientras DEMO_MODE=true puedes probar toda la interfaz sin Firebase.

export const DEMO_MODE = true;

export const firebaseConfig = {
  apiKey: "REEMPLAZAR",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  projectId: "REEMPLAZAR",
  storageBucket: "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR"
};

export const INTERNAL_EMAIL_DOMAIN = "informes.local";
