// controllers/planController.js
const planningService = require('../services/planningService');

// Exportăm direct funcțiile, evitând obiectul exports
module.exports = {
  /**
   * @desc    Generează planuri săptămânale noi
   * @route   POST /api/plans/generate
   * @access  Private
   */
  generateWeeklyPlans: async (req, res) => {
    try {
      const userId = req.user.id;
      const { questionnaireResponses } = req.body;
      
      // Verificăm dacă avem răspunsurile la chestionar
      if (!questionnaireResponses) {
        return res.status(400).json({
          success: false,
          message: 'Răspunsurile la chestionar sunt obligatorii pentru generarea planurilor'
        });
      }
      
      const plans = await planningService.generateWeeklyPlans(userId, questionnaireResponses);
      
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Eroare la generarea planurilor:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la generarea planurilor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  },

  /**
   * @desc    Obține planurile curente active
   * @route   GET /api/plans/current
   * @access  Private
   */
  getCurrentPlans: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const plans = await planningService.getCurrentPlans(userId);
      
      // Adaugă acest log detaliat pentru debugging
      console.log('DEBUG - Date planuri trimise către frontend:', {
        mealPlanId: plans.mealPlan ? plans.mealPlan._id : null,
        hasMeals: plans.mealPlan && plans.mealPlan.meals ? true : false,
        totalMeals: plans.mealPlan && plans.mealPlan.meals ? plans.mealPlan.meals.length : 0
      });
      
      // Dacă există mese, verifică structura unei mese
      if (plans.mealPlan && plans.mealPlan.meals && plans.mealPlan.meals.length > 0) {
        const sampleMeal = plans.mealPlan.meals[0];
        console.log('DEBUG - Structura primei mese:', {
          day: sampleMeal.day,
          mealType: sampleMeal.mealType,
          name: sampleMeal.name,
          hasDescription: !!sampleMeal.description,
          hasRecipe: !!sampleMeal.recipe,
          ingredientsCount: sampleMeal.ingredients ? sampleMeal.ingredients.length : 0,
          hasMacros: !!sampleMeal.macros,
          allKeys: Object.keys(sampleMeal)
        });
        
        // Verifică și datele complete pentru a vedea dacă toate câmpurile au valori
        console.log('DEBUG - Date complete prima masă:', JSON.stringify(sampleMeal));
      }
      
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Eroare la obținerea planurilor curente:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la obținerea planurilor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  },

  /**
   * @desc    Marchează o masă ca finalizată
   * @route   PUT /api/plans/meal/:planId/:mealIndex/complete
   * @access  Private
   */
  completeMeal: async (req, res) => {
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
      
      res.status(200).json({
        success: true,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Eroare la marcarea mesei ca finalizată:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la actualizarea mesei',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  },

  /**
   * @desc    Marchează o masă ca sărită
   * @route   PUT /api/plans/meal/:planId/:mealIndex/skip
   * @access  Private
   */
  skipMeal: async (req, res) => {
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
      
      res.status(200).json({
        success: true,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Eroare la marcarea mesei ca sărită:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la actualizarea mesei',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  },

  /**
   * @desc    Marchează un antrenament ca finalizat
   * @route   PUT /api/plans/workout/:planId/:workoutIndex/complete
   * @access  Private
   */
  completeWorkout: async (req, res) => {
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
      
      res.status(200).json({
        success: true,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Eroare la marcarea antrenamentului ca finalizat:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la actualizarea antrenamentului',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  },

  /**
   * @desc    Marchează un antrenament ca sărit
   * @route   PUT /api/plans/workout/:planId/:workoutIndex/skip
   * @access  Private
   */
  skipWorkout: async (req, res) => {
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
      
      res.status(200).json({
        success: true,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Eroare la marcarea antrenamentului ca sărit:', error);
      res.status(500).json({
        success: false,
        message: 'Eroare la actualizarea antrenamentului',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
      });
    }
  }
};