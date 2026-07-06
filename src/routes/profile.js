const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  const stats = db.getUserStats(req.user.id);
  res.json({ ...req.user, isAdmin: req.isAdmin, stats });
});

// Разрешаем редактировать имя/фамилию/телефон/адрес — это заполняется один раз
// и дальше переиспользуется при оформлении заказа, чтобы не вводить каждый раз заново.
router.put('/me', requireAuth, (req, res) => {
  const { first_name, last_name, phone, address } = req.body;
  const fields = {};
  if (first_name !== undefined) fields.first_name = first_name;
  if (last_name !== undefined) fields.last_name = last_name;
  if (phone !== undefined) fields.phone = phone;
  if (address !== undefined) fields.address = address;

  const updated = db.updateUser(req.user.id, fields);
  const stats = db.getUserStats(req.user.id);
  res.json({ ...updated, isAdmin: req.isAdmin, stats });
});

module.exports = router;
