const express = require('express');
const db = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(db.getReviews({ page, pageSize: 10 }));
});

router.put('/:id', requireAuth, (req, res) => {
  const { product_quality, service_quality, delivery_speed, text, anonymous } = req.body;
  const result = db.editReview(req.params.id, req.user.id, { product_quality, service_quality, delivery_speed, text, anonymous }, req.isAdmin);
  if (result.error) {
    const map = { not_found: 404, forbidden: 403, bad_rating: 400 };
    return res.status(map[result.error] || 400).json(result);
  }
  res.json(result.review);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.deleteReview(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json({ deleted: true });
});

module.exports = router;
