const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(db.getBotChatLogs({ page, pageSize: 30 }));
});

module.exports = router;
