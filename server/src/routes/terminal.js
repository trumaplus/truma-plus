const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');
const { getIO } = require('../socket');
const { sendReceiptEmail } = require('../services/email.service');

const prisma = new PrismaClient();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
}

const isConfigured = () =>
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder';

// ── POST /api/stripe/terminal/connection-token ────────────────────────────────
// Called by the mobile SDK every time it needs to connect.
router.post('/connection-token', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  try {
    const stripe = getStripe();
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ secret: token.secret });
  } catch (err) {
    console.error('[Terminal] connection-token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/terminal/payment-intent ──────────────────────────────────
// Creates a PaymentIntent for a Terminal (card_present) payment.
router.post('/payment-intent', async (req, res) => {
  const { amount, synagogueId, donationType = 'general', donorEmail } = req.body;

  if (!amount || !synagogueId) {
    return res.status(400).json({ error: 'amount and synagogueId required' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const stripe   = getStripe();
    const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });
    if (!synagogue) return res.status(404).json({ error: 'Synagogue not found' });

    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Create a pending donation record so we can track it
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmail = donorEmail && EMAIL_RE.test(donorEmail.trim())
      ? donorEmail.trim().toLowerCase() : null;

    const donation = await prisma.donation.create({
      data: {
        synagogueId,
        amount:           parseFloat(amount),
        currency:         'CAD',
        donationType,
        paymentStatus:    'pending',
        donorEmail:       validEmail,
        receiptRequested: !!validEmail,
      },
    });

    // Build Connect transfer if the synagogue has an active Stripe account
    const piData = {
      amount:               amountInCents,
      currency:             'cad',
      payment_method_types: ['card_present'],
      capture_method:       'automatic',
      metadata: {
        donationId:   donation.id,
        synagogueId,
        donationType,
        source:       'terminal',
      },
    };

    if (synagogue.stripeAccountId && synagogue.stripeAccountStatus === 'active') {
      piData.transfer_data = { destination: synagogue.stripeAccountId };
      const feePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '0');
      if (feePercent > 0) {
        piData.application_fee_amount = Math.round(amountInCents * feePercent / 100);
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(piData);

    // Store the Stripe PaymentIntent ID on the donation row
    await prisma.donation.update({
      where: { id: donation.id },
      data:  { stripeSessionId: paymentIntent.id },
    });

    res.json({ clientSecret: paymentIntent.client_secret, donationId: donation.id });
  } catch (err) {
    console.error('[Terminal] payment-intent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/terminal/payment-intent/:id/complete ────────────────────
// Called by the mobile app immediately after processPayment() succeeds,
// so the DB is updated right away without waiting for the webhook.
router.post('/payment-intent/:piId/complete', async (req, res) => {
  const { piId } = req.params;
  try {
    const donation = await prisma.donation.findFirst({
      where: { stripeSessionId: piId },
    });
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    const completed = await prisma.donation.update({
      where: { id: donation.id },
      data:  { paymentStatus: 'completed', transactionId: piId },
      include: { synagogue: true },
    });

    // Send receipt email if donor provided one
    if (completed.donorEmail) {
      sendReceiptEmail(completed, completed.synagogue, 'he').catch(console.error);
      await prisma.donation.update({ where: { id: donation.id }, data: { receiptSent: true } });
    }

    // Notify kiosk / dashboard via socket
    const io = getIO();
    if (io && completed.synagogueId) {
      io.to(completed.synagogueId).emit('donation:completed', {
        donationId: completed.id,
        amount:     completed.amount,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Terminal] complete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
