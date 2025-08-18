const admin = require('./firebaseAdmin..js');

class FCMService {
  static sendPushNotification(token, title, body) {
    const message = {
      notification: { title, body },
      token,
    };
    return admin.messaging().send(message);
  }
}

module.exports = FCMService;