// server/models/FoodItem.js
const mongoose = require('mongoose');

const FoodItemSchema = new mongoose.Schema({
  nume: {
    type: String,
    required: [true, 'Numele alimentului este obligatoriu'],
    trim: true,
    unique: true
  },
  calorii: {
    type: Number,
    required: [true, 'Valoarea calorică este obligatorie']
  },
  proteine: {
    type: Number,
    default: 0
  },
  carbohidrati: {
    type: Number,
    default: 0
  },
  grasimi: {
    type: Number,
    default: 0
  },
  fibre: {
    type: Number,
    default: 0
  },
  zaharuri: {
    type: Number,
    default: 0
  },
  sodiu: {
    type: Number, // mg
    default: 0
  },
  categorie: {
    type: String,
    enum: [
      'Carne',
      'Pește și fructe de mare',
      'Ouă și lactate',
      'Legume',
      'Fructe',
      'Cereale și derivate',
      'Nuci și semințe',
      'Leguminoase',
      'Băuturi',
      'Deserturi',
      'Fast food',
      'Suplimente',
      'Altele'
    ],
    default: 'Altele'
  },
  unitateStandard: {
    type: String,
    enum: ['g', 'ml', 'buc', 'porție'],
    default: 'g'
  },
  cantitatePorție: {
    type: Number,
    default: 100
  },
  imagine: {
    type: String, // URL sau path către imagine
    default: ''
  },
  emoji: {
    type: String,
    default: ''
  },
  proprietatiNutritionale: {
    glutenFree: {
      type: Boolean,
      default: false
    },
    vegan: {
      type: Boolean,
      default: false
    },
    vegetarian: {
      type: Boolean,
      default: false
    },
    lactoseFree: {
      type: Boolean,
      default: false
    },
    nutsAllergy: {
      type: Boolean,
      default: false
    }
  },
  popularitate: {
    type: Number, // Scor de popularitate pentru căutări
    default: 0
  },
  marca: {
    type: String,
    default: ''
  },
  custom: {
    type: Boolean, // Dacă alimentul a fost adăugat de un utilizator
    default: false
  },
  userAdded: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

// Actualizează câmpul 'updated' înainte de fiecare salvare
FoodItemSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Creăm indecși pentru căutare rapidă
FoodItemSchema.index({ nume: 'text' });
FoodItemSchema.index({ categorie: 1 });
FoodItemSchema.index({ calorii: 1 });
FoodItemSchema.index({ popularitate: -1 });

module.exports = mongoose.model('FoodItem', FoodItemSchema);