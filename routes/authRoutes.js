// server/routes/authRoutes.js
const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  updateProfile, 
  updatePassword, 
  logout 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Rute publice
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);

// Rute protejate (necesită autentificare)
router.get('/me', protect, getMe);
router.put('/updateprofile', protect, updateProfile);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;