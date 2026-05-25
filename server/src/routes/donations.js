const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireAdminOrSynagogue } = require('../middleware/auth');
const { sendReceiptEmail } = require('../services/email.service');

const prisma = new PrismaClient();

// GET /api/donations
router.get('/', requireAdminOrSynagogue, async (req, res) => {
  try {
    const where =
      req.user.role === 'synagogue'
        ? { synagogueId: req.user.synagogueId }
        : req.query.synagogueId
          ? { synagogueId: req.query.synagogueId }
          : {};
    const { limit = 100, offset = 0, status } = req.query;
    if (status) where.paymentStatus = status;

    const donations = await prisma.donation.findMany({
      where,
      include: { synagogue: { select: { synagogueName: true, city: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donations/:id/receipt
router.post('/:id/receipt', requireAdminOrSynagogue, async (req, res) => {
  try {
    const donation = await prisma.donation.findUnique({
      where: { id: req.params.id },
      include: { synagogue: true },
    });
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (req.user.role === 'synagogue' && donation.synagogueId !== req.user.synagogueId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!donation.donorEmail) return res.status(400).json({ error: 'No donor email' });

    await sendReceiptEmail(donation, donation.synagogue);
    await prisma.donation.update({ where: { id: donation.id }, data: { receiptSent: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
