const express = require('express');
const UserController = require('../controllers/userController');
const userService = require('../services/userService');

const router = express.Router();
const userController = new UserController(userService);

// Create user (no password, supports multiple emails)
router.post('/', userController.createUser.bind(userController));
// Get user by ID
router.get('/:id', userController.getUser.bind(userController));
// Add email to user
router.post('/:id/emails', userController.addEmail.bind(userController));
// Remove email from user
router.delete('/:id/emails', userController.removeEmail.bind(userController));
// Update Qualtrics info
// Delete user
router.delete('/:id', userController.deleteUser.bind(userController));

module.exports = router;