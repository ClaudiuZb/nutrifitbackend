// server/routes/aiRoutes.js
const express = require('express');
const { 
  chatWithAI, 
  analyzeFood, 
  suggestRecipes, 
  getConversations, 
  getConversation, 
  deleteConversation 
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Toate rutele de AI necesită autentificare
router.use(protect);

// Rute pentru chat AI
router.post('/chat', chatWithAI);

// Rute pentru analiză foto
router.post('/analyze-food', analyzeFood);
router.post('/suggest-recipes', suggestRecipes);

// Rute pentru gestionarea conversațiilor
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;