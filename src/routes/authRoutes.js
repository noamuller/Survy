const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();
const authController = new AuthController();

router.post('/signin', authController.signIn.bind(authController));
router.post('/register', authController.register.bind(authController));

module.exports = router;