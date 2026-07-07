const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Создаёт сессию подбора после прохождения опроса — привязывает конкретный набор товаров
// к пользователю, чтобы потом можно было безопасно проверить право на скидку при заказе
router.post('/session', requireAuth, (req, res) => {
  const { product_ids } = req.body;
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids_required' });
  }
  const session = db.createConsultantSession(req.user.id, product_ids);
  res.status(201).json({ sessionId: session.id, rate: db.CONSULTANT_DISCOUNT_RATE, productIds: session.product_ids });
});

module.exports = router;
