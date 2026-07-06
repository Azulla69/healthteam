const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Загруженные фото храним в той же папке, что и data.json (на подключённом Railway Volume),
// чтобы они тоже не терялись при передеплое.
const UPLOADS_DIR = path.join(db.DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('not_an_image'));
    cb(null, true);
  }
});

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

// ---------- Фото товара ----------
router.post('/:id/image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message === 'not_an_image' ? 'not_an_image' : 'upload_failed' });
    const product = db.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'not_found' });
    if (!req.file) return res.status(400).json({ error: 'no_file' });

    // Удаляем старое фото, если было своё (не внешняя ссылка)
    if (product.image_url && product.image_url.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(product.image_url));
      fs.unlink(oldPath, () => {});
    }
    const updated = db.updateProduct(req.params.id, { image_url: `/uploads/${req.file.filename}` });
    res.json(db.sanitizeProduct(updated, true));
  });
});

router.delete('/:id/image', requireAdmin, (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  if (product.image_url && product.image_url.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(product.image_url));
    fs.unlink(oldPath, () => {});
  }
  const updated = db.updateProduct(req.params.id, { image_url: '' });
  res.json(db.sanitizeProduct(updated, true));
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
