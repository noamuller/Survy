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
const mongoose = require("mongoose");
const config = require("../src/config"); // Adjust path if needed

// Import your routes
const authRoutes = require("../src/routes/authRoutes");
const notificationRoutes = require("../src/routes/notificationRoutes");
const userRoutes = require("../src/routes/userRoutes");
const clientRoutes = require("../src/routes/clientRoutes");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use your routes
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);

// Connect to MongoDB (only once per cold start)
mongoose.connect(config.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Export the Express app as a Firebase Function
exports.api = onRequest(app);
