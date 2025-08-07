// server/models/Conversation.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  objective: {
    type: String,
    enum: ['slabire', 'muschi', 'mentinere'],
    required: true
  },
  title: {
    type: String,
    default: 'Conversație nouă'
  },
  messages: [MessageSchema],
  lastActive: {
    type: Date,
    default: Date.now
  },
  context: {
    userMetrics: {
      weight: Number,
      targetWeight: Number,
      height: Number,
      age: Number,
      activityLevel: String
    },
    nutritionData: {
      caloriesConsumed: Number,
      caloriesTarget: Number,
      protein: Number,
      carbs: Number,
      fat: Number
    },
    lastMeals: [{
      name: String,
      calories: Number,
      time: Date
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  created: {
    type: Date,
    default: Date.now
  }
});

// Actualizează lastActive la adăugarea unui nou mesaj
ConversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActive = new Date();
  }
  next();
});

// Limitează numărul de mesaje stocate (pentru optimizare)
ConversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 100) {
    // Păstrăm ultimele 100 de mesaje
    this.messages = this.messages.slice(-100);
  }
  next();
});

// Setează titlul automat (bazat pe primul mesaj al utilizatorului)
ConversationSchema.pre('save', function(next) {
  if (this.isNew && this.messages && this.messages.length > 0) {
    const userMessage = this.messages.find(msg => msg.role === 'user');
    if (userMessage) {
      const content = userMessage.content.substring(0, 30);
      this.title = content + (content.length >= 30 ? '...' : '');
    }
  }
  next();
});

// Indecși pentru căutări frecvente
ConversationSchema.index({ user: 1, lastActive: -1 });
ConversationSchema.index({ user: 1, objective: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);