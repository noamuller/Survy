const config = {
  PORT: process.env.PORT || 3000,
  QUALTRICS_API_KEY: process.env.QUALTRICS_API_KEY || 'your-qualtrics-api-key',
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || 'your-fcm-server-key',
  CHECK_INTERVAL_MS: process.env.CHECK_INTERVAL_MS ? parseInt(process.env.CHECK_INTERVAL_MS) : 5 * 60 * 1000, // 5 minutes
};

module.exports = config;