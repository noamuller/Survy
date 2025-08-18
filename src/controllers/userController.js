const db = require('../services/firebaseAdmin..js');
const bcrypt = require('bcrypt');
const USERS_COLLECTION = 'users';

class UserController {
  async signUp(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }
      const userSnap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
      if (!userSnap.empty) {
        return res.status(409).json({ message: 'User already exists.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const userRef = await db.collection(USERS_COLLECTION).add({
        email,
        passwordHash,
        createdAt: new Date(),
      });
      return res.status(201).json({ message: 'User registered successfully.', user: { id: userRef.id, email } });
    } catch (error) {
      return res.status(500).json({ message: 'Error signing up user.', error });
    }
  }

  async signIn(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }
      const userSnap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
      if (userSnap.empty) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      const doc = userSnap.docs[0];
      const user = { id: doc.id, ...doc.data() };
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      // Optionally, return a session token here
      return res.status(200).json({ message: 'User signed in successfully.', user: { id: user.id, email: user.email } });
    } catch (error) {
      return res.status(500).json({ message: 'Error signing in user.', error });
    }
  }

  async updateQualtricsInfo(req, res) {
    try {
      const userId = req.params.id;
      const { qualtricsApiKey, qualtricsDatacenter, directoryId, fcmToken } = req.body;
      const updateData = {};
      if (qualtricsApiKey) updateData.qualtricsApiKey = qualtricsApiKey;
      if (qualtricsDatacenter) updateData.qualtricsDatacenter = qualtricsDatacenter;
      if (directoryId) updateData.directoryId = directoryId;
      if (fcmToken) updateData.fcmToken = fcmToken;
      await db.collection(USERS_COLLECTION).doc(userId).update(updateData);
      const updatedUserSnap = await db.collection(USERS_COLLECTION).doc(userId).get();
      const updatedUser = { id: updatedUserSnap.id, ...updatedUserSnap.data() };
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: 'Error updating user Qualtrics info', error });
    }
  }
}

module.exports = UserController;