require('dotenv').config();
const path = require('path');
const express = require('express');
const pullJob = require('./services/pullJob');

// Routes
const indexRoutes = require('./routes/indexRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Template Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount Routes
app.use('/', indexRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/fawry', webhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { message: `Path ${req.originalUrl} not found.` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Background Pull Model Scheduled Job
if (process.env.ENABLE_PULL_CRON !== 'false') {
  pullJob.start();
}

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 FawryPay Integration Test Suite running on:`);
  console.log(`👉 ${BASE_URL}`);
  console.log(`📡 Webhook Endpoint: ${BASE_URL}/api/fawry/webhook`);
  console.log(`🔄 Pull Model Scheduled Job: ACTIVE (every ${process.env.PULL_JOB_INTERVAL_SECONDS || 30}s)`);
  console.log(`====================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  pullJob.stop();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  pullJob.stop();
  server.close(() => process.exit(0));
});
