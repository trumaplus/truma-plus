require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { initSocket } = require('./socket');

const prisma = new PrismaClient();

const authRoutes = require('./routes/auth');
const synagogueRoutes = require('./routes/synagogues');
const donationRoutes = require('./routes/donations');
const stripeRoutes = require('./routes/stripe');
const mediaRoutes = require('./routes/media');
const uploadRoutes = require('./routes/upload');
const kioskRoutes    = require('./routes/kiosks');
const terminalRoutes = require('./routes/terminal');

const app = express();
const server = http.createServer(app);

initSocket(server);

const isProduction = process.env.NODE_ENV === 'production';

// In production: serve React build from ../client/dist
// In dev: allow Vite dev server on port 5173 (proxy handles this)
const corsOrigin = process.env.CLIENT_URL ||
  (isProduction ? null : 'http://localhost:5173');

app.use(cors({
  origin: isProduction ? false : corsOrigin,
  credentials: true,
}));

// Raw body for Stripe webhook — must come BEFORE express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Local uploads (dev fallback when Cloudinary not configured)
// media.js saves to server/uploads/, so we serve from there
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/synagogues', synagogueRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/kiosks',   kioskRoutes);
app.use('/api/stripe/terminal', terminalRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve React app in production
if (isProduction) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — all non-API routes return index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Donation Plus server running on port ${PORT} [${isProduction ? 'production' : 'development'}]`);
});

// ── Cleanup stale pending donations every hour ────────────────────────────────
async function cleanupStalePending() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
    const { count } = await prisma.donation.deleteMany({
      where: { paymentStatus: 'pending', createdAt: { lt: cutoff } },
    });
    if (count > 0) console.log(`[Cleanup] Removed ${count} stale pending donation(s)`);
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
}
cleanupStalePending(); // run once on startup
setInterval(cleanupStalePending, 60 * 60 * 1000); // then every hour

// Keep server alive — log errors but don't crash
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
