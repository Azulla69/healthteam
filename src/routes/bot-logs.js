const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  res.json(db.getBotChatUsers());
});

router.get('/:telegramId', requireAdmin, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(db.getBotChatLogsForUser(req.params.telegramId, { page, pageSize: 50 }));
});

module.exports = router;
