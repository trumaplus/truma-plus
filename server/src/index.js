require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { initSocket } = require('./socket');

const authRoutes = require('./routes/auth');
const synagogueRoutes = require('./routes/synagogues');
const donationRoutes = require('./routes/donations');
const stripeRoutes = require('./routes/stripe');
const mediaRoutes = require('./routes/media');
const uploadRoutes = require('./routes/upload');
const kioskRoutes = require('./routes/kiosks');

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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/synagogues', synagogueRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/kiosks', kioskRoutes);

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
server.listen(PORT, () => {
  console.log(`Donation Plus server running on port ${PORT} [${isProduction ? 'production' : 'development'}]`);
});
