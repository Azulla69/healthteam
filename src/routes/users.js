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
  res.json({ ...user, stats: db.getUserStats(user.id), orders: db.getOrdersByUser(user.id) });
});

module.exports = router;
