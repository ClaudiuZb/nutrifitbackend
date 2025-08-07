// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email-ul este obligatoriu'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
      'Adresa de email nu este validă'
    ]
  },
  password: {
    type: String,
    required: [true, 'Parola este obligatorie'],
    minlength: [6, 'Parola trebuie să aibă minim 6 caractere'],
    select: false // Nu include parola în query-uri
  },
  nume: {
    type: String,
    required: [true, 'Numele este obligatoriu'],
    trim: true
  },
  sex: {
    type: String,
    enum: ['masculin', 'feminin'],
    default: 'masculin'
  },
  dataNasterii: {
    type: Date
  },
  varsta: {
    type: Number,
    min: [12, 'Vârsta minimă este 12 ani'],
    max: [100, 'Vârsta maximă este 100 ani']
  },
  inaltime: {
    type: Number,
    required: [true, 'Înălțimea este obligatorie'],
    min: [100, 'Înălțimea minimă este 100 cm'],
    max: [250, 'Înălțimea maximă este 250 cm']
  },
  greutate: {
    type: Number,
    required: [true, 'Greutatea este obligatorie'],
    min: [30, 'Greutatea minimă este 30 kg'],
    max: [300, 'Greutatea maximă este 300 kg']
  },
  greutateInitiala: {
    type: Number
  },
  greutateTinta: {
    type: Number
  },
  nivelActivitate: {
    type: String,
    enum: ['sedentar', 'usor', 'moderat', 'activ', 'foarteActiv'],
    default: 'moderat'
  },
  obiectiv: {
    type: String,
    enum: ['slabire', 'muschi', 'mentinere']
    // Am eliminat default: 'mentinere' pentru a rezolva problema de redirecționare
  },
  preferinteAlimentare: {
    vegetarian: {
      type: Boolean,
      default: false
    },
    vegan: {
      type: Boolean,
      default: false
    },
    fructeDeMare: {
      type: Boolean,
      default: true
    },
    lactate: {
      type: Boolean,
      default: true
    },
    gluten: {
      type: Boolean,
      default: true
    }
  },
  alergii: [{
    type: String,
    trim: true
  }],
  istoricGreutate: [{
    data: {
      type: Date,
      default: Date.now
    },
    valoare: {
      type: Number,
      required: true
    }
  }],
  metriciSuplimentari: {
    apaConsumata: {
      type: Number, // litri
      default: 0
    },
    caloriiArse: {
      type: Number, // calorii per zi
      default: 0
    },
    scoreNutritional: {
      type: Number, // procent
      default: 0
    },
    scoreHidratare: {
      type: Number, // procent
      default: 0
    },
    diversitateAlimente: {
      type: Number, // număr de alimente diferite consumate săptămânal
      default: 0
    }
  },
  antrenament: {
    zileSaptamana: {
      type: Number,
      default: 0
    },
    tipAntrenament: {
      type: String,
      enum: ['', 'forta', 'cardio', 'flexibilitate', 'mixt'],
      default: ''
    },
    antrenamentZi: {
      type: String,
      default: ''
    },
    recuperare: {
      type: Number, // procent
      default: 80
    }
  },
  created: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
});

// Encriptarea parolei înainte de salvare
UserSchema.pre('save', async function(next) {
  // Doar dacă parola a fost modificată
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Metoda pentru verificarea parolei
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Calculează vârsta din data nașterii
UserSchema.pre('save', function(next) {
  if (this.dataNasterii && (!this.varsta || this.isModified('dataNasterii'))) {
    const astazi = new Date();
    const dataNasterii = new Date(this.dataNasterii);
    let varsta = astazi.getFullYear() - dataNasterii.getFullYear();
    const m = astazi.getMonth() - dataNasterii.getMonth();
    
    if (m < 0 || (m === 0 && astazi.getDate() < dataNasterii.getDate())) {
      varsta--;
    }
    
    this.varsta = varsta;
  }
  
  next();
});

// Adaugă automat greutatea curentă în istoricul de greutate la modificare
UserSchema.pre('save', function(next) {
  if (this.isModified('greutate')) {
    this.istoricGreutate.push({
      data: new Date(),
      valoare: this.greutate
    });
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);