const { db } = require('../services/firebaseAdmin..js');
const FCMService = require('../services/fcmService');

class NotificationController {
  async sendSurveyNotification(req, res) {
    const { email, surveyLink } = req.body;

    try {
      const userSnap = await db.collection('users').where('email', '==', email).get();
      if (userSnap.empty) {
        return res.status(404).json({ message: 'User not found' });
      }
      const user = userSnap.docs[0].data();
      const fcmToken = user.fcmToken;
      if (!fcmToken) {
        return res.status(400).json({ message: 'FCM token not available' });
      }

      await FCMService.sendPushNotification(
        fcmToken,
        'New Survey Available',
        `You have a new survey to complete: ${surveyLink}`
      );

      return res.status(200).json({ message: 'Notification sent successfully' });
    } catch (error) {
      console.error('Error sending notification:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = NotificationController;