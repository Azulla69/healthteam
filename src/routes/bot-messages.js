const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Описание каждого шаблона — где используется и какие плейсхолдеры доступны (для подсказки в интерфейсе)
const TEMPLATE_META = {
  welcome: { label: 'Приветствие (/start)', hint: 'Показывается при первом входе в чат с ботом', vars: [] },
  assistant_intro: { label: 'Приветствие бота-консультанта', hint: 'Показывается при переходе из кнопки «Бот-консультант» в приложении', vars: [] },
  order_review_request: { label: 'Просьба оставить отзыв', hint: 'Отправляется, когда заказ переходит в статус «Выполнено»', vars: ['order_id'] },
  order_placed_thankyou: { label: 'Спасибо за заказ', hint: 'Отправляется сразу при оформлении заказа', vars: ['order_id'] },
  dosage_advice_header: { label: 'Рекомендации по приёму — заголовок', hint: 'Идёт перед списком купленных товаров с дозировкой', vars: [] },
  dosage_advice_footer: { label: 'Рекомендации по приёму — концовка', hint: 'Идёт после списка, перед кнопкой «Включить напоминания»', vars: [] },
  reminder_message: { label: 'Напоминание о приёме', hint: 'Отправляется по расписанию (утро/день/вечер)', vars: ['slot', 'items'] },
  idle_nudge: { label: '«Ты ничего не выбрал»', hint: 'Через 10 минут после открытия приложения, если ничего не произошло', vars: [] },
  cart_nudge: { label: '«Корзина не оформлена»', hint: 'Через 30 минут после добавления в корзину, если заказ не оформлен', vars: [] },
  webapp_nudge: { label: '«Ты не открыл приложение»', hint: 'Через час после переписки с ботом, если человек ни разу не открывал веб-приложение', vars: [] },
  admin_new_order: { label: 'Уведомление админам о новом заказе', hint: 'Отправляется всем ID из ADMIN_IDS при оформлении заказа', vars: ['order_id', 'buyer_name', 'buyer_username', 'phone', 'items', 'total'] }
};

router.get('/', requireAdmin, (req, res) => {
  const templates = db.getAllTemplates();
  const items = Object.keys(TEMPLATE_META).map(key => ({
    key, text: templates[key] ?? '', ...TEMPLATE_META[key]
  }));
  res.json(items);
});

router.put('/:key', requireAdmin, (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'text_required' });
  const result = db.setTemplate(req.params.key, text);
  if (result.error) return res.status(404).json(result);
  res.json({ ok: true });
});

router.post('/:key/reset', requireAdmin, (req, res) => {
  const result = db.resetTemplate(req.params.key);
  if (result.error) return res.status(404).json(result);
  res.json({ ok: true, text: db.getTemplate(req.params.key) });
});

module.exports = router;
