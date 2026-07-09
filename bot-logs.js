const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(db.getReviews({ page, pageSize: 10 }));
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.deleteReview(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json({ deleted: true });
});

module.exports = router;
