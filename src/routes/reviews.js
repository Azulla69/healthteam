const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(db.getReviews({ page, pageSize: 10 }));
});

module.exports = router;
