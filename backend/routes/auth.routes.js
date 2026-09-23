const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../utils/auth');

/**
 * @route   POST /api/auth/signup
 * @desc    Créer un compte agent (code d'invitation requis si BETA_INVITE_CODE est défini)
 * @access  Public
 */
router.post('/signup', authController.signup);

/**
 * @route   POST /api/auth/login
 * @desc    Se connecter
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Profil du compte courant
 * @access  Privé
 */
router.get('/me', requireAuth, authController.me);

module.exports = router;
