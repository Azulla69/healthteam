const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({ ...req.user, isAdmin: req.isAdmin });
});

router.put('/me', requireAuth, (req, res) => {
  const { phone, address } = req.body;
  const updated = db.updateUser(req.user.id, { phone: phone || '', address: address || '' });
  res.json({ ...updated, isAdmin: req.isAdmin });
});

module.exports = router;
