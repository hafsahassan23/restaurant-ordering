const express = require('express');
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const photoService = require('../services/photoService');

const router = express.Router();

// Photos are sent as base64 JSON, so this route accepts a larger body than the rest of the API
router.use(express.json({ limit: '4mb' }));
router.use(authenticate, authorize('manager'));

/** POST /api/menu-admin/photos { dataUrl: "data:image/jpeg;base64,..." } -> 201 { url } (manager only) */
router.post('/', async (req, res) => {
  const { dataUrl } = z.object({ dataUrl: z.string().min(30).max(4 * 1024 * 1024) }).parse(req.body);
  res.status(201).json(await photoService.saveDishPhoto(dataUrl, req.user, req.ip));
});

module.exports = router;
