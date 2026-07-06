const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  res.json({ balance: db.getBalance(), entries: db.getLedger() });
});

router.post('/', requireAdmin, (req, res) => {
  const { type, amount, description, date } = req.body;
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'bad_type' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'bad_amount' });
  const entry = db.addLedgerEntry({ type, amount, description, date });
  res.status(201).json({ entry, balance: db.getBalance() });
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.deleteLedgerEntry(req.params.id);
  res.json({ deleted: true, balance: db.getBalance() });
});

module.exports = router;
