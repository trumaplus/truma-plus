const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { requireAdmin, requireAdminOrSynagogue, requireOwnerOrAdmin } = require('../middleware/auth');
const { getIO } = require('../socket');

const prisma = new PrismaClient();

// Fields safe to return to any authenticated user viewing their own synagogue
const SAFE_FIELDS = {
  id: true, synagogueName: true, synagogueCode: true, city: true,
  logoUrl: true, theme: true, shabbatModeActive: true,
  latitude: true, longitude: true, createdAt: true,
};

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * GET /api/synagogues/public
 * Returns a minimal public list for the home page (donor-facing).
 * Only exposes display-safe fields — NO email, PIN, Stripe, or sensitive data.
 */
router.get('/public', async (req, res) => {
  try {
    const synagogues = await prisma.synagogue.findMany({
      select: { id: true, synagogueName: true, synagogueCode: true, city: true, logoUrl: true },
      orderBy: { synagogueName: 'asc' },
    });
    res.json(synagogues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/synagogues/public/:id
 * Used by the kiosk tablet to load its own synagogue's display data.
 * No authentication required — kiosk runs without a logged-in user.
 */
router.get('/public/:id', async (req, res) => {
  try {
    const synagogue = await prisma.synagogue.findUnique({
      where: { id: req.params.id },
      select: {
        ...SAFE_FIELDS,
        announcements: true, prayerTimes: true, emergencyNumbers: true,
        slideshowInterval: true, candleLightingOffset: true, kioskPin: true,
      },
    });
    if (!synagogue) return res.status(404).json({ error: 'Not found' });
    res.json(synagogue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin-only ────────────────────────────────────────────────────────────────

/**
 * GET /api/synagogues
 * Returns all synagogues — admin only.
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const synagogues = await prisma.synagogue.findMany({
      select: {
        ...SAFE_FIELDS,
        email: true, updatedAt: true,
        stripeAccountId: true,
        stripeAccountStatus: true,
        _count: { select: { donations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(synagogues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/synagogues
 * Creates a synagogue — admin only.
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { synagogueName, email, password, city, synagogueCode, latitude, longitude, candleLightingOffset } = req.body;

    // ── Field validation ───────────────────────────────────────────────────────
    if (!synagogueName?.trim()) {
      return res.status(400).json({ field: 'synagogueName', error: 'שם בית הכנסת חובה' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ field: 'email', error: 'אימייל חובה' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ field: 'email', error: 'פורמט אימייל לא תקין' });
    }
    if (!password) {
      return res.status(400).json({ field: 'password', error: 'סיסמה חובה' });
    }
    if (password.length < 6) {
      return res.status(400).json({ field: 'password', error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
    }

    const code = synagogueCode ||
      synagogueName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(password, 10);
    const synagogue = await prisma.synagogue.create({
      data: { synagogueName: synagogueName.trim(), synagogueCode: code, email: email.trim().toLowerCase(), passwordHash, city, latitude, longitude, candleLightingOffset },
    });
    const { passwordHash: _, ...safe } = synagogue;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ field: 'email', error: 'אימייל זה כבר רשום במערכת' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/synagogues/:id — admin only.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.synagogue.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Owner or Admin ────────────────────────────────────────────────────────────

/**
 * GET /api/synagogues/:id
 * Admin sees any synagogue; synagogue sees only their own (JWT-scoped).
 */
router.get('/:id', requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
  try {
    const synagogue = await prisma.synagogue.findUnique({ where: { id: req.params.id } });
    if (!synagogue) return res.status(404).json({ error: 'Not found' });
    const { passwordHash, ...safe } = synagogue;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/synagogues/:id
 * Admin updates any synagogue; synagogue updates only their own.
 * synagogueId for scoping is read from JWT, NOT from the request body.
 */
router.put('/:id', requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
  try {
    const { id } = req.params;

    // Strip fields that must never be updated via this route
    const { passwordHash: _ph, id: _id, createdAt: _ca, ...data } = req.body;

    // Hash password if provided in plain-text
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    const synagogue = await prisma.synagogue.update({ where: { id }, data });
    const { passwordHash, ...safe } = synagogue;

    // Notify kiosk to reload content immediately
    try {
      const io = getIO();
      if (io) io.to(id).emit('admin:command', { type: 'RELOAD_CONTENT' });
    } catch { /* socket not ready */ }

    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/synagogues/:id/theme
 */
router.put('/:id/theme', requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
  try {
    const { theme } = req.body;
    await prisma.synagogue.update({ where: { id: req.params.id }, data: { theme } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
