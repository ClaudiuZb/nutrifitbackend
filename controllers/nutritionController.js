// server/controllers/nutritionController.js
const User = require('../models/User');
const Meal = require('../models/Meal');
const FoodItem = require('../models/FoodItem');
const nutritionService = require('../services/nutrition');

// @desc    Calculează date nutriționale pentru utilizator
// @route   GET /api/nutrition/calculate
// @access  Private
exports.calculateNutrition = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Obținem istoricul de mese pentru ziua curentă
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMeals = await Meal.find({
      user: userId,
      data: { $gte: today }
    });
    
    // Calculăm datele nutriționale
    const nutritionData = nutritionService.calculateNutrition(user, todayMeals);
    
    res.status(200).json({
      success: true,
      data: nutritionData
    });
  } catch (error) {
    console.error('Eroare la calculul nutrițional:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la calculul nutrițional',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Adaugă o masă nouă
// @route   POST /api/nutrition/meals
// @access  Private
exports.addMeal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tipMasa, data, alimente, calorii, proteine, carbohidrati, grasimi, notite, emotie, nivelSatietate, imagine, analizaAI } = req.body;
    
    // Creăm noua masă
    const meal = await Meal.create({
      user: userId,
      tipMasa,
      data: data || new Date(),
      alimente,
      calorii,
      proteine,
      carbohidrati,
      grasimi,
      notite,
      emotie,
      nivelSatietate,
      imagine,
      analizaAI
    });
    
    res.status(201).json({
      success: true,
      data: meal
    });
  } catch (error) {
    console.error('Eroare la adăugarea mesei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la adăugarea mesei',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține toate mesele utilizatorului
// @route   GET /api/nutrition/meals
// @access  Private
exports.getMeals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    // Construim filtrul în funcție de interval
    const filter = { user: userId };
    
    if (startDate || endDate) {
      filter.data = {};
      
      if (startDate) {
        filter.data.$gte = new Date(startDate);
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        filter.data.$lte = endDateObj;
      }
    }
    
    // Obținem mesele
    const meals = await Meal.find(filter).sort({ data: -1 });
    
    res.status(200).json({
      success: true,
      count: meals.length,
      data: meals
    });
  } catch (error) {
    console.error('Eroare la obținerea meselor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea meselor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține o masă specifică
// @route   GET /api/nutrition/meals/:id
// @access  Private
exports.getMeal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const mealId = req.params.id;
    
    // Obținem masa
    const meal = await Meal.findOne({
      _id: mealId,
      user: userId
    });
    
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Masă negăsită'
      });
    }
    
    res.status(200).json({
      success: true,
      data: meal
    });} catch (error) {
        console.error('Eroare la obținerea mesei:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la obținerea mesei',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Actualizează o masă
    // @route   PUT /api/nutrition/meals/:id
    // @access  Private
    exports.updateMeal = async (req, res, next) => {
      try {
        const userId = req.user.id;
        const mealId = req.params.id;
        const { tipMasa, data, alimente, calorii, proteine, carbohidrati, grasimi, notite, emotie, nivelSatietate, imagine, analizaAI, consumata } = req.body;
        
        // Verificăm dacă masa există
        let meal = await Meal.findOne({
          _id: mealId,
          user: userId
        });
        
        if (!meal) {
          return res.status(404).json({
            success: false,
            message: 'Masă negăsită'
          });
        }
        
        // Actualizăm masa
        meal = await Meal.findByIdAndUpdate(
          mealId,
          {
            tipMasa,
            data,
            alimente,
            calorii,
            proteine,
            carbohidrati,
            grasimi,
            notite,
            emotie,
            nivelSatietate,
            imagine,
            analizaAI,
            consumata,
            updated: Date.now()
          },
          { new: true, runValidators: true }
        );
        
        res.status(200).json({
          success: true,
          data: meal
        });
      } catch (error) {
        console.error('Eroare la actualizarea mesei:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la actualizarea mesei',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Șterge o masă
    // @route   DELETE /api/nutrition/meals/:id
    // @access  Private
    exports.deleteMeal = async (req, res, next) => {
      try {
        const userId = req.user.id;
        const mealId = req.params.id;
        
        // Ștergem masa
        const result = await Meal.findOneAndDelete({
          _id: mealId,
          user: userId
        });
        
        if (!result) {
          return res.status(404).json({
            success: false,
            message: 'Masă negăsită'
          });
        }
        
        res.status(200).json({
          success: true,
          message: 'Masă ștearsă cu succes'
        });
      } catch (error) {
        console.error('Eroare la ștergerea mesei:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la ștergerea mesei',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Caută alimente
    // @route   GET /api/nutrition/foods
    // @access  Private
    exports.searchFoods = async (req, res, next) => {
      try {
        const { query, category, limit = 20 } = req.query;
        
        let filter = {};
        
        // Adăugăm filtrarea după nume
        if (query) {
          filter.$text = { $search: query };
        }
        
        // Adăugăm filtrarea după categorie
        if (category) {
          filter.categorie = category;
        }
        
        // Realizăm căutarea
        const foods = await FoodItem.find(filter)
          .sort({ popularitate: -1 })
          .limit(parseInt(limit));
        
        res.status(200).json({
          success: true,
          count: foods.length,
          data: foods
        });
      } catch (error) {
        console.error('Eroare la căutarea alimentelor:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la căutarea alimentelor',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Adaugă un aliment personalizat
    // @route   POST /api/nutrition/foods
    // @access  Private
    exports.addCustomFood = async (req, res, next) => {
      try {
        const userId = req.user.id;
        const { nume, calorii, proteine, carbohidrati, grasimi, fibre, zaharuri, categorie, unitateStandard, cantitatePorție, proprietatiNutritionale, imagine, emoji } = req.body;
        
        // Verificăm dacă alimentul există deja
        const existingFood = await FoodItem.findOne({ nume: nume.trim() });
        if (existingFood) {
          return res.status(400).json({
            success: false,
            message: 'Există deja un aliment cu acest nume'
          });
        }
        
        // Creăm alimentul personalizat
        const food = await FoodItem.create({
          nume,
          calorii,
          proteine,
          carbohidrati,
          grasimi,
          fibre,
          zaharuri,
          categorie,
          unitateStandard,
          cantitatePorție,
          proprietatiNutritionale,
          imagine,
          emoji,
          custom: true,
          userAdded: userId
        });
        
        res.status(201).json({
          success: true,
          data: food
        });
      } catch (error) {
        console.error('Eroare la adăugarea alimentului:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la adăugarea alimentului',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Obține categoriile de alimente
    // @route   GET /api/nutrition/food-categories
    // @access  Private
    exports.getFoodCategories = async (req, res, next) => {
      try {
        // Obținem toate categoriile unice
        const categories = await FoodItem.distinct('categorie');
        
        res.status(200).json({
          success: true,
          data: categories
        });
      } catch (error) {
        console.error('Eroare la obținerea categoriilor:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la obținerea categoriilor',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Obține recomandări nutriționale pentru utilizator
    // @route   GET /api/nutrition/recommendations
    // @access  Private
    exports.getRecommendations = async (req, res, next) => {
      try {
        const userId = req.user.id;
        
        // Obținem utilizatorul
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'Utilizator negăsit'
          });
        }
        
        // Obținem mesele din ziua curentă
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayMeals = await Meal.find({
          user: userId,
          data: { $gte: today }
        });
        
        // Calculăm datele nutriționale
        const nutritionData = nutritionService.calculateNutrition(user, todayMeals);
        
        // Generăm recomandări personalizate
        const recommendations = nutritionService.generateRecommendations(user, nutritionData);
        
        res.status(200).json({
          success: true,
          data: recommendations
        });
      } catch (error) {
        console.error('Eroare la generarea recomandărilor:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la generarea recomandărilor',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    // @desc    Obține statistici nutriționale pentru un interval de timp
    // @route   GET /api/nutrition/stats
    // @access  Private
    exports.getNutritionStats = async (req, res, next) => {
      try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;
        
        // Validăm datele
        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: 'Data de început și de sfârșit sunt obligatorii'
          });
        }
        
        // Convertim datele pentru interval
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        // Obținem toate mesele din intervalul specificat
        const meals = await Meal.find({
          user: userId,
          data: { $gte: start, $lte: end }
        }).sort({ data: 1 });
        
        // Grupăm datele pe zile
        const dailyStats = {};
        
        meals.forEach(meal => {
          const dateKey = meal.data.toISOString().split('T')[0];
          
          if (!dailyStats[dateKey]) {
            dailyStats[dateKey] = {
              date: dateKey,
              calorii: 0,
              proteine: 0,
              carbohidrati: 0,
              grasimi: 0,
              mese: 0
            };
          }
          
          // Adunăm valorile
          dailyStats[dateKey].calorii += meal.calorii || 0;
          dailyStats[dateKey].proteine += meal.proteine || 0;
          dailyStats[dateKey].carbohidrati += meal.carbohidrati || 0;
          dailyStats[dateKey].grasimi += meal.grasimi || 0;
          dailyStats[dateKey].mese += 1;
        });
        
        // Convertim în array
        const stats = Object.values(dailyStats);
        
        // Calculăm mediile
        const totalDays = stats.length;
        let totalCalorii = 0;
        let totalProteine = 0;
        let totalCarbohidrati = 0;
        let totalGrasimi = 0;
        
        stats.forEach(day => {
          totalCalorii += day.calorii;
          totalProteine += day.proteine;
          totalCarbohidrati += day.carbohidrati;
          totalGrasimi += day.grasimi;
        });
        
        const averages = {
          calorii: totalDays > 0 ? Math.round(totalCalorii / totalDays) : 0,
          proteine: totalDays > 0 ? Math.round(totalProteine / totalDays) : 0,
          carbohidrati: totalDays > 0 ? Math.round(totalCarbohidrati / totalDays) : 0,
          grasimi: totalDays > 0 ? Math.round(totalGrasimi / totalDays) : 0
        };
        
        res.status(200).json({
          success: true,
          data: {
            dailyStats: stats,
            averages
          }
        });
      } catch (error) {
        console.error('Eroare la obținerea statisticilor:', error);
        res.status(500).json({
          success: false,
          message: 'Eroare la obținerea statisticilor',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
        });
      }
    };
    
    module.exports = exports;