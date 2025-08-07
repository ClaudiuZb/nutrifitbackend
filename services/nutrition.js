// server/services/nutrition.js

/**
 * Calculează necesarul caloric bazat pe formula Harris-Benedict
 * @param {Object} userData - Datele utilizatorului
 * @returns {number} - BMR (rata metabolică bazală)
 */
function calculateBMR(userData) {
    const { greutate, inaltime, varsta, sex } = userData;
    
    // Formula Harris-Benedict actualizată
    if (sex === 'masculin') {
      return 88.362 + (13.397 * greutate) + (4.799 * inaltime) - (5.677 * varsta);
    } else {
      return 447.593 + (9.247 * greutate) + (3.098 * inaltime) - (4.330 * varsta);
    }
  }
  
  /**
   * Calculează TDEE (Total Daily Energy Expenditure)
   * @param {Object} userData - Datele utilizatorului
   * @returns {number} - TDEE (necesarul caloric zilnic total)
   */
  function calculateTDEE(userData) {
    const bmr = calculateBMR(userData);
    
    // Factori de activitate
    const activityFactors = {
      sedentar: 1.2, // Activitate minimă, doar activități zilnice
      usor: 1.375, // Exerciții ușoare 1-3 zile pe săptămână
      moderat: 1.55, // Exerciții moderate 3-5 zile pe săptămână
      activ: 1.725, // Exerciții intense 6-7 zile pe săptămână
      foarteActiv: 1.9 // Atleți, activitate fizică foarte intensă
    };
    
    // Folosim factorul de activitate corespunzător sau default moderat
    const activityFactor = activityFactors[userData.nivelActivitate] || activityFactors.moderat;
    
    return bmr * activityFactor;
  }
  
  /**
   * Calculează necesarul de macronutrienți și calorii pentru obiectivul specificat
   * @param {Object} userData - Datele utilizatorului
   * @param {Array} mealsHistory - Istoricul meselor (opțional)
   * @returns {Object} - Necesarul caloric și de macronutrienți
   */
  function calculateNutrition(userData, mealsHistory = []) {
    const tdee = calculateTDEE(userData);
    let targetCalories = tdee;
    let targetProtein = 0;
    let targetCarbs = 0;
    let targetFat = 0;
    
    // Ajustăm caloriile și macronutrienții în funcție de obiectiv
    switch (userData.obiectiv) {
      case 'slabire':
        targetCalories = Math.round(tdee * 0.8); // Deficit de 20%
        targetProtein = Math.round(userData.greutate * 2.2); // ~2.2g/kg
        targetFat = Math.round((targetCalories * 0.25) / 9); // 25% din calorii
        targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4);
        break;
        
      case 'muschi':
        targetCalories = Math.round(tdee * 1.1); // Surplus de 10%
        targetProtein = Math.round(userData.greutate * 2.5); // ~2.5g/kg
        targetFat = Math.round((targetCalories * 0.2) / 9); // 20% din calorii
        targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4);
        break;
        
      case 'mentinere':
      default:
        targetCalories = Math.round(tdee);
        targetProtein = Math.round(userData.greutate * 1.8); // ~1.8g/kg
        targetFat = Math.round((targetCalories * 0.3) / 9); // 30% din calorii
        targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4);
        break;
    }
    
    // Calculăm consumul curent din istoricul meselor (doar pentru ziua curentă)
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const todayMeals = mealsHistory.filter(meal => 
      new Date(meal.timestamp).toISOString().split('T')[0] === today
    );
    
    const consumedCalories = todayMeals.reduce((sum, meal) => sum + (meal.calorii || 0), 0);
    const consumedProtein = todayMeals.reduce((sum, meal) => sum + (meal.proteine || 0), 0);
    const consumedCarbs = todayMeals.reduce((sum, meal) => sum + (meal.carbohidrati || 0), 0);
    const consumedFat = todayMeals.reduce((sum, meal) => sum + (meal.grasimi || 0), 0);
    
    // Generăm date specifice pentru obiectiv
    let specificData = {};
    
    switch (userData.obiectiv) {
      case 'slabire':
        specificData = {
          deficitCaloric: Math.round(tdee - targetCalories),
          greutateInitiala: userData.greutateInitiala || userData.greutate + 5,
          greutateCurenta: userData.greutate,
          greutateTinta: userData.greutateTinta || Math.round(userData.greutate * 0.9), // Default -10%
          caloriiArse: userData.caloriiArse || 400, // Valoare estimată
          apaConsumata: userData.apaConsumata || 2.5, // Litri
          recomandari: [
            'Consumă proteine la fiecare masă pentru sațietate',
            'Mărește volumul de legume pentru a reduce densitatea calorică',
            'Fă 30 de minute de cardio zilnic pentru accelerarea metabolismului'
          ],
          alimente: [
            { nume: 'Piept de pui', calorii: 165, emoticon: '🍗' },
            { nume: 'Somon', calorii: 180, emoticon: '🐟' },
            { nume: 'Avocado', calorii: 240, emoticon: '🥑' },
            { nume: 'Mix de legume', calorii: 85, emoticon: '🥦' }
          ]
        };
        break;
        
      case 'muschi':
        specificData = {
          surplusCaloric: Math.round(targetCalories - tdee),
          antrenamentZi: userData.antrenamentZi || 'Piept & Triceps',
          proteinePerMasa: [35, 45, 30, 40], // grame per masă
          recuperare: userData.recuperare || 85, // procent
          greutateInitiala: userData.greutateInitiala || userData.greutate - 5,
          greutateCurenta: userData.greutate,
          greutateTinta: userData.greutateTinta || Math.round(userData.greutate * 1.1), // Default +10%
          recomandari: [
            'Consumă proteine la 2-3 ore pentru sinteză musculară optimă',
            'Focus pe carbohidrați complecși post-antrenament',
            'Asigură-te că dormi 7-8 ore pentru recuperare maximă'
          ],
          alimente: [
            { nume: 'Shake proteic', calorii: 150, emoticon: '🥤' },
            { nume: 'Piept de pui', calorii: 165, emoticon: '🍗' },
            { nume: 'Orez brun', calorii: 220, emoticon: '🍚' },
            { nume: 'Brânză cottage', calorii: 120, emoticon: '🧀' }
          ]
        };
        break;
        
      case 'mentinere':
      default:
        specificData = {
          balantaCalorica: Math.round(targetCalories - consumedCalories),
          scoreNutritional: userData.scoreNutritional || 87, // procent
          diversitateAlimente: userData.diversitateAlimente || 23, // număr alimente diferite/săptămână
          scoreHidratare: userData.scoreHidratare || 85, // procent
          scoreCalitate: userData.scoreCalitate || 82, // procent
          recomandari: [
            'Menține diversitatea alimentară - minim 30 alimente diferite săptămânal',
            'Focus pe alimentele integrale neprocessate',
            'Balanța micro și macronutrienților este cheia sănătății'
          ],
          alimente: [
            { nume: 'Nuci și semințe', calorii: 180, emoticon: '🌰' },
            { nume: 'Quinoa', calorii: 120, emoticon: '🌾' },
            { nume: 'Leguminoase', calorii: 130, emoticon: '🌱' },
            { nume: 'Fructe de pădure', calorii: 70, emoticon: '🍓' }
          ]
        };
        break;
    }
    
    // Date pentru mesele planificate
    const mealPlan = generateMealPlan(userData.obiectiv, targetCalories);
    
    // Generăm culorile pentru tema aplicației în funcție de obiectiv
    const themeColor = userData.obiectiv === 'slabire' ? '#41e169' : 
                     (userData.obiectiv === 'muschi' ? '#79d7ff' : '#ffde59');
    
    // Construim obiectul cu datele nutriționale complete
    return {
      calorii: {
        total: targetCalories,
        consumate: consumedCalories,
        ramase: targetCalories - consumedCalories,
        procent: Math.round((consumedCalories / targetCalories) * 100)
      },
      macronutrienti: {
        proteine: { 
          total: targetProtein, 
          consumate: consumedProtein, 
          unitate: 'g', 
          procent: Math.round((consumedProtein / targetProtein) * 100) 
        },
        carbohidrati: { 
          total: targetCarbs, 
          consumate: consumedCarbs, 
          unitate: 'g', 
          procent: Math.round((consumedCarbs / targetCarbs) * 100) 
        },
        grasimi: { 
          total: targetFat, 
          consumate: consumedFat, 
          unitate: 'g', 
          procent: Math.round((consumedFat / targetFat) * 100) 
        }
      },
      mese: mealPlan,
      specific: specificData,
      culoareTema: themeColor
    };
  }
  
  /**
   * Generează un plan de mese pentru ziua curentă
   * @param {string} objective - Obiectivul nutrițional
   * @param {number} targetCalories - Caloriile țintă
   * @returns {Array} - Lista de mese
   */
  function generateMealPlan(objective, targetCalories) {
    // Distribuim caloriile în funcție de obiectiv
    let mealDistribution = {};
    
    switch (objective) {
      case 'slabire':
        // Pentru slăbire, mai multe mese mici pentru controlul foamei
        mealDistribution = {
          'Mic dejun': 0.25,
          'Gustare 1': 0.1,
          'Prânz': 0.3,
          'Gustare 2': 0.1,
          'Cină': 0.25
        };
        break;
        
      case 'muschi':
        // Pentru masă musculară, accent pe mesele din jurul antrenamentului
        mealDistribution = {
          'Mic dejun': 0.2,
          'Pre-antrenament': 0.15,
          'Post-antrenament': 0.25,
          'Prânz/Cină': 0.25,
          'Înainte de culcare': 0.15
        };
        break;
        
      case 'mentinere':
      default:
        // Pentru menținere, echilibrat
        mealDistribution = {
          'Mic dejun': 0.25,
          'Prânz': 0.35,
          'Gustare': 0.15,
          'Cină': 0.25
        };
        break;
    }
    
    // Generăm planul de mese în funcție de distribuție
    const meals = [];
    let id = 1;
    
    for (const [mealType, percentage] of Object.entries(mealDistribution)) {
      meals.push({
        id: id.toString(),
        tip: mealType,
        ora: getMealTime(mealType),
        calorii: Math.round(targetCalories * percentage),
        consumat: false, // Default toate mesele sunt neconsumate
        alimente: getDefaultFoodsForMeal(mealType, objective)
      });
      id++;
    }
    
    // Marcăm mesele care ar fi trebuit consumate la această oră ca fiind consumate
    const currentHour = new Date().getHours();
    
    return meals.map(meal => {
      const mealHour = parseInt(meal.ora.split(':')[0]);
      return {
        ...meal,
        consumat: mealHour < currentHour 
      };
    });
  }
  
  /**
   * Determină ora pentru un anumit tip de masă
   * @param {string} mealType - Tipul mesei
   * @returns {string} - Ora în format HH:MM
   */
  function getMealTime(mealType) {
    const times = {
      'Mic dejun': '08:00',
      'Gustare 1': '10:30',
      'Prânz': '13:00',
      'Gustare 2': '16:00',
      'Cină': '19:30',
      'Pre-antrenament': '11:00',
      'Post-antrenament': '14:00',
      'Prânz/Cină': '18:00',
      'Înainte de culcare': '22:00',
      'Gustare': '16:00'
    };
    
    return times[mealType] || '12:00';
  }
  
  /**
   * Generează alimente default pentru un tip de masă și obiectiv
   * @param {string} mealType - Tipul mesei
   * @param {string} objective - Obiectivul utilizatorului
   * @returns {Array} - Lista de alimente
   */
  function getDefaultFoodsForMeal(mealType, objective) {
    // Definim alimentele default pentru fiecare tip de masă și obiectiv
    const mealFoods = {
      slabire: {
        'Mic dejun': ['Omletă cu legume', 'Pâine integrală', 'Avocado'],
        'Gustare 1': ['Iaurt grecesc', 'Fructe de pădure'],
        'Prânz': ['Piept de pui la grătar', 'Orez brun', 'Salată mixtă'],
        'Gustare 2': ['Mix de nuci și semințe', 'Măr'],
        'Cină': ['Somon la cuptor', 'Cartofi dulci', 'Broccoli']
    },
    muschi: {
      'Mic dejun': ['Omletă cu brânză', 'Toast cu unt de arahide', 'Banană'],
      'Pre-antrenament': ['Shake proteic', 'Banană', 'Alune'],
      'Post-antrenament': ['Piept de pui', 'Orez', 'Legume la grătar'],
      'Prânz/Cină': ['Ton', 'Paste integrale', 'Broccoli'],
      'Înainte de culcare': ['Brânză cottage', 'Cașcaval', 'Migdale']
    },
    mentinere: {
      'Mic dejun': ['Terci de ovăz', 'Miere', 'Fructe proaspete'],
      'Prânz': ['Salată cu quinoa', 'Piept de pui', 'Avocado'],
      'Gustare': ['Iaurt grecesc', 'Mix de nuci', 'Fructe de pădure'],
      'Cină': ['Pește la cuptor', 'Cartofi dulci', 'Sparanghel']
    }
  };
  
  // Returnăm alimentele corespunzătoare sau o listă default
  return mealFoods[objective]?.[mealType] || ['Aliment 1', 'Aliment 2', 'Aliment 3'];
}

/**
 * Generează recomandări personalizate în funcție de obiectiv și progres
 * @param {Object} userData - Datele utilizatorului
 * @param {Object} nutritionData - Datele nutriționale calculate
 * @returns {Array} - Lista de recomandări
 */
function generateRecommendations(userData, nutritionData) {
  const recommendations = [];
  
  // Recomandări generale în funcție de obiectiv
  switch (userData.obiectiv) {
    case 'slabire':
      if (nutritionData.calorii.consumate > nutritionData.calorii.total) {
        recommendations.push('Ai depășit necesarul caloric. Încearcă să incluzi mai multe legume în dietă pentru a reduce densitatea calorică.');
      }
      if (nutritionData.macronutrienti.proteine.consumate < nutritionData.macronutrienti.proteine.total * 0.7) {
        recommendations.push('Aportul de proteine este sub necesar. Proteinele ajută la menținerea masei musculare în timpul slăbirii.');
      }
      recommendations.push('Hidratarea adecvată poate reduce senzația de foame. Asigură-te că bei cel puțin 2.5L de apă zilnic.');
      break;
      
    case 'muschi':
      if (nutritionData.calorii.consumate < nutritionData.calorii.total * 0.8) {
        recommendations.push('Ești sub necesarul caloric pentru creșterea musculară. Asigură-te că mănânci suficient pentru a susține recuperarea și creșterea.');
      }
      if (nutritionData.macronutrienti.proteine.consumate < nutritionData.macronutrienti.proteine.total * 0.8) {
        recommendations.push('Ai nevoie de mai multe proteine pentru a maximiza sinteza proteică musculară.');
      }
      recommendations.push('Carbohidrații sunt importanți pentru refacerea glicogenului muscular. Consumă-i în special înainte și după antrenament.');
      break;
      
    case 'mentinere':
    default:
      recommendations.push('O dietă variată este cheia sănătății. Încearcă să incluzi cel puțin 30 de alimente diferite săptămânal.');
      recommendations.push('Focusul pe alimente integrale și neprocessate poate îmbunătăți sănătatea pe termen lung.');
      recommendations.push('Echilibrul între macronutrienți este mai important decât numărarea strictă a caloriilor pentru sănătate optimă.');
      break;
  }
  
  return recommendations;
}

/**
 * Calculează IMC (indicele de masă corporală)
 * @param {number} greutate - Greutatea în kg
 * @param {number} inaltime - Înălțimea în cm
 * @returns {number} - IMC calculat
 */
function calculateBMI(greutate, inaltime) {
  // IMC = greutate (kg) / (înălțime (m))^2
  const inaltimeMetri = inaltime / 100; // Conversie din cm în m
  return greutate / (inaltimeMetri * inaltimeMetri);
}

/**
 * Interpretează IMC și returnează categoria
 * @param {number} bmi - Valoarea IMC
 * @returns {Object} - Categoria și recomandări
 */
function interpretBMI(bmi) {
  let category, recommendation;
  
  if (bmi < 18.5) {
    category = 'Subponderal';
    recommendation = 'Creșterea aportului caloric și a masei musculare poate fi benefică pentru sănătatea ta.';
  } else if (bmi >= 18.5 && bmi < 25) {
    category = 'Greutate normală';
    recommendation = 'Continuă să menții un stil de viață sănătos și activ.';
  } else if (bmi >= 25 && bmi < 30) {
    category = 'Supraponderal';
    recommendation = 'O ușoară reducere a greutății ar putea îmbunătăți indicatorii de sănătate.';
  } else if (bmi >= 30 && bmi < 35) {
    category = 'Obezitate (Gradul I)';
    recommendation = 'Reducerea greutății este recomandată pentru îmbunătățirea sănătății generale. Consultă un specialist.';
  } else if (bmi >= 35 && bmi < 40) {
    category = 'Obezitate (Gradul II)';
    recommendation = 'Consultă un medic pentru un plan personalizat de management al greutății.';
  } else {
    category = 'Obezitate (Gradul III)';
    recommendation = 'Este important să consulți un medic pentru suport specializat în managementul greutății.';
  }
  
  return { category, recommendation };
}

/**
 * Calculează necesarul zilnic de apă
 * @param {number} greutate - Greutatea în kg
 * @param {number} activitateLevel - Nivelul de activitate fizică (1-5)
 * @returns {number} - Necesarul de apă în litri
 */
function calculateWaterNeeds(greutate, activitateLevel = 3) {
  // Formula de bază: 30ml per kg
  let baseNeeds = greutate * 30 / 1000; // conversie din ml în litri
  
  // Ajustare în funcție de nivelul de activitate (1-5)
  const activityFactor = 1 + (activitateLevel - 3) * 0.2; // 0.8, 0.9, 1.0, 1.2, 1.4
  
  return Math.round(baseNeeds * activityFactor * 10) / 10; // Rotunjire la o zecimală
}

/**
 * Calculează procentul de grăsime corporală estimat
 * @param {Object} userData - Datele utilizatorului
 * @returns {number} - Procentul estimat de grăsime corporală
 */
function estimateBodyFat(userData) {
  const { sex, varsta, greutate, inaltime } = userData;
  const bmi = calculateBMI(greutate, inaltime);
  
  // Formulă simplificată pentru estimarea procentului de grăsime
  // Notă: Aceasta este o aproximare generală, nu o măsurare precisă
  if (sex === 'masculin') {
    return (1.20 * bmi) + (0.23 * varsta) - 16.2;
  } else {
    return (1.20 * bmi) + (0.23 * varsta) - 5.4;
  }
}

/**
 * Calculează necesarul caloric pentru pierderea unei anumite greutăți
 * @param {Object} userData - Datele utilizatorului
 * @param {number} targetWeightLoss - Greutatea țintă de pierdut (kg)
 * @param {number} timeFrame - Perioada de timp (zile)
 * @returns {Object} - Planul de deficit caloric
 */
function calculateWeightLossPlan(userData, targetWeightLoss, timeFrame) {
  const tdee = calculateTDEE(userData);
  
  // 1kg de grăsime = ~7700 calorii
  const totalDeficit = targetWeightLoss * 7700;
  const dailyDeficit = totalDeficit / timeFrame;
  
  // Limităm deficitul la maxim 25% din TDEE pentru siguranță
  const maxSafeDeficit = tdee * 0.25;
  const recommendedDeficit = Math.min(dailyDeficit, maxSafeDeficit);
  
  const targetCalories = Math.round(tdee - recommendedDeficit);
  const expectedWeightLoss = (recommendedDeficit * timeFrame) / 7700;
  const expectedDuration = totalDeficit / recommendedDeficit;
  
  return {
    tdee,
    targetCalories,
    recommendedDeficit: Math.round(recommendedDeficit),
    expectedWeightLoss: Math.round(expectedWeightLoss * 10) / 10, // Rotunjire la o zecimală
    expectedDuration: Math.ceil(expectedDuration),
    isSafe: dailyDeficit <= maxSafeDeficit
  };
}

module.exports = {
  calculateBMR,
  calculateTDEE,
  calculateNutrition,
  generateRecommendations,
  calculateBMI,
  interpretBMI,
  calculateWaterNeeds,
  estimateBodyFat,
  calculateWeightLossPlan
};