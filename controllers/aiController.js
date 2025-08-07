// server/controllers/aiController.js
const aiService = require('../services/ai');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Meal = require('../models/Meal');
const nutritionService = require('../services/nutrition');

// @desc    Trimite mesaj către AI și obține răspuns
// @route   POST /api/ai/chat
// @access  Private
exports.chatWithAI = async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.id;

    // Obținem utilizatorul pentru a-i lua datele și obiectivul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }

    let conversation;
    let conversationHistory = [];

    // Verificăm dacă există o conversație existentă sau trebuie creată una nouă
    if (conversationId) {
      conversation = await Conversation.findOne({ 
        _id: conversationId, 
        user: userId 
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversație negăsită'
        });
      }

      // Extragem istoricul conversației
      conversationHistory = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } else {
      // Creăm o nouă conversație
      conversation = new Conversation({
        user: userId,
        objective: user.obiectiv,
        messages: [],
        context: {
          userMetrics: {
            weight: user.greutate,
            targetWeight: user.greutateTinta,
            height: user.inaltime,
            age: user.varsta,
            activityLevel: user.nivelActivitate
          }
        }
      });
    }

    // Actualizăm contextul cu date nutriționale recente
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMeals = await Meal.find({
      user: userId,
      data: { $gte: today }
    });
    
    // Calculăm datele nutriționale
    const nutritionData = nutritionService.calculateNutrition(user, todayMeals);
    
    // Actualizăm contextul conversației
    conversation.context.nutritionData = {
      caloriesConsumed: nutritionData.calorii.consumate,
      caloriesTarget: nutritionData.calorii.total,
      protein: nutritionData.macronutrienti.proteine.consumate,
      carbs: nutritionData.macronutrienti.carbohidrati.consumate,
      fat: nutritionData.macronutrienti.grasimi.consumate
    };
    
    // Adăugăm ultimele mese în context
    conversation.context.lastMeals = todayMeals.slice(0, 5).map(meal => ({
      name: meal.tipMasa,
      calories: meal.calorii,
      time: meal.data
    }));

    // Adăugăm mesajul utilizatorului în conversație
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Obținem răspunsul de la AI
    const aiResponse = await aiService.getAIResponse(
      message,
      user.obiectiv,
      user,
      conversationHistory
    );

    // Adăugăm răspunsul AI în conversație
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    });

    // Salvăm conversația actualizată
    await conversation.save();

    // Trimitem răspunsul către client
    res.status(200).json({
      success: true,
      data: {
        message: aiResponse,
        conversationId: conversation._id
      }
    });
  } catch (error) {
    console.error('Eroare la comunicarea cu AI:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la procesarea mesajului',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Analizează o fotografie cu alimente
// @route   POST /api/ai/analyze-food
// @access  Private
exports.analyzeFood = async (req, res, next) => {
  try {
    const { image } = req.body;
    const userId = req.user.id;

    // Verificăm dacă imaginea este furnizată
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Imaginea este obligatorie'
      });
    }

    // Eliminăm prefix-ul "data:image/jpeg;base64," dacă există
    let base64Image = image;
    if (base64Image.includes('base64,')) {
      base64Image = base64Image.split('base64,')[1];
    }

    // Trimitem imaginea către API pentru analiză
    const analysisResult = await aiService.analyzeFood(base64Image);

    // Întoarcem răspunsul către client
    // Serviciul ar trebui să se ocupe acum de toate cazurile posibile și să returneze un obiect valid
    res.status(200).json({
      success: true,
      data: analysisResult
    });
  } catch (error) {
    console.error('Eroare la analiza fotografiei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la analiza fotografiei',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Sugerează rețete bazate pe o fotografie cu ingrediente
// @route   POST /api/ai/suggest-recipes
// @access  Private
exports.suggestRecipes = async (req, res, next) => {
  try {
    const { image } = req.body;
    const userId = req.user.id;

    // Verificăm dacă imaginea este furnizată
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Imaginea este obligatorie'
      });
    }

    // Eliminăm prefix-ul "data:image/jpeg;base64," dacă există
    let base64Image = image;
    if (base64Image.includes('base64,')) {
      base64Image = base64Image.split('base64,')[1];
    }

    // Obținem utilizatorul pentru a personaliza rețetele în funcție de obiectiv
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizator negăsit'
      });
    }

    // Trimitem imaginea către API pentru sugestii de rețete
    const recipesResult = await aiService.suggestRecipes(base64Image);

    res.status(200).json({
      success: true,
      data: recipesResult
    });
  } catch (error) {
    console.error('Eroare la sugerarea rețetelor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la sugerarea rețetelor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține conversațiile unui utilizator
// @route   GET /api/ai/conversations
// @access  Private
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Obținem conversațiile utilizatorului, sortate după ultima activitate
    const conversations = await Conversation.find({ user: userId })
      .sort({ lastActive: -1 })
      .select('title objective lastActive created');
    
    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Eroare la obținerea conversațiilor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea conversațiilor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Obține o conversație specifică
// @route   GET /api/ai/conversations/:id
// @access  Private
exports.getConversation = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    // Obținem conversația specificată
    const conversation = await Conversation.findOne({
      _id: conversationId,
      user: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversație negăsită'
      });
    }
    
    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Eroare la obținerea conversației:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea conversației',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};

// @desc    Șterge o conversație
// @route   DELETE /api/ai/conversations/:id
// @access  Private
exports.deleteConversation = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    // Ștergem conversația
    const result = await Conversation.findOneAndDelete({
      _id: conversationId,
      user: userId
    });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Conversație negăsită'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Conversație ștearsă cu succes'
    });
  } catch (error) {
    console.error('Eroare la ștergerea conversației:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la ștergerea conversației',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Eroare server'
    });
  }
};