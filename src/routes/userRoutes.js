const express = require('express');
const UserController = require('../controllers/userController');
const userService = require('../services/userService');

const router = express.Router();
const userController = new UserController(userService);

router.post('/signup', userController.signUp.bind(userController));
router.post('/signin', userController.signIn.bind(userController));
router.put('/:id/qualtrics', userController.updateQualtricsInfo.bind(userController));

module.exports = router;