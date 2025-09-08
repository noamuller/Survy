const { db } = require('../services/firebaseAdmin..js');
const bcrypt = require('bcrypt');
const USERS_COLLECTION = 'users';

class UserController {
  // Create a new user (no password, supports multiple emails)
  async createUser(req, res) {
    try {
      const { username, fcmToken, emails } = req.body;
      if (!username || !fcmToken || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'username, fcmToken, and emails[] are required.' });
      }
      // Check for existing user by username
      const userSnap = await db.collection(USERS_COLLECTION).where('username', '==', username).get();
      if (!userSnap.empty) {
        return res.status(409).json({ message: 'User already exists.' });
      }
      const userRef = await db.collection(USERS_COLLECTION).add({
        username,
        fcmToken,
        emails,
        createdAt: new Date(),
      });
      return res.status(201).json({ message: 'User created successfully.', user: { id: userRef.id, username, emails, fcmToken } });
    } catch (error) {
      return res.status(500).json({ message: 'Error creating user.', error });
    }
  }

  // Get user by ID
  async getUser(req, res) {
    try {
      const userId = req.params.id;
      const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }
      return res.status(200).json({ user: { id: doc.id, ...doc.data() } });
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching user.', error });
    }
  }

  // Add an email to a user
  async addEmail(req, res) {
    try {
      const userId = req.params.id;
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
      }
      const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const user = doc.data();
      const emails = Array.isArray(user.emails) ? user.emails : [];
      if (emails.includes(email)) {
        return res.status(409).json({ message: 'Email already exists for user.' });
      }
      emails.push(email);
      await db.collection(USERS_COLLECTION).doc(userId).update({ emails });
      return res.status(200).json({ message: 'Email added.', emails });
    } catch (error) {
      return res.status(500).json({ message: 'Error adding email.', error });
    }
  }

  // Remove an email from a user
  async removeEmail(req, res) {
    try {
      const userId = req.params.id;
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
      }
      const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const user = doc.data();
      let emails = Array.isArray(user.emails) ? user.emails : [];
      emails = emails.filter(e => e !== email);
      await db.collection(USERS_COLLECTION).doc(userId).update({ emails });
      return res.status(200).json({ message: 'Email removed.', emails });
    } catch (error) {
      return res.status(500).json({ message: 'Error removing email.', error });
    }
  }
  async deleteUser(req, res) {
    try {
      const userId = req.params.id;
      await db.collection(USERS_COLLECTION).doc(userId).delete();
      res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error });
    }
  }
}

module.exports = UserController;