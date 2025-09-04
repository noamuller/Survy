const { admin } = require('./firebaseAdmin..js');
const { getMessaging } = require('firebase-admin/messaging');

class FCMService {
  static sendPushNotification(token, title, body) {
    const message = {
      notification: { title, body },
      token,
    };
    // For firebase-admin v10+
    return getMessaging(admin.app()).send(message);
  }
}

module.exports = FCMService;