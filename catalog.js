const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function referralInfo(user) {
  const referrals = db.getAllUsers().filter(u => u.referred_by === user.telegram_id);
  return {
    code: user.telegram_id,
    referredCount: referrals.length,
    milestonesAwarded: user.referral_milestones_awarded || [],
    rate: db.REFERRAL_RATE, qualifyMin: db.REFERRAL_QUALIFY_MIN, ladder: db.REFERRAL_LADDER
  };
}

router.get('/me', requireAuth, (req, res) => {
  const stats = db.getUserStats(req.user.id);
  res.json({
    ...req.user, isAdmin: req.isAdmin, stats,
    bonus: db.getBonusInfo(req.user),
    birthdayDiscount: db.getBirthdayDiscountInfo(req.user),
    referral: referralInfo(req.user),
    unreadNotifications: db.getUnreadNotificationsCount(req.user.id)
  });
});

router.put('/me', requireAuth, (req, res) => {
  const { first_name, last_name, phone, address, birth_date } = req.body;

  if (birth_date !== undefined) {
    const cooldown = db.checkBirthDateCooldown(req.user, birth_date);
    if (!cooldown.allowed) {
      return res.status(400).json({ error: 'birthdate_cooldown', nextAllowedAt: cooldown.nextAllowedAt });
    }
  }

  const fields = {};
  if (first_name !== undefined) fields.first_name = first_name;
  if (last_name !== undefined) fields.last_name = last_name;
  if (phone !== undefined) fields.phone = phone;
  if (address !== undefined) fields.address = address;
  if (birth_date !== undefined && birth_date !== req.user.birth_date) {
    fields.birth_date = birth_date;
    fields.birth_date_updated_at = new Date().toISOString();
  }

  const updated = db.updateUser(req.user.id, fields);
  const stats = db.getUserStats(req.user.id);
  res.json({
    ...updated, isAdmin: req.isAdmin, stats,
    bonus: db.getBonusInfo(updated),
    birthdayDiscount: db.getBirthdayDiscountInfo(updated),
    referral: referralInfo(updated)
  });
});

// Привязка к пригласившему — вызывается один раз, при первом открытии по реферальной ссылке
router.post('/referral', requireAuth, (req, res) => {
  const { ref_code } = req.body;
  if (!ref_code) return res.status(400).json({ error: 'ref_code_required' });
  const result = db.setReferrer(req.user.id, ref_code);
  if (result.error) return res.status(400).json(result);
  res.json({ ok: true });
});

router.get('/bonus-history', requireAuth, (req, res) => {
  res.json(db.getBonusHistory(req.user.id).map(t => ({ ...t, label: db.TX_LABELS[t.type] || t.type })));
});

router.get('/notifications', requireAuth, (req, res) => {
  res.json({ items: db.getNotifications(req.user.id), unread: db.getUnreadNotificationsCount(req.user.id) });
});

router.post('/notifications/read-all', requireAuth, (req, res) => {
  db.markAllNotificationsRead(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
