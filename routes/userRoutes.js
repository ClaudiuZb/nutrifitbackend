// server/routes/userRoutes.js
const express = require('express');
const { 
  getUsers,
  getUser,
  recordWeight,
  getWeightHistory,
  updateObjective,
  updateFoodPreferences,
  updateWorkoutSettings,
  calculateBMI
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Toate rutele necesită autentificare
router.use(protect);

// Rute publice pentru utilizator autentificat
router.post('/weight', recordWeight);
router.get('/weight-history', getWeightHistory);
router.put('/objective', updateObjective);
router.put('/food-preferences', updateFoodPreferences);
router.put('/workout-settings', updateWorkoutSettings);
router.get('/bmi', calculateBMI);

// Rute admin (necesită rol admin)
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin'), getUser);

module.exports = router;