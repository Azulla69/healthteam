const express = require('express');
const ai = require('../ai');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/chat', requireAdmin, async (req, res) => {
  if (!ai.HAS_AI) return res.status(503).json({ error: 'ai_not_configured' });
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length > 60) {
    return res.status(400).json({ error: 'bad_messages' });
  }
  try {
    const safeMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const reply = await ai.askAdminAssistant(safeMessages);
    res.json({ reply });
  } catch (e) {
    console.error('Ошибка чата с ассистентом для админов:', e.message);
    res.status(500).json({ error: 'ai_error' });
  }
});

module.exports = router;
