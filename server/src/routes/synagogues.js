const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { requireAdmin, requireAdminOrSynagogue, authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

const SAFE_FIELDS = {
  id: true, synagogueName: true, synagogueCode: true, city: true,
  logoUrl: true, theme: true, shabbatModeActive: true,
  latitude: true, longitude: true, createdAt: true,
};

// GET /api/synagogues/public
router.get('/public', async (req, res) => {
  try {
    const synagogues = await prisma.synagogue.findMany({
      select: { ...SAFE_FIELDS, announcements: true, prayerTimes: true, slideshowInterval: true, candleLightingOffset: true },
      orderBy: { synagogueName: 'asc' },
    });
    res.json(synagogues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/synagogues/public/:id
router.get('/public/:id', async (req, res) => {
  try {
    const synagogue = await prisma.synagogue.findUnique({
      where: { id: req.params.id },
      select: { ...SAFE_FIELDS, announcements: true, prayerTimes: true, emergencyNumbers: true, slideshowInterval: true, candleLightingOffset: true, kioskPin: true },
    });
    if (!synagogue) return res.status(404).json({ error: 'Not found' });
    res.json(synagogue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/synagogues (Admin)
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

// POST /api/synagogues (Admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { synagogueName, email, password, city, synagogueCode, latitude, longitude, candleLightingOffset } = req.body;
    if (!synagogueName || !email || !password) {
      return res.status(400).json({ error: 'synagogueName, email, and password required' });
    }
    const code = synagogueCode || synagogueName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(password, 10);
    const synagogue = await prisma.synagogue.create({
      data: { synagogueName, synagogueCode: code, email, passwordHash, city, latitude, longitude, candleLightingOffset },
    });
    const { passwordHash: _, ...safe } = synagogue;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email or code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/synagogues/:id
router.get('/:id', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'synagogue' && req.user.synagogueId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const synagogue = await prisma.synagogue.findUnique({ where: { id } });
    if (!synagogue) return res.status(404).json({ error: 'Not found' });
    const { passwordHash, ...safe } = synagogue;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/synagogues/:id
router.put('/:id', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'synagogue' && req.user.synagogueId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { passwordHash, id: _id, createdAt, ...data } = req.body;
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }
    const synagogue = await prisma.synagogue.update({ where: { id }, data });
    const { passwordHash: _, ...safe } = synagogue;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/synagogues/:id (Admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.synagogue.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/synagogues/:id/theme
router.put('/:id/theme', requireAdminOrSynagogue, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'synagogue' && req.user.synagogueId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { theme } = req.body;
    await prisma.synagogue.update({ where: { id }, data: { theme } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
