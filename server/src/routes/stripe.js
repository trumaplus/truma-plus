const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const {
  createCheckoutSession,
  handleWebhookEvent,
  createConnectAccountLink,
  getConnectStatus,
  createLoginLink,
  isConfigured,
} = require('../services/stripe.service');
const { requireAdminOrSynagogue } = require('../middleware/auth');
const { getIO } = require('../socket');

const prisma = new PrismaClient();

// ── Checkout ──────────────────────────────────────────────────────────────────

// POST /api/stripe/checkout
router.post('/checkout', async (req, res) => {
  try {
    const { amount, donationType, donorInfo, synagogueId, lang } = req.body;
    if (!amount || !synagogueId) return res.status(400).json({ error: 'amount and synagogueId required' });

    const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });
    if (!synagogue) return res.status(404).json({ error: 'Synagogue not found' });

    const result = await createCheckoutSession({ amount, donationType, donorInfo, synagogue, lang });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook
router.post('/webhook', async (req, res) => {
  try {
    await handleWebhookEvent(req.body, req.headers['stripe-signature'], getIO());
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Stripe Connect ────────────────────────────────────────────────────────────

/**
 * POST /api/stripe/connect/:synagogueId
 * Creates (or refreshes) a Stripe Express Connect account + returns onboarding URL.
 * Accessible by: admin (any synagogue) or the synagogue itself.
 */
router.post('/connect/:synagogueId', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { synagogueId } = req.params;

    if (req.user.role === 'synagogue' && req.user.synagogueId !== synagogueId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });
    if (!synagogue) return res.status(404).json({ error: 'Synagogue not found' });

    if (!isConfigured()) {
      return res.status(503).json({
        error: 'Stripe not configured. Set STRIPE_SECRET_KEY in your environment variables.',
        configMissing: true,
      });
    }

    // Return to the correct dashboard page after Stripe onboarding completes
    const returnPath = req.user.role === 'admin'
      ? `/admin/synagogue/${synagogueId}`
      : '/dashboard';

    const result = await createConnectAccountLink(synagogue, returnPath);
    res.json(result);
  } catch (err) {
    console.error('[Connect] createConnectAccountLink error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stripe/connect/:synagogueId/status
 * Fetches Connect account status, syncing from Stripe to DB.
 */
router.get('/connect/:synagogueId/status', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { synagogueId } = req.params;

    if (req.user.role === 'synagogue' && req.user.synagogueId !== synagogueId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!isConfigured()) {
      // Return DB-stored status without hitting Stripe
      const synagogue = await prisma.synagogue.findUnique({
        where: { id: synagogueId },
        select: { stripeAccountId: true, stripeAccountStatus: true },
      });
      return res.json({
        status:    synagogue?.stripeAccountStatus || 'not_connected',
        accountId: synagogue?.stripeAccountId    || null,
        mock:      true,
      });
    }

    const result = await getConnectStatus(synagogueId);
    res.json(result);
  } catch (err) {
    console.error('[Connect] getConnectStatus error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stripe/connect/:synagogueId/login
 * Returns a Stripe Express Dashboard login link so the synagogue can manage payouts.
 */
router.get('/connect/:synagogueId/login', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { synagogueId } = req.params;

    if (req.user.role === 'synagogue' && req.user.synagogueId !== synagogueId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!isConfigured()) {
      return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
    }

    const result = await createLoginLink(synagogueId);
    res.json(result);
  } catch (err) {
    console.error('[Connect] createLoginLink error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
