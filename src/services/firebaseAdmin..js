const admin = require('firebase-admin');
const serviceAccount = require('../../qualtrics-messaging-server-firebase-adminsdk-fbsvc-478a1a2f03.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin App initialized.');
}

const db = admin.firestore();


module.exports = { admin, db };