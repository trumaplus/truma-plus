const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ role: 'admin', adminId: admin.id });
    res.json({ token, role: 'admin', email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/synagogue/login
router.post('/synagogue/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const synagogue = await prisma.synagogue.findUnique({ where: { email } });
    if (!synagogue) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, synagogue.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ role: 'synagogue', synagogueId: synagogue.id });
    res.json({ token, role: 'synagogue', synagogueId: synagogue.id, synagogueName: synagogue.synagogueName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/synagogue/register (Admin only — enforced)
router.post('/synagogue/register', requireAdmin, async (req, res) => {
  try {
    const { synagogueName, email, password, city, synagogueCode } = req.body;
    if (!synagogueName || !email || !password) {
      return res.status(400).json({ error: 'synagogueName, email, and password are required' });
    }

    const code = synagogueCode || synagogueName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(password, 10);

    const synagogue = await prisma.synagogue.create({
      data: { synagogueName, synagogueCode: code, email, passwordHash, city },
    });

    const { passwordHash: _, ...safe } = synagogue;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email or code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/synagogue/forgot-password
router.post('/synagogue/forgot-password', async (req, res) => {
  res.json({ ok: true, message: 'If the email exists, a reset link has been sent.' });
});

// POST /api/auth/synagogue/reset-password
router.post('/synagogue/reset-password', async (req, res) => {
  res.json({ ok: true });
});

// POST /api/auth/login  — unified: works for both admin and gabai
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // 1. Check admin table first
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ role: 'admin', adminId: admin.id });
      return res.json({ token, role: 'admin', email: admin.email });
    }

    // 2. Fallback: check synagogue table
    const synagogue = await prisma.synagogue.findUnique({ where: { email } });
    if (!synagogue) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, synagogue.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ role: 'synagogue', synagogueId: synagogue.id });
    return res.json({
      token,
      role: 'synagogue',
      synagogueId: synagogue.id,
      synagogueName: synagogue.synagogueName,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ role: req.user.role, id: req.user.adminId || req.user.synagogueId });
});

module.exports = router;
