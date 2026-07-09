const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(db.getReminderData(req.user));
});

router.put('/slot/:slot', requireAuth, (req, res) => {
  const { time, enabled } = req.body;
  const result = db.setReminderSlot(req.user.id, req.params.slot, { time, enabled });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/items', requireAuth, (req, res) => {
  const { name, dosage_qty, dosage_unit, timing, food_relation } = req.body;
  if (!name || !Array.isArray(timing) || timing.length === 0) {
    return res.status(400).json({ error: 'name_and_timing_required' });
  }
  const item = db.addReminderItem(req.user.id, { name, dosage_qty, dosage_unit, timing, food_relation, source: 'manual' });
  res.status(201).json(item);
});

router.delete('/items/:id', requireAuth, (req, res) => {
  const result = db.deleteReminderItem(req.params.id, req.user.id);
  if (result.error) return res.status(404).json(result);
  res.json({ deleted: true });
});

module.exports = router;
