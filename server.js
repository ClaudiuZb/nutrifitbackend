// server/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Configurare variabile de mediu
dotenv.config();

// Importare routere
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const aiRoutes = require('./routes/aiRoutes');
const planRoutes = require('./routes/planRoutes');

// Configurare aplicație Express
const app = express();
const PORT = process.env.PORT || 5000;

// CORS simplu pentru testing - permite toate originile
app.use(cors({
  origin: true, // Permite toate originile
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Logging pentru debug
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.headers.origin || 'No origin');
  console.log('User-Agent:', req.headers['user-agent']);
  next();
});

// Conectare la MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectat la MongoDB'))
  .catch(err => {
    console.error('❌ Eroare conectare MongoDB:', err.message);
    process.exit(1);
  });

// Rute API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/plans', planRoutes);

// Rută de test - FOARTE IMPORTANTĂ pentru debug
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    message: 'Backend NutriFit pe Render funcționează!'
  });
});

// Rută root
app.get('/', (req, res) => {
  res.json({ 
    message: 'NutriFit Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      status: '/api/status',
      auth: '/api/auth',
      users: '/api/users',
      nutrition: '/api/nutrition',
      ai: '/api/ai',
      plans: '/api/plans'
    }
  });
});

// Middleware pentru gestionarea erorilor
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Eroare internă server',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Server pornit la: ${new Date().toISOString()}`);
});

module.exports = app;
