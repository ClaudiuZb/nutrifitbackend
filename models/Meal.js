// server/models/Meal.js
const mongoose = require('mongoose');

const MealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  data: {
    type: Date,
    default: Date.now,
    required: true
  },
  tipMasa: {
    type: String,
    enum: [
      'Mic dejun', 
      'Gustare 1', 
      'Prânz', 
      'Gustare 2', 
      'Cină', 
      'Pre-antrenament',
      'Post-antrenament',
      'Înainte de culcare',
      'Altele'
    ],
    required: true
  },
  consumata: {
    type: Boolean,
    default: true
  },
  calorii: {
    type: Number,
    required: true
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
  alimente: [{
    nume: {
      type: String,
      required: true
    },
    cantitate: {
      type: Number,
      required: true
    },
    unitate: {
      type: String,
      required: true,
      enum: ['g', 'ml', 'buc', 'porție', 'lingură', 'linguriță', 'cană']
    },
    calorii: {
      type: Number,
      required: true
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
    adaugat: {
      type: Date,
      default: Date.now
    }
  }],
  notite: {
    type: String,
    trim: true
  },
  emotie: {
    type: String,
    enum: ['', 'fericit', 'satisfăcut', 'neutru', 'nesatisfăcut', 'înfometat'],
    default: ''
  },
  nivelSatietate: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  imagine: {
    type: String, // URL sau path către imagine
    default: ''
  },
  analizaAI: {
    success: {
      type: Boolean,
      default: false
    },
    alimenteDetectate: [{
      nume: String,
      calorii: Number,
      cantitate: Number,
      unitate: String
    }],
    estimareTotala: {
      calorii: Number,
      proteine: Number,
      carbohidrati: Number,
      grasimi: Number
    },
    recomandariFeedback: [String]
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
MealSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Calculează totalurile nutriționale din alimentele componente
MealSchema.pre('save', function(next) {
  if (this.isModified('alimente')) {
    this.calorii = this.alimente.reduce((sum, food) => sum + food.calorii, 0);
    this.proteine = this.alimente.reduce((sum, food) => sum + (food.proteine || 0), 0);
    this.carbohidrati = this.alimente.reduce((sum, food) => sum + (food.carbohidrati || 0), 0);
    this.grasimi = this.alimente.reduce((sum, food) => sum + (food.grasimi || 0), 0);
    this.fibre = this.alimente.reduce((sum, food) => sum + (food.fibre || 0), 0);
  }
  next();
});

// Adaugă un index compus pentru a facilita interogările pentru mesele unui utilizator într-o anumită perioadă
MealSchema.index({ user: 1, data: -1 });

module.exports = mongoose.model('Meal', MealSchema);