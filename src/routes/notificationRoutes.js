const express = require('express');
const NotificationControllerClass = require('../controllers/notificationController');

const router = express.Router();
const notificationController = new NotificationControllerClass();

router.post('/send-notification', notificationController.sendSurveyNotification.bind(notificationController));

module.exports = router;