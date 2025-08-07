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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Mărirea limitei pentru upload-uri de imagini
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev')); // Logging

// Conectare la MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectat la MongoDB'))
  .catch(err => {
    console.error('Eroare conectare MongoDB:', err.message);
    process.exit(1);
  });

// Rute API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/plans', planRoutes);

// Rută de test
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

// Middleware pentru gestionarea erorilor
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Eroare internă server',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Pornire server
app.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});

module.exports = app; // Export pentru testare