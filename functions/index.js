const { onSchedule } = require('firebase-functions/v2/scheduler');
const { checkAllClientsQualtrics } = require('./services/qualtricsService');
const { db } = require('./services/firebaseAdmin..js');
const FCMService = require('./services/fcmService');
const path = require('path');
const config = require('../src/config');
const { CHECK_INTERVAL_MS } = config;

exports.scheduledQualtricsCheck = onSchedule(
	{
		schedule: `every ${Math.ceil(CHECK_INTERVAL_MS / 60000)} minutes`,
		timeZone: 'UTC'
	},
	async (event) => {
		console.log('Running scheduled Qualtrics check for all clients...');
		await checkAllClientsQualtrics(CHECK_INTERVAL_MS);
		return null;
	}
);
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const bodyParser = require("body-parser");


// Import your routes
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const userRoutes = require("./routes/userRoutes");
const clientRoutes = require("./routes/clientRoutes");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use your routes
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);



// Export the Express app as a Firebase Function
exports.api = onRequest(app);
