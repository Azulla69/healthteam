const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Обычный пользователь видит только активные товары, админ — вообще всё
router.get('/', (req, res) => {
  res.json(db.getProducts({ onlyActive: !req.isAdmin }));
});

router.get('/:id', (req, res) => {
  const row = db.getProduct(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

router.post('/', requireAdmin, (req, res) => {
  const { name, price } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name_and_price_required' });
  const created = db.createProduct(req.body);
  res.status(201).json(created);
});

router.put('/:id', requireAdmin, (req, res) => {
  const updated = db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

// Мягкое удаление по умолчанию (просто скрывает товар, история заказов не ломается).
// ?hard=true — удалить насовсем.
router.delete('/:id', requireAdmin, (req, res) => {
  if (req.query.hard === 'true') {
    db.deleteProductHard(req.params.id);
    return res.json({ deleted: true, hard: true });
  }
  const hidden = db.hideProduct(req.params.id);
  if (!hidden) return res.status(404).json({ error: 'not_found' });
  res.json({ deleted: true, hard: false });
});

module.exports = router;
