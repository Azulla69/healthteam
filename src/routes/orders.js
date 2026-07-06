const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function errorResponse(res, result) {
  const map = {
    too_many_active_orders: 400, insufficient_stock: 400, not_editable: 400,
    not_cancellable: 400, not_found: 404, bad_transition: 400, admin_comment_required: 400
  };
  const status = map[result.error] || 400;
  return res.status(status).json(result);
}

router.post('/', requireAuth, (req, res) => {
  const { items, comment, phone, address } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'empty_cart' });
  const result = db.createOrder({
    user_id: req.user.id, items, comment,
    phone: phone || req.user.phone, address: address || req.user.address
  });
  if (result.error) return errorResponse(res, result);
  res.status(201).json(result.order);
});

router.get('/my', requireAuth, (req, res) => res.json(db.getOrdersByUser(req.user.id)));
router.get('/', requireAuth, requireAdmin, (req, res) => res.json(db.getAllOrders()));

router.put('/:id', requireAuth, (req, res) => {
  const order = db.getOrderRaw(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.user_id !== req.user.id && !req.isAdmin) return res.status(403).json({ error: 'forbidden' });
  const result = db.updateOrder(req.params.id, req.body);
  if (result.error) return errorResponse(res, result);
  res.json(result.order);
});

router.delete('/:id', requireAuth, (req, res) => {
  const order = db.getOrderRaw(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.user_id !== req.user.id && !req.isAdmin) return res.status(403).json({ error: 'forbidden' });
  const result = db.cancelOrder(req.params.id);
  if (result.error) return errorResponse(res, result);
  res.json({ deleted: true });
});

// "В обработке" -> "Доставляем" (админ обязательно указывает время/место доставки)
router.put('/:id/deliver', requireAuth, requireAdmin, (req, res) => {
  const result = db.moveToDelivering(req.params.id, req.body.admin_comment);
  if (result.error) return errorResponse(res, result);
  res.json(result.order);
});

// "Доставляем" -> "Выполнено"
router.put('/:id/complete', requireAuth, requireAdmin, (req, res) => {
  const result = db.moveToCompleted(req.params.id);
  if (result.error) return errorResponse(res, result);
  res.json(result.order);
});

// Отметка оплаты (не меняет статус, просто флаг)
router.put('/:id/paid', requireAuth, requireAdmin, (req, res) => {
  const result = db.setOrderPaid(req.params.id, req.body.paid);
  if (result.error) return errorResponse(res, result);
  res.json(result.order);
});

module.exports = router;
