const router = require('express').Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { requireAdminOrSynagogue } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function uploadToCloudinary(buffer, mimetype, folder, resourceType = 'image') {
  if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.includes('placeholder')) {
    const b64 = Buffer.from(buffer).toString('base64');
    const dataUri = `data:${mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder, resource_type: resourceType });
    return result.secure_url;
  }
  return 'https://placehold.co/400x400/1a3a4a/ffd166?text=Logo';
}

// POST /api/upload/logo
router.post('/logo', requireAdminOrSynagogue, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'donation-plus/logos');
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/media
router.post('/media', requireAdminOrSynagogue, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const mime = req.file.mimetype;
    const resourceType = mime.startsWith('video/') ? 'video' : mime === 'application/pdf' ? 'raw' : 'image';
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'donation-plus/media', resourceType);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
