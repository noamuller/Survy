const config = {
  PORT: process.env.PORT || 3000,
  QUALTRICS_API_KEY: process.env.QUALTRICS_API_KEY || 'your-qualtrics-api-key',
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || 'your-fcm-server-key',
};

module.exports = config;