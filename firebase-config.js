// CONFIGURACIÓN DE LA APP
window.APP_CONFIG = {
  DEMO_MODE: false,
  // Los PDF se descargan al equipo. Las cuentas y el historial se guardan en Firestore.
  // No requiere activar servicios de almacenamiento de pago.
  REPORT_STORAGE_ENABLED: false,

  // Firebase: autenticación compartida y registro de informes.
  firebaseConfig: {
    apiKey: "AIzaSyCH-nVtuhPK1_UZw7IGIy0sTdvxjueYW4c",
    authDomain: "informes-actividades-psp.firebaseapp.com",
    projectId: "informes-actividades-psp",
    storageBucket: "informes-actividades-psp.firebasestorage.app",
    messagingSenderId: "423760151843",
    appId: "1:423760151843:web:a80446898e285cd1cbf896"
  },
  INTERNAL_EMAIL_DOMAIN: "informes.local",

  // Google Drive para informes firmados.
  // DRIVE_WEB_APP_URL se llenará después de desplegar google-drive-apps-script.gs como Web App.
  DRIVE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzHACuXASFol05lilqQljla_V3xJTryX6Q-zpr9fXnLVb8BuMJZOXJEpXegMy0GlokU/exec",
  DRIVE_ROOT_FOLDER_ID: "1r97hwRuop6TfxJ_XIG4l5CRn4arPSNBj",
  SIGNED_PDF_MAX_MB: 15
};

