const { db } = require('../services/firebaseAdmin..js');
const USERS_COLLECTION = 'users';

class AuthController {
  async signIn(req, res) {
    const { email, fcmToken } = req.body;
    if (!email || !fcmToken) {
      return res.status(400).json({ message: 'Email and FCM token are required.' });
    }
    try {
      const userSnap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
      let user;
      if (userSnap.empty) {
        // Create user if not found
        const userRef = await db.collection(USERS_COLLECTION).add({ email, fcmToken, createdAt: new Date() });
        user = { id: userRef.id, email, fcmToken };
      } else {
        const doc = userSnap.docs[0];
        user = { id: doc.id, ...doc.data() };
        await db.collection(USERS_COLLECTION).doc(user.id).update({ fcmToken });
        user.fcmToken = fcmToken;
      }
      return res.status(200).json({ message: 'User signed in successfully.', user });
    } catch (error) {
      return res.status(500).json({ message: 'Error signing in user.', error });
    }
  }

  async register(req, res) {
    try {
      const { email, fcmToken } = req.body;
      if (!email || !fcmToken) {
        return res.status(400).json({ message: 'Email and FCM token are required.' });
      }
      const userSnap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
      if (!userSnap.empty) {
        return res.status(409).json({ message: 'User already exists.' });
      }
      const userRef = await db.collection(USERS_COLLECTION).add({ email, fcmToken, createdAt: new Date() });
      return res.status(201).json({ message: 'User registered successfully.', user: { id: userRef.id, email, fcmToken } });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}

module.exports = AuthController;