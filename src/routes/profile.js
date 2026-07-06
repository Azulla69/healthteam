const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  const stats = db.getUserStats(req.user.id);
  res.json({ ...req.user, isAdmin: req.isAdmin, stats, bonus: db.getBonusInfo(req.user) });
});

router.put('/me', requireAuth, (req, res) => {
  const { first_name, last_name, phone, address, birth_date } = req.body;

  if (birth_date !== undefined) {
    const cooldown = db.checkBirthDateCooldown(req.user, birth_date);
    if (!cooldown.allowed) {
      return res.status(400).json({ error: 'birthdate_cooldown', nextAllowedAt: cooldown.nextAllowedAt });
    }
  }

  const fields = {};
  if (first_name !== undefined) fields.first_name = first_name;
  if (last_name !== undefined) fields.last_name = last_name;
  if (phone !== undefined) fields.phone = phone;
  if (address !== undefined) fields.address = address;
  if (birth_date !== undefined && birth_date !== req.user.birth_date) {
    fields.birth_date = birth_date;
    fields.birth_date_updated_at = new Date().toISOString();
  }

  const updated = db.updateUser(req.user.id, fields);
  const stats = db.getUserStats(req.user.id);
  res.json({ ...updated, isAdmin: req.isAdmin, stats, bonus: db.getBonusInfo(updated) });
});

module.exports = router;
