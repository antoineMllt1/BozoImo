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
 * @desc    Profil + modèle ML du compte courant
 * @access  Privé
 */
router.get('/me', requireAuth, authController.me);

/**
 * @route   PUT /api/auth/model
 * @desc    Sauvegarder le modèle ML personnel (calibration sur ventes confirmées)
 * @access  Privé
 */
router.put('/model', requireAuth, authController.updateModel);

module.exports = router;
