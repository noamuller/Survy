const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const { QualtricsService } = require('./services/qualtricsService');
const path = require('path');
const config = require('./config');
const clientRoutes = require('./routes/clientRoutes');
const { db } = require('./services/firebaseAdmin..js');




const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Always serve index.html for the root route

// Endpoint to get all user emails
app.get('/api/users', async (req, res) => {
  try {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(doc => ({ email: doc.data().email })).filter(u => u.email);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// Endpoint to send a test notification to a user by email
const FCMService = require('./services/fcmService');
app.post('/api/notifications/test', async (req, res) => {
  const { email, title, body } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const userSnap = await db.collection('users').where('email', '==', email).get();
    if (userSnap.empty) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userSnap.docs[0].data();
    if (!user.fcmToken) {
      return res.status(400).json({ message: 'User does not have an FCM token.' });
    }
  await FCMService.sendPushNotification(user.fcmToken, title || 'Test Notification', body || 'This is a test notification.');
    return res.status(200).json({ message: 'Notification sent.' });
  } catch (err) {
    console.error('Error sending test notification:', err.message);
    return res.status(500).json({ message: 'Error sending notification.', error: err.message });
  }
});

// Serve the HTML form at "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Poll for new surveys and distributions for each client every 5 minutes
setInterval(async () => {
  try {
    const clientsSnap = await db.collection('clients').get();
    const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    for (const client of clients) {
      if (!client.qualtricsApiKey || !client.qualtricsDatacenter) continue;
      const qualtricsService = new QualtricsService(client.qualtricsApiKey, client.qualtricsDatacenter);
      // Poll surveys for this client
      try {
        const surveys = await qualtricsService.getSurveys();
        console.log(`Surveys for client ${client.name}:`, surveys);
        // For each survey, poll distributions
          for (const survey of surveys) {
            try {
              const distributions = await qualtricsService.getDistributions(survey.id);
              if (distributions && distributions.length > 0) {
                const lastDistribution = distributions.reduce((latest, dist) => {
                  return new Date(dist.sendDate) > new Date(latest.sendDate) ? dist : latest;
                }, distributions[0]);
                console.log(`Last distribution for survey ${survey.id} (client ${client.name}):`, lastDistribution);
              } else {
                console.log(`No distributions found for survey ${survey.id} (client ${client.name})`);
              }
              // TODO: Process new distributions and send push notifications here
            } catch (error) {
              console.error(`Error polling distributions for survey ${survey.id} (client ${client.name}):`, error.message);
            }
          }
      } catch (error) {
        console.error(`Error polling surveys for client ${client.name}:`, error.message);
      }
      // Optionally update activeSurveys for the client
      try {
        await qualtricsService.updateClientActiveSurveys(client.id);
        console.log(`Updated activeSurveys for client: ${client.name}`);
      } catch (err) {
        console.error(`Error updating activeSurveys for client ${client.name}:`, err.message);
      }
    }
    console.log('All clients processed at', new Date().toLocaleString());
  } catch (err) {
    console.error('Error fetching clients:', err);
  }
  }, 30 * 1000); // 30 seconds in milliseconds

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add this line BEFORE your routes:
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to add new Qualtrics API key and data center
app.post('/api/qualtrics-keys', (req, res) => {
  const { apiKey, dataCenter } = req.body;
  if (!apiKey || !dataCenter) {
    return res.status(400).send('Missing apiKey or dataCenter');
  }
  qualtricsConfigs.push({ apiKey, dataCenter });
  res.send('API key and data center added!');
});

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});