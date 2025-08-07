// server/controllers/userController.js
const User = require('../models/User');
const nutritionService = require('../services/nutrition');

// @desc    Obține toți utilizatorii
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Eroare la obținerea utilizatorilor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea utilizatorilor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține un utilizator
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la obținerea utilizatorului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea utilizatorului',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Înregistrează o nouă greutate în istoricul utilizatorului
// @route   POST /api/users/weight
// @access  Private
exports.recordWeight = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { greutate, data } = req.body;
    
    if (!greutate) {
      return res.status(400).json({
        success: false,
        message: 'Valoarea greutății este obligatorie'
      });
    }
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Adăugăm noua greutate în istoric
    user.istoricGreutate.push({
      data: data || new Date(),
      valoare: greutate
    });
    
    // Actualizăm greutatea curentă
    user.greutate = greutate;
    
    // Salvăm utilizatorul
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user.istoricGreutate
    });
  } catch (error) {
    console.error('Eroare la înregistrarea greutății:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la înregistrarea greutății',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține istoricul de greutate al utilizatorului
// @route   GET /api/users/weight-history
// @access  Private
exports.getWeightHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Filtrăm istoricul în funcție de interval
    let weightHistory = user.istoricGreutate;
    
    if (startDate) {
      const start = new Date(startDate);
      weightHistory = weightHistory.filter(record => new Date(record.data) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      weightHistory = weightHistory.filter(record => new Date(record.data) <= end);
    }
    
    // Sortăm istoricul
    weightHistory.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    res.status(200).json({
      success: true,
      count: weightHistory.length,
      data: weightHistory
    });
  } catch (error) {
    console.error('Eroare la obținerea istoricului de greutate:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea istoricului de greutate',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Actualizează obiectivul utilizatorului
// @route   PUT /api/users/objective
// @access  Private
exports.updateObjective = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { obiectiv, greutateTinta } = req.body;
    
    if (!obiectiv || !['slabire', 'muschi', 'mentinere'].includes(obiectiv)) {
      return res.status(400).json({
        success: false,
        message: 'Obiectiv invalid'
      });
    }
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Actualizăm obiectivul și greutatea țintă
    user.obiectiv = obiectiv;
    if (greutateTinta) {
      user.greutateTinta = greutateTinta;
    }
    
    // Salvăm utilizatorul
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la actualizarea obiectivului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la actualizarea obiectivului',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Actualizează preferințele alimentare ale utilizatorului
// @route   PUT /api/users/food-preferences
// @access  Private
exports.updateFoodPreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { preferinteAlimentare, alergii } = req.body;
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Actualizăm preferințele
    if (preferinteAlimentare) {
      user.preferinteAlimentare = {
        ...user.preferinteAlimentare,
        ...preferinteAlimentare
      };
    }
    
    // Actualizăm alergiile
    if (alergii) {
      user.alergii = alergii;
    }
    
    // Salvăm utilizatorul
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la actualizarea preferințelor alimentare:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la actualizarea preferințelor alimentare',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Actualizează setările de antrenament ale utilizatorului
// @route   PUT /api/users/workout-settings
// @access  Private
exports.updateWorkoutSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { zileSaptamana, tipAntrenament, antrenamentZi, recuperare } = req.body;
    
    // Obținem utilizatorul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }
    
    // Actualizăm setările de antrenament
    if (zileSaptamana !== undefined) user.antrenament.zileSaptamana = zileSaptamana;
    if (tipAntrenament) user.antrenament.tipAntrenament = tipAntrenament;
    if (antrenamentZi) user.antrenament.antrenamentZi = antrenamentZi;
    if (recuperare !== undefined) user.antrenament.recuperare = recuperare;
    
    // Salvăm utilizatorul
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la actualizarea setărilor de antrenament:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la actualizarea setărilor de antrenament',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Calculează IMC și informații suplimentare
// @route   GET /api/users/bmi
// @access  Private
exports.calculateBMI = async (req, res, next) => {
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
    
    // Calculăm IMC
    const bmi = nutritionService.calculateBMI(user.greutate, user.inaltime);
    
    // Interpretăm IMC
    const bmiInterpretation = nutritionService.interpretBMI(bmi);
    
    // Calculăm necesarul de apă
    const waterNeeds = nutritionService.calculateWaterNeeds(
      user.greutate, 
      user.nivelActivitate === 'sedentar' ? 1 :
      user.nivelActivitate === 'usor' ? 2 :
      user.nivelActivitate === 'moderat' ? 3 :
      user.nivelActivitate === 'activ' ? 4 :
      user.nivelActivitate === 'foarteActiv' ? 5 : 3
    );
    
    // Estimăm procentul de grăsime corporală
    const bodyFat = nutritionService.estimateBodyFat(user);
    
    res.status(200).json({
      success: true,
      data: {
        bmi: Math.round(bmi * 10) / 10,
        category: bmiInterpretation.category,
        recommendation: bmiInterpretation.recommendation,
        waterNeeds,
        bodyFat: Math.round(bodyFat * 10) / 10
      }
    });
  } catch (error) {
    console.error('Eroare la calculul IMC:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la calculul IMC',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

module.exports = exports;