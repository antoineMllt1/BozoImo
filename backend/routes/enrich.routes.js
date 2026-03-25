const express = require('express');
const router = express.Router();
const enrichController = require('../controllers/enrich.controller');

router.post('/', enrichController.enrichArea);

module.exports = router;
