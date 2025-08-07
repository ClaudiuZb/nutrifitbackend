// models/WorkoutPlan.js
const mongoose = require('mongoose');

const WorkoutPlanSchema = new mongoose.Schema({
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
  workouts: [
    {
      day: {
        type: Number, // 0-6 (Duminică - Sâmbătă)
        required: true
      },
      name: {
        type: String,
        required: true
      },
      description: String,
      exercises: [
        {
          name: {
            type: String,
            required: true
          },
          sets: {
            type: Number,
            required: true
          },
          reps: {
            type: String,
            required: true
          },
          restTime: Number, // în secunde
          notes: String
        }
      ],
      duration: Number, // în minute
      intensity: {
        type: String,
        enum: ['light', 'moderate', 'high', 'none'],
        default: 'moderate'
      },
      caloriesBurned: Number,
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

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);