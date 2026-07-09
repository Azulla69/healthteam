const express = require('express');
const db = require('../db');
const ai = require('../ai');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/chat', requireAuth, async (req, res) => {
  if (!ai.HAS_AI) return res.status(503).json({ error: 'ai_not_configured' });
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length > 40) {
    return res.status(400).json({ error: 'bad_messages' });
  }
  try {
    const safeMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    const { text, productIds } = await ai.askConsultant(safeMessages);
    // Веб-приложение само парсит маркер на клиенте — отдаём как есть (с маркером)
    const reply = productIds ? `${text}\n[[РЕКОМЕНДАЦИЯ: ${productIds.join(',')}]]` : text;
    res.json({ reply });
  } catch (e) {
    console.error('Ошибка обращения к Groq:', e.message);
    res.status(500).json({ error: 'ai_error' });
  }
});

// Создаёт сессию подбора после разговора с ИИ — привязывает конкретный набор товаров
// к пользователю, чтобы потом можно было безопасно проверить право на скидку при заказе
router.post('/session', requireAuth, (req, res) => {
  const { product_ids } = req.body;
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids_required' });
  }
  const session = db.createConsultantSession(req.user.id, product_ids);
  res.status(201).json({ sessionId: session.id, rate: db.CONSULTANT_DISCOUNT_RATE, productIds: session.product_ids });
});

module.exports = router;
