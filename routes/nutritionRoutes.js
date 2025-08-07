// server/routes/nutritionRoutes.js
const express = require('express');
const {
  calculateNutrition,
  addMeal,
  getMeals,
  getMeal,
  updateMeal,
  deleteMeal,
  searchFoods,
  addCustomFood,
  getFoodCategories,
  getRecommendations,
  getNutritionStats
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Toate rutele de nutriție necesită autentificare
router.use(protect);

// Rute pentru date nutriționale
router.get('/calculate', calculateNutrition);
router.get('/recommendations', getRecommendations);
router.get('/stats', getNutritionStats);

// Rute pentru mese
router.route('/meals')
  .get(getMeals)
  .post(addMeal);

router.route('/meals/:id')
  .get(getMeal)
  .put(updateMeal)
  .delete(deleteMeal);

// Rute pentru alimente
router.route('/foods')
  .get(searchFoods)
  .post(addCustomFood);

router.get('/food-categories', getFoodCategories);

module.exports = router;