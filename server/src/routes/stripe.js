const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { createCheckoutSession, handleWebhookEvent } = require('../services/stripe.service');

const prisma = new PrismaClient();

// POST /api/stripe/checkout
router.post('/checkout', async (req, res) => {
  try {
    const { amount, donationType, donorInfo, synagogueId } = req.body;
    if (!amount || !synagogueId) return res.status(400).json({ error: 'amount and synagogueId required' });

    const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });
    if (!synagogue) return res.status(404).json({ error: 'Synagogue not found' });

    const result = await createCheckoutSession({ amount, donationType, donorInfo, synagogue });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook
router.post('/webhook', async (req, res) => {
  try {
    await handleWebhookEvent(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
