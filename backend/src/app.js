const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/error-handler');
const authRoutes = require('./routes/auth');
const authGoogleRoutes = require('./routes/auth-google');
const appointmentsRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');

// Initialize background jobs
require('./jobs/email-retry-worker');
require('./jobs/reminder-scheduler');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // In production, configure FRONTEND_URL. Locally defaults to '*' for safety.
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);

// Health-check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/auth/google', authGoogleRoutes);
app.use('/admin', adminRoutes);
app.use('/appointments', appointmentsRoutes);
app.use('/appointments', require('./routes/appointments'));

// Error handling (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Export app for testing, or listen if called directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
