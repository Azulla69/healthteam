const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function errorResponse(res, result) {
  if (result.error === 'too_many_active_orders') {
    return res.status(400).json({ error: 'too_many_active_orders', limit: result.limit });
  }
  if (result.error === 'insufficient_stock') {
    return res.status(400).json({ error: 'insufficient_stock', product: result.product, available: result.available });
  }
  if (result.error === 'not_editable') return res.status(400).json({ error: 'not_editable' });
  if (result.error === 'not_cancellable') return res.status(400).json({ error: 'not_cancellable' });
  if (result.error === 'not_found') return res.status(404).json({ error: 'not_found' });
  return res.status(400).json({ error: result.error || 'bad_request' });
}

router.post('/', requireAuth, (req, res) => {
  const { items, comment, phone, address } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'empty_cart' });
  }
  const result = db.createOrder({
    user_id: req.user.id, items, comment,
    phone: phone || req.user.phone, address: address || req.user.address
  });
  if (result.error) return errorResponse(res, result);
  res.status(201).json(result.order);
});

router.get('/my', requireAuth, (req, res) => {
  res.json(db.getOrdersByUser(req.user.id));
});

router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getAllOrders());
});

// Пользователь редактирует свой заказ, пока статус "new" (админ тоже может, если понадобится)
router.put('/:id', requireAuth, (req, res) => {
  const order = db.getOrderRaw(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.user_id !== req.user.id && !req.isAdmin) return res.status(403).json({ error: 'forbidden' });

  const { items, address, comment } = req.body;
  const result = db.updateOrder(req.params.id, { items, address, comment });
  if (result.error) return errorResponse(res, result);
  res.json(result.order);
});

// Пользователь отменяет/удаляет свой заказ, пока статус "new"
router.delete('/:id', requireAuth, (req, res) => {
  const order = db.getOrderRaw(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.user_id !== req.user.id && !req.isAdmin) return res.status(403).json({ error: 'forbidden' });

  const result = db.cancelOrder(req.params.id, { hard: true });
  if (result.error) return errorResponse(res, result);
  res.json({ deleted: true });
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
