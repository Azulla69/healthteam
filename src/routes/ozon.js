const express = require('express');
const db = require('../db');
const { fetchOzonPrice, searchOzonProduct } = require('../ozon-scraper');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireAdmin, (req, res) => {
  res.json(db.getOzonComparison());
});

// Ищет товар на Ozon по названию — НЕ сохраняет автоматически, только возвращает найденное на подтверждение
router.post('/search/:id', requireAdmin, async (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  const query = [product.brand, product.name].filter(Boolean).join(' ');
  try {
    const result = await searchOzonProduct(query);
    res.json(result);
  } catch (e) {
    console.error('Ошибка поиска на Ozon:', e.message);
    res.status(404).json({ error: e.message });
  }
});

async function checkOne(id) {
  const product = db.getProduct(id);
  if (!product || !product.ozon_url) return;
  try {
    const price = await fetchOzonPrice(product.ozon_url);
    db.recordOzonCheckResult(id, { price, status: 'ok' });
  } catch (e) {
    db.recordOzonCheckResult(id, { status: 'failed', error: e.message });
  }
}

router.post('/check/:id', requireAdmin, async (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  if (!product.ozon_url) return res.status(400).json({ error: 'no_ozon_url' });
  await checkOne(req.params.id);
  res.json(db.getOzonComparison().find(p => p.id === Number(req.params.id)));
});

router.post('/check-all', requireAdmin, async (req, res) => {
  const withUrl = db.getProducts({}).filter(p => p.ozon_url);
  // Отвечаем сразу, проверка идёт в фоне — их может быть много, а сама проверка не быстрая
  res.json({ started: true, count: withUrl.length });
  for (const p of withUrl) {
    await checkOne(p.id);
    await new Promise(r => setTimeout(r, 1500)); // не долбим Ozon запросами подряд
  }
});

module.exports = { router, checkOne };
