const express = require('express');
const router = express.Router();
const dossiersController = require('../controllers/dossiers.controller');
const { requireAuth } = require('../utils/auth');

router.use(requireAuth); // toutes les routes dossiers exigent un compte

/**
 * @route   GET /api/dossiers
 * @desc    Lister les dossiers du compte courant
 */
router.get('/', dossiersController.list);

/**
 * @route   PUT /api/dossiers/:id
 * @desc    Créer ou mettre à jour un dossier (upsert)
 */
router.put('/:id', dossiersController.upsert);

/**
 * @route   DELETE /api/dossiers/:id
 * @desc    Supprimer un dossier
 */
router.delete('/:id', dossiersController.remove);

module.exports = router;
