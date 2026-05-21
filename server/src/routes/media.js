const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireSynagogue } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const prisma = new PrismaClient();

// Configure cloudinary from URL
if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.includes('placeholder')) {
  cloudinary.config({ secure: true });
}

// Multer memory storage (fallback when Cloudinary not configured)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/media/:synagogueId (public)
router.get('/:synagogueId', async (req, res) => {
  try {
    const items = await prisma.mediaItem.findMany({
      where: { synagogueId: req.params.synagogueId },
      orderBy: { order: 'asc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/:synagogueId
router.post('/:synagogueId', requireSynagogue, upload.single('file'), async (req, res) => {
  try {
    const { synagogueId } = req.params;
    if (req.user.synagogueId !== synagogueId) return res.status(403).json({ error: 'Access denied' });

    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    let url = '';
    const mime = req.file.mimetype;
    const type = mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : mime.startsWith('video/') ? 'video' : 'image';

    // Upload to Cloudinary if configured
    if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.includes('placeholder')) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: `donation-plus/${synagogueId}`,
        resource_type: type === 'video' ? 'video' : type === 'pdf' ? 'raw' : 'image',
      });
      url = result.secure_url;
    } else {
      // Placeholder URL for dev without Cloudinary
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64').slice(0, 100)}...`;
      url = '/placeholder-media.jpg';
    }

    const count = await prisma.mediaItem.count({ where: { synagogueId } });
    const item = await prisma.mediaItem.create({
      data: { synagogueId, url, type, filename: req.file.originalname, order: count },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/media/:synagogueId/:id
router.put('/:synagogueId/:id', requireSynagogue, async (req, res) => {
  try {
    const { synagogueId, id } = req.params;
    if (req.user.synagogueId !== synagogueId) return res.status(403).json({ error: 'Access denied' });
    const { order, active } = req.body;
    const item = await prisma.mediaItem.update({
      where: { id },
      data: { ...(order !== undefined && { order }), ...(active !== undefined && { active }) },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/media/:synagogueId/:id
router.delete('/:synagogueId/:id', requireSynagogue, async (req, res) => {
  try {
    const { synagogueId, id } = req.params;
    if (req.user.synagogueId !== synagogueId) return res.status(403).json({ error: 'Access denied' });
    await prisma.mediaItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/media/:synagogueId/reorder
router.put('/:synagogueId/reorder', requireSynagogue, async (req, res) => {
  try {
    const { synagogueId } = req.params;
    if (req.user.synagogueId !== synagogueId) return res.status(403).json({ error: 'Access denied' });
    const { items } = req.body;
    await Promise.all(items.map(({ id, order }) =>
      prisma.mediaItem.update({ where: { id }, data: { order } })
    ));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
