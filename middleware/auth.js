// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pentru protejarea rutelor
exports.protect = async (req, res, next) => {
  let token;

  // Verificăm dacă token-ul este prezent în headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Extragem token-ul din header
    token = req.headers.authorization.split(' ')[1];
  }
  // Verificăm dacă token-ul este în cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Verificăm dacă token-ul există
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acces neautorizat'
    });
  }

  try {
    // Verificăm token-ul
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adăugăm utilizatorul la obiectul request
    req.user = await User.findById(decoded.id);

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Acces neautorizat'
    });
  }
};

// Middleware pentru restricționarea accesului în funcție de rol
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Nu aveți permisiunea de a accesa această resursă'
      });
    }
    next();
  };
};