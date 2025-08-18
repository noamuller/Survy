const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const { QualtricsService } = require('./services/qualtricsService');
const path = require('path');
const config = require('./config');
const clientRoutes = require('./routes/clientRoutes');
const db = require('./services/firebaseAdmin..js');

const app = express();
const port = process.env.PORT || 3000;

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
            console.log(`Distributions for survey ${survey.id} (client ${client.name}):`, distributions);
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
}, 1 * 60 * 1000); // 1 minute in milliseconds

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