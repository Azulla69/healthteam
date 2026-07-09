const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Вызывается при открытии приложения — если через 10 минут ничего не произойдёт, придёт напоминание
router.post('/ping', requireAuth, (req, res) => {
  db.pingAppOpen(req.user.id);
  res.json({ ok: true });
});

// Вызывается при добавлении товара в корзину — если через 30 минут заказ не оформлен, придёт напоминание
router.post('/cart-touch', requireAuth, (req, res) => {
  db.touchCart(req.user.id, req.body.items);
  res.json({ ok: true });
});

module.exports = router;
