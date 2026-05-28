const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwnerOrAdmin } = require('../middleware/auth'); // requireSynagogue removed — all routes now use requireOwnerOrAdmin
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// Multer: memory storage (used for both Cloudinary and local fallback)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Detect media type from mimetype
function getMediaType(mimetype) {
  if (!mimetype) return 'image';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('video/')) return 'video';
  return 'image';
}

// Detect media type from URL extension (fallback)
function getTypeFromUrl(url) {
  if (!url) return 'image';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'image'; // jpg, png, gif, webp, etc.
}

// Save file locally when Cloudinary is not configured
function saveLocally(buffer, originalname, synagogueId) {
  const uploadDir = path.join(__dirname, '../../uploads', synagogueId);   // server/uploads/<id>/
  fs.mkdirSync(uploadDir, { recursive: true });
  const safe = Date.now() + '-' + originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = path.join(uploadDir, safe);
  fs.writeFileSync(dest, buffer);
  return `/uploads/${synagogueId}/${safe}`;
}

// Upload to Cloudinary
async function uploadToCloudinary(buffer, mimetype, synagogueId, mediaType) {
  const b64 = Buffer.from(buffer).toString('base64');
  const dataUri = `data:${mimetype};base64,${b64}`;
  const resourceType = mediaType === 'video' ? 'video' : mediaType === 'pdf' ? 'raw' : 'image';
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `donation-plus/${synagogueId}`,
    resource_type: resourceType,
  });
  return result.secure_url;
}

function isCloudinaryConfigured() {
  return process.env.CLOUDINARY_URL &&
    !process.env.CLOUDINARY_URL.includes('placeholder') &&
    process.env.CLOUDINARY_URL.startsWith('cloudinary://');
}

// GET /api/media/:synagogueId (public)
router.get('/:synagogueId', async (req, res) => {
  try {
    const items = await prisma.mediaItem.findMany({
      where: { synagogueId: req.params.synagogueId },
      orderBy: { order: 'asc' },
    });
    // Normalise active field (SQLite stores 0/1, Postgres stores true/false)
    const normalised = items.map((item) => ({
      ...item,
      active: item.active === true || item.active === 1,
    }));
    res.json(normalised);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/:synagogueId
router.post('/:synagogueId', requireOwnerOrAdmin((req) => req.params.synagogueId), upload.single('file'), async (req, res) => {
  try {
    const { synagogueId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const mediaType = getMediaType(req.file.mimetype);
    let url;

    if (isCloudinaryConfigured()) {
      url = await uploadToCloudinary(req.file.buffer, req.file.mimetype, synagogueId, mediaType);
    } else {
      url = saveLocally(req.file.buffer, req.file.originalname, synagogueId);
    }

    const count = await prisma.mediaItem.count({ where: { synagogueId } });
    const item = await prisma.mediaItem.create({
      data: { synagogueId, url, type: mediaType, filename: req.file.originalname, order: count },
    });
    res.status(201).json({ ...item, active: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/media/:synagogueId/:id
router.put('/:synagogueId/:id', requireOwnerOrAdmin((req) => req.params.synagogueId), async (req, res) => {
  try {
    const { synagogueId, id } = req.params;
    const { order, active } = req.body;
    const item = await prisma.mediaItem.update({
      where: { id },
      data: {
        ...(order !== undefined && { order }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    res.json({ ...item, active: item.active === true || item.active === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/media/:synagogueId/:id
router.delete('/:synagogueId/:id', requireOwnerOrAdmin((req) => req.params.synagogueId), async (req, res) => {
  try {
    const { synagogueId, id } = req.params;
    const item = await prisma.mediaItem.findUnique({ where: { id } });
    // Remove local file if applicable
    if (item?.url?.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../', item.url);
      fs.unlink(filePath, () => {});
    }
    await prisma.mediaItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/media/:synagogueId/reorder
router.put('/:synagogueId/reorder', requireOwnerOrAdmin((req) => req.params.synagogueId), async (req, res) => {
  try {
    const { synagogueId } = req.params;
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
