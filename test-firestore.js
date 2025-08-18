// test-firestore.js
const admin = require('firebase-admin');
const serviceAccount = require('./qualtrics-messaging-server-firebase-adminsdk-fbsvc-478a1a2f03.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

db.collection('test').add({ hello: 'world', ts: new Date() })
  .then(docRef => {
    console.log('Write successful! Doc ID:', docRef.id);
    process.exit(0);
  })
  .catch(err => {
    console.error('Firestore write failed:', err);
    process.exit(1);
  });