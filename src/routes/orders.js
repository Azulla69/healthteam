const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { items, comment, phone, address } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'empty_cart' });
  }
  const order = db.createOrder({
    user_id: req.user.id,
    items,
    comment,
    phone: phone || req.user.phone,
    address: address || req.user.address
  });
  if (!order) return res.status(400).json({ error: 'no_valid_items' });
  res.status(201).json(order);
});

router.get('/my', requireAuth, (req, res) => {
  res.json(db.getOrdersByUser(req.user.id));
});

router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getAllOrders());
});

router.put('/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'confirmed', 'done', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'bad_status' });
  const updated = db.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

module.exports = router;
