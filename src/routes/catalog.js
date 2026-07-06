const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const list = db.getProducts({ onlyActive: !req.isAdmin });
  res.json(list.map(p => db.sanitizeProduct(p, req.isAdmin)));
});

router.get('/:id', (req, res) => {
  const row = db.getProduct(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(db.sanitizeProduct(row, req.isAdmin));
});

// Создание нового товара (карточка) — остаток всегда стартует с 0,
// пополняется отдельно через "Добавить товар на склад"
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

router.delete('/:id', requireAdmin, (req, res) => {
  if (req.query.hard === 'true') {
    db.deleteProductHard(req.params.id);
    return res.json({ deleted: true, hard: true });
  }
  const hidden = db.hideProduct(req.params.id);
  if (!hidden) return res.status(404).json({ error: 'not_found' });
  res.json({ deleted: true, hard: false });
});

// ---------- Склад ----------
// Добавить единицы товара (обязателен срок годности)
router.post('/:id/stock/add', requireAdmin, (req, res) => {
  const { qty, expiry } = req.body;
  if (!expiry) return res.status(400).json({ error: 'expiry_required' });
  const result = db.addStock(req.params.id, qty, expiry);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(db.sanitizeProduct(result.product, true));
});

// Списать единицы товара со склада
router.post('/:id/stock/remove', requireAdmin, (req, res) => {
  const { qty } = req.body;
  const result = db.removeStock(req.params.id, qty);
  if (result.error) return res.status(400).json({ error: result.error, available: result.available });
  res.json(db.sanitizeProduct(result.product, true));
});

module.exports = router;
