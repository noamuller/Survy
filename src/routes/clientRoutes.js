const express = require('express');
const ClientController = require('../controllers/clientController');
const { db } = require('../services/firebaseAdmin..js');

const router = express.Router();
const clientController = new ClientController();

router.post('/signup', clientController.signUp.bind(clientController));
router.post('/signin', clientController.signIn.bind(clientController));
router.put('/:clientId', clientController.updateQualtricsInfo.bind(clientController));

router.get('/:clientId/active-surveys', async (req, res) => {
  try {
    const clientSnap = await db.collection('clients').doc(req.params.clientId).get();
    if (!clientSnap.exists) return res.status(404).json({ message: 'Client not found' });
    const client = clientSnap.data();
    res.json(client.activeSurveys || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching active surveys', error: err });
  }
});

module.exports = router;