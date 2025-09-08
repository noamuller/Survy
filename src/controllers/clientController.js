const { db } = require('../services/firebaseAdmin..js');
const bcrypt = require('bcrypt');

class ClientController {
  async signUp(req, res) {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email and password are required.' });
      }
      const existingClientSnap = await db.collection('clients').where('email', '==', email).get();
      if (!existingClientSnap.empty) {
        return res.status(409).json({ message: 'Client already exists.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const clientRef = await db.collection('clients').add({
        username,
        email,
        passwordHash,
        createdAt: new Date(),
      });
      return res.status(201).json({ message: 'Client registered successfully.', client: { id: clientRef.id, username, email } });
    } catch (error) {
      console.error('Error in client signup:', error);
      return res.status(500).json({ message: 'Error signing up client.', error });
    }
  }

  async signIn(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
      }
      const clientSnap = await db.collection('clients').where('username', '==', username).get();
      if (clientSnap.empty) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      const client = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() };
      const isPasswordValid = await bcrypt.compare(password, client.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      return res.status(200).json({ message: 'Login successful!', client });
    } catch (error) {
      return res.status(500).json({ message: 'Error logging in client.', error });
    }
  }

  async updateQualtricsInfo(req, res) {
    try {
      const clientId = req.params.clientId || req.params.id;
      const { qualtricsApiKey, qualtricsDatacenter, directoryId } = req.body;
      const updateData = {};
      if (qualtricsApiKey) updateData.qualtricsApiKey = qualtricsApiKey;
      if (qualtricsDatacenter) updateData.qualtricsDatacenter = qualtricsDatacenter;
      if (directoryId) updateData.directoryId = directoryId;
      await db.collection('clients').doc(clientId).update(updateData);
      const updatedClientSnap = await db.collection('clients').doc(clientId).get();
      const updatedClient = { id: updatedClientSnap.id, ...updatedClientSnap.data() };
      res.status(200).json(updatedClient);
    } catch (error) {
      res.status(500).json({ message: 'Error updating client Qualtrics info', error });
    }
  }
}

module.exports = ClientController;