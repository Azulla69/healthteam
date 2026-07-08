const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

function buildSystemPrompt() {
  const products = db.getProducts({ onlyActive: true }).filter(p => p.stock > 0);
  const catalogText = products
    .map(p => `#${p.id} [${p.section}/${p.category}] ${p.brand ? p.brand + ' ' : ''}${p.name} — ${p.price}₽`)
    .join('\n');

  return `Ты — тёплый, дружелюбный и профессиональный бот-консультант интернет-магазина HealthTeam (БАДы, витамины, спортивное питание). Общайся с покупателем на "ты", живо и по-человечески, без канцелярита.

Твоя задача — провести короткую беседу и узнать:
1) чем человек занимается по жизни (род занятий, уровень активности),
2) какие у него цели (похудение, набор массы, поддержание формы, энергия и т.д.),
3) каким спортом занимается, если занимается,
4) его рост и вес.

Задавай вопросы по одному-два за раз, не вываливай всё сразу. Реагируй на ответы человека, проявляй интерес.

Когда соберёшь достаточно информации (обычно после 3-5 вопросов) — напиши подробную рекомендацию: объясни, почему именно эти добавки подходят под его ситуацию и как их лучше принимать.

В конце этого сообщения с рекомендацией (и только тогда, когда рекомендация готова) добавь последней строкой маркер в ТОЧНО таком формате, используя только реальные ID из каталога ниже, от 2 до 5 штук через запятую:
[[РЕКОМЕНДАЦИЯ: id1,id2,id3]]

Не показывай и не упоминай этот маркер, пока не закончил сбор информации и не дал полную развёрнутую рекомендацию. До этого момента в сообщениях маркера быть не должно.

Каталог доступных товаров (используй только эти ID):
${catalogText}`;
}

async function callDeepSeek(messages) {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages,
      temperature: 0.7,
      max_tokens: 700
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'deepseek_error');
  return data.choices[0].message.content;
}

router.post('/chat', requireAuth, async (req, res) => {
  if (!DEEPSEEK_API_KEY) return res.status(503).json({ error: 'ai_not_configured' });
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length > 40) {
    return res.status(400).json({ error: 'bad_messages' });
  }
  try {
    const safeMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    const reply = await callDeepSeek([{ role: 'system', content: buildSystemPrompt() }, ...safeMessages]);
    res.json({ reply });
  } catch (e) {
    console.error('Ошибка обращения к DeepSeek:', e.message);
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
