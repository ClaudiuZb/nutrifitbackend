// server/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Înregistrare utilizator
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { email, password, nume, inaltime, greutate, obiectiv, sex, varsta } = req.body;

    // Verificare dacă utilizatorul există deja
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Există deja un cont cu acest email'
      });
    }

// Creare utilizator nou
const user = await User.create({
  email,
  password,
  nume,
  inaltime,
  greutate,
  sex: sex || 'masculin',
  varsta: varsta || 30
});

    // Generare token
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Eroare la înregistrare:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la înregistrare',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Autentificare utilizator
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validare email și parolă
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email și parola sunt obligatorii'
      });
    }

    // Verificare dacă utilizatorul există
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credențiale invalide'
      });
    }

    // Verificare parolă
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credențiale invalide'
      });
    }

    // Generare token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Eroare la autentificare:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la autentificare',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Obține profilul utilizatorului curent
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la obținerea profilului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea profilului',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Actualizare profil
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { nume, inaltime, greutate, obiectiv, nivelActivitate, sex, varsta } = req.body;

    // Creare obiect cu câmpurile de actualizat
    const fieldsToUpdate = {};
    if (nume) fieldsToUpdate.nume = nume;
    if (inaltime) fieldsToUpdate.inaltime = inaltime;
    if (greutate) fieldsToUpdate.greutate = greutate;
    if (obiectiv) fieldsToUpdate.obiectiv = obiectiv;
    if (nivelActivitate) fieldsToUpdate.nivelActivitate = nivelActivitate;
    if (sex) fieldsToUpdate.sex = sex;
    if (varsta) fieldsToUpdate.varsta = varsta;

    // Actualizare profil
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Eroare la actualizarea profilului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la actualizarea profilului',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Schimbare parolă
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verificare dacă ambele parole sunt furnizate
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Parola curentă și noua parolă sunt obligatorii'
      });
    }

    // Obținere utilizator cu parolă inclusă
    const user = await User.findById(req.user.id).select('+password');

    // Verificare parolă curentă
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Parola curentă este incorectă'
      });
    }

    // Setare și salvare parolă nouă
    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Eroare la schimbarea parolei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la schimbarea parolei',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Deconectare / ștergere cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // Expiră în 10 secunde
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Utilizator deconectat'
  });
};

// Utilitar pentru generarea token-ului și trimiterea răspunsului
const sendTokenResponse = (user, statusCode, res) => {
  // Creăm token-ul JWT
  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  // Opțiuni pentru cookie
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true
  };

  // Secure flag în producție
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Excludem parola din răspuns
  const userData = { ...user._doc };
  delete userData.password;

  // Trimitem răspunsul cu cookie și token
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: userData
    });
};