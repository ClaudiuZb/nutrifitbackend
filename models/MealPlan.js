// models/MealPlan.js
const mongoose = require('mongoose');

const MealPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  objective: {
    type: String,
    enum: ['slabire', 'muschi', 'mentinere'],
    required: true
  },
  meals: [
    {
      day: {
        type: Number, // 0-6 (Duminică - Sâmbătă)
        required: true
      },
      mealType: {
        type: String,
        enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        required: true
      },
      name: {
        type: String,
        required: true
      },
      description: String,
      recipe: String,
      ingredients: [String],
      macros: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number
      },
      completed: {
        type: Boolean,
        default: false
      },
      skipped: {
        type: Boolean,
        default: false
      }
    }
  ],
  totalNutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  // Adăugăm câmpul pentru răspunsurile chestionarului
  questionnaireResponses: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MealPlan', MealPlanSchema);