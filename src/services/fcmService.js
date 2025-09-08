const { admin } = require('./firebaseAdmin..js');
const { getMessaging } = require('firebase-admin/messaging');

class FCMService {
  static sendPushNotification(token, title, body, surveyLink, surveyName, clientName) {
      const message = {
        notification: { title, body },
        token,
        data: {
          surveyLink: surveyLink || '',
          surveyName: surveyName || '',
          clientName: clientName || ''
        }
      };
      console.log('DEBUG: Sending FCM push notification:', JSON.stringify(message));
      // For firebase-admin v10+
      return getMessaging(admin.app()).send(message)
        .then(response => {
          console.log('DEBUG: FCM response:', response);
          return response;
        })
        .catch(error => {
          console.error('DEBUG: FCM error:', error);
          throw error;
        });
  }
}

module.exports = FCMService;