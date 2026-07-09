const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const users = db.getAllUsers().map(u => ({ ...u, stats: db.getUserStats(u.id) }));
  res.json(users);
});

router.get('/:id', requireAdmin, (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ ...user, stats: db.getUserStats(user.id), bonus: db.getBonusInfo(user), orders: db.getOrdersByUser(user.id) });
});

router.put('/:id/note', requireAdmin, (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const updated = db.updateUser(user.id, { admin_note: (req.body.note || '').trim() });
  res.json({ admin_note: updated.admin_note });
});

// Ручное оформление продажи (товар продан не через бота, но нужно учесть в бухгалтерии и на складе)
router.post('/:id/manual-order', requireAdmin, (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { items, description, discount } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'empty_items' });
  const result = db.createManualOrder({ user_id: user.id, items, description, discount });
  if (result.error) return res.status(400).json(result);

  const order = result.order;
  db.addNotification(
    user.id, 'Заказ выполнен 🎉',
    `Заказ №${order.id} оформлен. Оцените заказ и получите 50 бонусов!`,
    { type: 'review_prompt', order_id: order.id }
  );
  require('../bot').notifyOrderCompleted(user.telegram_id, order.id).catch(() => {});
  sendDosageAdviceAsync(order, user);

  res.status(201).json(order);
});

// Не блокируем ответ админу — генерация через ИИ может занять пару секунд
async function sendDosageAdviceAsync(order, buyer) {
  try {
    const ai = require('../ai');
    if (!ai.HAS_AI) return;
    const advice = await ai.generateDosageAdvice(order.items);
    if (!advice || advice.length === 0) return;
    advice.forEach(a => {
      const matchedItem = order.items.find(i => i.name.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(i.name.toLowerCase()));
      db.addReminderItem(buyer.id, {
        name: a.name, dosage_qty: a.dosage_qty, dosage_unit: a.dosage_unit,
        timing: a.timing, food_relation: a.food_relation,
        source: 'purchase', order_id: order.id, product_id: matchedItem ? matchedItem.product_id : null
      });
    });
    await require('../bot').notifyDosageAdvice(buyer.telegram_id, advice);
  } catch (e) {
    console.error('Ошибка генерации/отправки рекомендаций по приёму:', e.message);
  }
}

module.exports = router;
