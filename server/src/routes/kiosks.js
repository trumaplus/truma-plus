const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { getConnectedKiosks } = require('../socket');

// GET /api/kiosks/status
router.get('/status', requireAdmin, (req, res) => {
  try {
    const kiosks = getConnectedKiosks();
    res.json(kiosks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
