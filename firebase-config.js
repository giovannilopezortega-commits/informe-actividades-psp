// CONFIGURACIÓN DE LA APP
window.APP_CONFIG = {
  DEMO_MODE: true,

  // Firebase (usuarios/historial). Se configurará cuando pasemos a producción.
  firebaseConfig: {
    apiKey: "REEMPLAZAR",
    authDomain: "REEMPLAZAR.firebaseapp.com",
    projectId: "REEMPLAZAR",
    storageBucket: "REEMPLAZAR.appspot.com",
    messagingSenderId: "REEMPLAZAR",
    appId: "REEMPLAZAR"
  },
  INTERNAL_EMAIL_DOMAIN: "informes.local",

  // Google Drive para informes firmados.
  // DRIVE_WEB_APP_URL se llenará después de desplegar google-drive-apps-script.gs como Web App.
  DRIVE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzHACuXASFol05lilqQljla_V3xJTryX6Q-zpr9fXnLVb8BuMJZOXJEpXegMy0GlokU/exec",
  DRIVE_ROOT_FOLDER_ID: "1r97hwRuop6TfxJ_XIG4l5CRn4arPSNBj",
  SIGNED_PDF_MAX_MB: 15
};
