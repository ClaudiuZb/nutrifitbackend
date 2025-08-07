// routes/planRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const planningService = require('../services/planningService');

// Folosim funcția protect din middleware-ul auth
const authProtect = auth.protect;

// Generează planuri săptămânale personalizate
router.post('/generate', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionnaireResponses } = req.body;
    
    if (!questionnaireResponses) {
      return res.status(400).json({
        success: false,
        message: 'Răspunsurile la chestionar sunt obligatorii pentru generarea planurilor'
      });
    }
    
    const plans = await planningService.generateWeeklyPlans(userId, questionnaireResponses);
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Eroare la generarea planurilor:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la generarea planurilor'
    });
  }
});

// Obține planurile active pentru săptămâna curentă
router.get('/current', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const plans = await planningService.getCurrentPlans(userId);
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Eroare la obținerea planurilor curente:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la obținerea planurilor curente'
    });
  }
});

// Marchează o masă ca finalizată
router.put('/meal/:planId/:mealIndex/complete', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, mealIndex } = req.params;
    
    const updatedPlan = await planningService.updateMealStatus(
      userId,
      planId,
      parseInt(mealIndex),
      true, // completed
      false // skipped
    );
    
    res.json({
      success: true,
      data: updatedPlan
    });
  } catch (error) {
    console.error('Eroare la marcarea mesei ca finalizată:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la marcarea mesei ca finalizată'
    });
  }
});

// Marchează o masă ca sărită
router.put('/meal/:planId/:mealIndex/skip', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, mealIndex } = req.params;
    
    const updatedPlan = await planningService.updateMealStatus(
      userId,
      planId,
      parseInt(mealIndex),
      false, // completed
      true // skipped
    );
    
    res.json({
      success: true,
      data: updatedPlan
    });
  } catch (error) {
    console.error('Eroare la marcarea mesei ca sărită:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la marcarea mesei ca sărită'
    });
  }
});

// Marchează un antrenament ca finalizat
router.put('/workout/:planId/:workoutIndex/complete', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, workoutIndex } = req.params;
    
    const updatedPlan = await planningService.updateWorkoutStatus(
      userId,
      planId,
      parseInt(workoutIndex),
      true, // completed
      false // skipped
    );
    
    res.json({
      success: true,
      data: updatedPlan
    });
  } catch (error) {
    console.error('Eroare la marcarea antrenamentului ca finalizat:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la marcarea antrenamentului ca finalizat'
    });
  }
});

// Marchează un antrenament ca sărit
router.put('/workout/:planId/:workoutIndex/skip', authProtect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, workoutIndex } = req.params;
    
    const updatedPlan = await planningService.updateWorkoutStatus(
      userId,
      planId,
      parseInt(workoutIndex),
      false, // completed
      true // skipped
    );
    
    res.json({
      success: true,
      data: updatedPlan
    });
  } catch (error) {
    console.error('Eroare la marcarea antrenamentului ca sărit:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Eroare la marcarea antrenamentului ca sărit'
    });
  }
});

module.exports = router;