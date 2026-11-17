/**
 * Öffentliche Firebase-Web-Konfiguration (Firebase-Konsole → Projekteinstellungen → Deine Apps → Web-App).
 * Diese Werte sind nicht geheim – geschützt werden die Daten durch Login + firestore.rules.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCmbujjfjGHXTc6iBKDcCRwJ70kNAM6HdE',
  authDomain: 'stromtracking-bla.firebaseapp.com',
  projectId: 'stromtracking-bla',
  storageBucket: 'stromtracking-bla.firebasestorage.app',
  messagingSenderId: '438480325656',
  appId: '1:438480325656:web:af4501a54183a2d8ee876d',
};

export const firebaseKonfiguriert = firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== '';
