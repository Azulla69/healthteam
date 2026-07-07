const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const users = db.getAllUsers().map(u => ({ ...u, stats: db.getUserStats(u.id) }));
  res.json(users);
});

router.get('/:id', requireAdmin, (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ ...user, stats: db.getUserStats(user.id), bonus: db.getBonusInfo(user), orders: db.getOrdersByUser(user.id) });
});

// Ручное оформление продажи (товар продан не через бота, но нужно учесть в бухгалтерии и на складе)
router.post('/:id/manual-order', requireAdmin, (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { items, description, discount } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'empty_items' });
  const result = db.createManualOrder({ user_id: user.id, items, description, discount });
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result.order);
});

module.exports = router;
