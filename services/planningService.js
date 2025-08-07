const { openaiClient } = require('../config/openai');
const User = require('../models/User');
const Meal = require('../models/Meal');
const MealPlan = require('../models/MealPlan');
const WorkoutPlan = require('../models/WorkoutPlan');

async function generateWeeklyPlans(userId, questionnaireResponses) {
  try {
    if (!questionnaireResponses) {
      throw new Error('Răspunsurile la chestionar sunt obligatorii pentru generarea unui plan personalizat');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Utilizator negăsit');
    }

    const recentMeals = await Meal.find({ user: userId })
      .sort({ data: -1 })
      .limit(20);
    
    let weightData = [];
    try {
      weightData = await Weight.find({ user: userId })
        .sort({ date: -1 })
        .limit(5);
    } catch (error) {
      console.log('Modelul Weight nu există sau nu sunt date disponibile');
    }
    
    // Extragerea valorii obiectivului de modificare a greutății și a intervalului de timp
    const weightChangeGoal = user.obiectiv === 'slabire' || user.obiectiv === 'muschi' ? 
                          extractWeightChangeGoal(questionnaireResponses.weight_goal) : 0;
    
    const timeframeMonths = extractTimeframeMonths(questionnaireResponses.timeframe_goal);
    
    // Calculul BMR și a necesarului caloric
    const bmr = calculateBMR(user.sex, user.greutate, user.inaltime, user.varsta);
    const activityFactor = getActivityFactor(user.nivelActivitate);
    const tdee = Math.round(bmr * activityFactor);
    
    // Calculul deficitului/surplusului caloric zilnic
    const totalCalorieDelta = weightChangeGoal * 7700; // 1 kg grăsime = ~7700 calorii
    const dailyCalorieDelta = Math.round(totalCalorieDelta / (timeframeMonths * 30));
    
    // Calculul caloriilor zilnice țintă
    let targetDailyCalories = tdee;
    if (user.obiectiv === 'slabire') {
      targetDailyCalories = Math.max(tdee - Math.abs(dailyCalorieDelta), getMinHealthyCalories(user.sex));
    } else if (user.obiectiv === 'muschi') {
      targetDailyCalories = tdee + Math.abs(dailyCalorieDelta);
    }
    
    const userContext = {
      name: user.nume || 'utilizator',
      age: user.varsta || 30,
      gender: user.sex || 'nedefinit',
      height: user.inaltime || 170,
      weight: user.greutate || 70,
      objective: user.obiectiv || 'mentinere',
      activityLevel: user.nivelActivitate || 'moderat',
      dietaryRestrictions: user.restrictiiAlimentare || [],
      recentMeals: recentMeals.map(meal => ({
        type: meal.tipMasa,
        calories: meal.calorii,
        date: meal.data
      })),
      weightProgress: weightData.map(entry => ({
        weight: entry.value,
        date: entry.date
      })),
      questionnaireResponses: questionnaireResponses,
      weightChangeGoal: weightChangeGoal,
      timeframeMonths: timeframeMonths,
      bmr: bmr,
      tdee: tdee,
      targetDailyCalories: targetDailyCalories
    };

    console.log('Context utilizator pentru AI:', JSON.stringify(userContext, null, 2));

    let mealPrompt, workoutPrompt;
    
    if (user.obiectiv === 'slabire') {
      mealPrompt = `Ești un nutriționist expert specializat în slăbire sănătoasă. 
      Creează un plan de mese COMPLET pentru 7 zile care să ajute utilizatorul să slăbească ${weightChangeGoal} kg în ${timeframeMonths} luni într-un ritm sănătos.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      Planul trebuie să fie bogat în proteine, să conțină carbohidrați complecși cu absorbție lentă, și să includă multe legume și fibre.
      
      FOARTE IMPORTANT: Trebuie să creezi mese pentru TOATE cele 7 zile ale săptămânii (zilele 0-6).
      Pentru fiecare zi, trebuie să incluzi EXACT 3 mese: breakfast, lunch și dinner.
      
      Necesarul caloric zilnic pentru menținere al utilizatorului este de ${tdee} calorii.
      CALORIILE ZILNICE ȚINTĂ pentru acest plan trebuie să fie ${targetDailyCalories} calorii.
      NU CREA UN PLAN CU UN DEFICIT CALORIC MAI MARE DE 500-750 CALORII SUB NECESARUL ZILNIC.
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare restricțiile alimentare, preferințele, obiectivele specifice de greutate și frecvența meselor indicate.
      
      Include 3 mese principale (breakfast, lunch, dinner) pentru fiecare zi (21 mese în total).
      Mesele trebuie să fie satisfăcătoare și diverse pentru a evita senzația de restricție.`;
      
      workoutPrompt = `Ești un antrenor personal specializat în programe de slăbire.
      Creează un plan de antrenament pentru 7 zile care să ajute utilizatorul să slăbească ${weightChangeGoal} kg în ${timeframeMonths} luni.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare nivelul de experiență, tipul de antrenamente preferat, accesul la echipamente și frecvența dorită.
      
      Combină antrenamente cardio pentru arderea caloriilor cu antrenamente de forță pentru menținerea masei musculare.
      Include zile de odihnă și recuperare adecvate, în funcție de nivelul și preferințele utilizatorului.
      Exercițiile trebuie să fie adaptate la nivelul utilizatorului și să se concentreze pe grupele musculare indicate în chestionar.`;
    }
    else if (user.obiectiv === 'muschi') {
      mealPrompt = `Ești un nutriționist specializat în creștere musculară.
      Creează un plan de mese COMPLET pentru 7 zile care să ajute utilizatorul să își dezvolte masa musculară de ${weightChangeGoal} kg în ${timeframeMonths} luni.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      FOARTE IMPORTANT: Trebuie să creezi mese pentru TOATE cele 7 zile ale săptămânii (zilele 0-6).
      Pentru fiecare zi, trebuie să incluzi EXACT 3 mese: breakfast, lunch și dinner.
      
      Necesarul caloric zilnic pentru menținere al utilizatorului este de ${tdee} calorii.
      CALORIILE ZILNICE ȚINTĂ pentru acest plan trebuie să fie ${targetDailyCalories} calorii.
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare aportul actual de proteine, restricțiile alimentare, obiectivele specifice și frecvența meselor indicate.
      
      Planul trebuie să asigure un surplus caloric adecvat, să fie foarte bogat în proteine (1.6-2.2g/kg corp),
      să aibă carbohidrați suficienți pentru energie și refacere, și să includă grăsimi sănătoase.
      
      Include 3 mese principale (breakfast, lunch, dinner) pentru fiecare zi (21 mese în total).`;
      
      workoutPrompt = `Ești un antrenor personal specializat în hipertrofie musculară.
      Creează un plan de antrenament pentru 7 zile care să ajute utilizatorului să își crească masa musculară cu ${weightChangeGoal} kg în ${timeframeMonths} luni.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare grupele musculare pe care dorește să se concentreze, nivelul de experiență, accesul la echipamente și frecvența antrenamentelor dorită.
      
      Organizează antrenamentele pe grupe musculare (split muscular) adecvate pentru obiectivele specificate.
      Concentrează-te pe exerciții compuse cu greutăți urmate de exerciții de izolare pentru grupele musculare prioritare.
      Adaptează seturile și repetările în funcție de nivelul de experiență indicat în chestionar.`;
    }
    else {
      mealPrompt = `Ești un nutriționist specializat în alimentație echilibrată și menținerea sănătății.
      Creează un plan de mese COMPLET pentru 7 zile care să ajute utilizatorul să își mențină greutatea și să aibă o alimentație sănătoasă.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      FOARTE IMPORTANT: Trebuie să creezi mese pentru TOATE cele 7 zile ale săptămânii (zilele 0-6).
      Pentru fiecare zi, trebuie să incluzi EXACT 3 mese: breakfast, lunch și dinner.
      
      Necesarul caloric zilnic pentru menținere al utilizatorului este de ${tdee} calorii.
      CALORIILE ZILNICE ȚINTĂ pentru acest plan trebuie să fie ${tdee} calorii.
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare obiectivele de sănătate specificate, dieta obișnuită, restricțiile alimentare și preferințele indicate.
      
      Planul trebuie să ofere un echilibru caloric, să includă o varietate de alimente din toate grupele, să fie bogat în nutrienți,
      și să respecte principiile unei alimentații sănătoase adaptate obiectivelor de wellness ale utilizatorului.
      
      Include 3 mese principale (breakfast, lunch, dinner) pentru fiecare zi (21 mese în total).`;
      
      workoutPrompt = `Ești un antrenor personal specializat în fitness general și menținerea sănătății.
      Creează un plan de antrenament pentru 7 zile care să ajute utilizatorul să își mențină condiția fizică și sănătatea.
      
      Utilizatorul are următoarele caracteristici:
      • Sex: ${user.sex}
      • Vârstă: ${user.varsta} ani
      • Înălțime: ${user.inaltime} cm
      • Greutate: ${user.greutate} kg
      
      Analizeză cu atenție răspunsurile utilizatorului la chestionar și personalizează planul în consecință.
      Ia în considerare nivelul de activitate curent, preferințele pentru practicile de wellness, nivelul de stres și obiectivele de sănătate specificate.
      
      Combină antrenamente de forță, cardio, și flexibilitate pentru un program echilibrat.
      Include zile de antrenament și activități adaptate la preferințele de wellness indicate în chestionar.
      Concentrează-te pe mișcări funcționale, exerciții pentru postura corectă și sănătatea generală.`;
    }

    const finalMealPrompt = `${mealPrompt}
    
    IMPORTANT: Returnează DOAR un obiect JSON valid, fără marcaje de cod (cum ar fi \`\`\`json), fără prefixe sau sufixe, și fără comentarii în cadrul JSON. Răspunsul tău trebuie să înceapă cu { și să se termine cu }. Structura exactă este:
    {
      "meals": [
        {
          "day": 0,
          "mealType": "breakfast",
          "name": "Numele mesei",
          "description": "Descriere scurtă",
          "recipe": "Rețeta detaliată",
          "ingredients": ["Ingredient 1", "Ingredient 2"],
          "macros": {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0
          }
        }
      ],
      "totalNutrition": {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
      }
    }`;

    const finalWorkoutPrompt = `${workoutPrompt}
    
    IMPORTANT: Returnează DOAR un obiect JSON valid, fără marcaje de cod (cum ar fi \`\`\`json), fără prefixe sau sufixe, și fără comentarii în cadrul JSON. Răspunsul tău trebuie să înceapă cu { și să se termine cu }. Structura exactă este:
    {
      "workouts": [
        {
          "day": 0,
          "name": "Numele antrenamentului",
          "description": "Descriere scurtă",
          "exercises": [
            {
              "name": "Numele exercițiului",
              "sets": 3,
              "reps": "8-12",
              "restTime": 60,
              "notes": "Note sau instrucțiuni specifice"
            }
          ],
          "duration": 45,
          "intensity": "light/moderate/high",
          "caloriesBurned": 300
        }
      ]
    }`;

    console.log('Prompt pentru planul de mese:', finalMealPrompt);
    console.log('Prompt pentru planul de antrenament:', finalWorkoutPrompt);

    const plans = await generateWithRetry(userContext, finalMealPrompt, finalWorkoutPrompt);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const day = startDate.getDay();
    if (day !== 0) {
      startDate.setDate(startDate.getDate() - day);
    }
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    await MealPlan.deleteMany({
      user: userId,
      startDate: { $gte: startDate },
      endDate: { $lte: endDate }
    });
    
    await WorkoutPlan.deleteMany({
      user: userId,
      startDate: { $gte: startDate },
      endDate: { $lte: endDate }
    });

    console.log('Salvare planuri în baza de date...');

    const mealPlan = new MealPlan({
      user: userId,
      startDate,
      endDate,
      objective: user.obiectiv,
      meals: plans.mealPlanData.meals,
      totalNutrition: plans.mealPlanData.totalNutrition,
      questionnaireResponses: questionnaireResponses
    });
    await mealPlan.save();

    const workoutPlan = new WorkoutPlan({
      user: userId,
      startDate,
      endDate,
      objective: user.obiectiv,
      workouts: plans.workoutPlanData.workouts,
      questionnaireResponses: questionnaireResponses
    });
    await workoutPlan.save();

    console.log('Planuri salvate cu succes!');

    return {
      mealPlan: mealPlan,
      workoutPlan: workoutPlan
    };
  } catch (error) {
    console.error('Eroare la generarea planurilor săptămânale:', error);
    throw new Error('Nu am putut genera planurile. Te rog să încerci din nou.');
  }
}

function calculateBMR(sex, weight, height, age) {
  // Formula Mifflin-St Jeor
  if (sex === 'masculin') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

function getActivityFactor(activityLevel) {
  const factors = {
    'sedentar': 1.2,
    'usor': 1.375,
    'moderat': 1.55,
    'activ': 1.725,
    'foarte activ': 1.9
  };
  
  return factors[activityLevel.toLowerCase()] || 1.55; // Valoare implicită pentru 'moderat'
}

function getMinHealthyCalories(sex) {
  return sex === 'masculin' ? 1500 : 1200;
}

function extractWeightChangeGoal(weightGoalResponse) {
  if (!weightGoalResponse || !weightGoalResponse.length) return 5; // Valoare implicită
  
  const match = weightGoalResponse[0].match(/\d+/);
  if (match && match.length > 0) {
    return parseInt(match[0], 10);
  }
  return 5; // Valoare implicită dacă nu găsim un număr
}

function extractTimeframeMonths(timeframeResponse) {
  if (!timeframeResponse || !timeframeResponse.length) return 3; // Valoare implicită - 3 luni
  
  const response = timeframeResponse[0];
  if (response.includes('1 lună')) return 1;
  if (response.includes('2 luni')) return 2;
  if (response.includes('3 luni')) return 3;
  if (response.includes('6 luni')) return 6;
  if (response.includes('12 luni') || response.includes('1 an')) return 12;
  if (response.includes('18 luni')) return 18;
  if (response.includes('9 luni')) return 9;
  
  // Încercăm să extragem numărul direct
  const match = response.match(/(\d+)\s*lun[iă]/);
  if (match && match.length > 1) {
    return parseInt(match[1], 10);
  }
  
  return 3; // Valoare implicită dacă nu putem extrage
}

async function generateWithRetry(userContext, mealPrompt, workoutPrompt, maxRetries = 3) {
  let lastError = null;
  
  // Calculează distribuția caloriilor pe fiecare masă
  const breakfastCalories = Math.round(userContext.targetDailyCalories * 0.25); // 25%
  const lunchCalories = Math.round(userContext.targetDailyCalories * 0.40);     // 40%
  const dinnerCalories = Math.round(userContext.targetDailyCalories * 0.35);    // 35%
  
  const simplifiedMealPrompt = `Ești un nutriționist expert specializat în creare de planuri de mese personalizate în limba română.
  Creează un plan de mese COMPLET pentru 7 zile care să ajute utilizatorul să-și atingă obiectivele.
  
  FOARTE IMPORTANT: 
  1. Trebuie să creezi mese pentru TOATE cele 7 zile ale săptămânii (zilele 0-6).
  2. Pentru fiecare zi, trebuie să incluzi EXACT 3 mese: breakfast, lunch și dinner.
  3. Fiecare masă trebuie să fie DIFERITĂ - nu repeta aceleași mese pentru zile diferite.
  4. TOATE INGREDIENTELE ȘI TEXTUL TREBUIE SĂ FIE ÎN LIMBA ROMÂNĂ.
  5. Rețetele trebuie să fie funcționale și să includă cantități specifice și instrucțiuni clare de preparare.
  6. Limitează fiecare listă de ingrediente la maximum 5-6 ingrediente principale.
  7. Descrierile să fie scurte și la obiect (maxim 10 cuvinte).
  8. Caloriile zilnice totale trebuie să fie EXACT ${userContext.targetDailyCalories} calorii/zi.
  9. Distribuie caloriile pe mese astfel:
     - Breakfast: ${breakfastCalories} calorii (25% din total)
     - Lunch: ${lunchCalories} calorii (40% din total)
     - Dinner: ${dinnerCalories} calorii (35% din total)
     - Nu devia cu mai mult de ±50 calorii per masă!
  Un exemplu de rețetă bună:
  "Amestecă 1 banană, 200g iaurt grecesc, 100ml lapte și 1 lingură de miere. Mixează toate ingredientele până obții o consistență omogenă. Servește rece."
  
  INCORECT (exemplu de rețetă proastă): "Amestecă banana cu iaurt și miere."
  
  Analizeză cu atenție obiectivul utilizatorului și răspunsurile la chestionar și personalizează planul în consecință.
  
  IMPORTANT: Returnează DOAR un obiect JSON valid, fără marcaje de cod (cum ar fi \`\`\`json), fără prefixe sau sufixe, și fără comentarii în cadrul JSON. Răspunsul tău trebuie să înceapă cu { și să se termine cu }. Structura exactă este:
  {
    "meals": [
      {
        "day": 0,
        "mealType": "breakfast",
        "name": "Numele mesei",
        "description": "Descriere scurtă",
        "recipe": "Rețeta detaliată",
        "ingredients": ["Ingredient 1", "Ingredient 2"],
        "macros": {
          "calories": 0,
          "protein": 0,
          "carbs": 0,
          "fat": 0
        }
      }
    ],
    "totalNutrition": {
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  }`;

  const simplifiedWorkoutPrompt = `Ești un antrenor personal expert specializat în creare de planuri de antrenament personalizate în limba română.
  Creează un plan de antrenament pentru 7 zile care să ajute utilizatorul să-și atingă obiectivele.
  
  FOARTE IMPORTANT: 
  1. Trebuie să creezi antrenamente pentru TOATE cele 7 zile ale săptămânii (zilele 0-6).
  2. Fiecare antrenament trebuie să fie DIFERIT - nu repeta aceleași exerciții pentru zile diferite.
  3. Descrie exercițiile în mod clar și concis.
  4. Include zile de odihnă adecvate în funcție de obiectivul utilizatorului.
  5. TEXTUL TREBUIE SĂ FIE EXCLUSIV ÎN LIMBA ROMÂNĂ.
  
  Analizeză cu atenție obiectivul utilizatorului și răspunsurile la chestionar și personalizează planul în consecință.
  
  IMPORTANT: Returnează DOAR un obiect JSON valid, fără marcaje de cod (cum ar fi \`\`\`json), fără prefixe sau sufixe, și fără comentarii în cadrul JSON. Răspunsul tău trebuie să înceapă cu { și să se termine cu }. Structura exactă este:
  {
    "workouts": [
      {
        "day": 0,
        "name": "Numele antrenamentului",
        "description": "Descriere scurtă",
        "exercises": [
          {
            "name": "Numele exercițiului",
            "sets": 3,
            "reps": "8-12",
            "restTime": 60,
            "notes": "Note sau instrucțiuni specifice"
          }
        ],
        "duration": 45,
        "intensity": "light/moderate/high",
        "caloriesBurned": 300
      }
    ]
  }`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Încercare #${attempt} de generare planuri...`);
      
      const mealPlanResponse = await openaiClient.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: simplifiedMealPrompt },
          { role: 'user', content: `Creează un plan de mese în limba română bazat pe profilul: ${JSON.stringify(userContext, null, 2)}` }
        ],
        temperature: 0.7,
        max_tokens: 4500
      });
      
      const workoutPlanResponse = await openaiClient.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: simplifiedWorkoutPrompt },
          { role: 'user', content: `Creează un plan de antrenament în limba română bazat pe profilul: ${JSON.stringify(userContext, null, 2)}` }
        ],
        temperature: 0.7,
        max_tokens: 4500
      });
      
      const mealPlanContent = mealPlanResponse.data.choices[0].message.content;
      const workoutPlanContent = workoutPlanResponse.data.choices[0].message.content;
      
      console.log(`=== RĂSPUNS COMPLET PLAN DE MESE (încercare #${attempt}) ===`);
      console.log(mealPlanContent);
      console.log(`=== FINAL RĂSPUNS PLAN DE MESE ===`);
      
      console.log(`=== RĂSPUNS COMPLET PLAN DE ANTRENAMENT (încercare #${attempt}) ===`);
      console.log(workoutPlanContent);
      console.log(`=== FINAL RĂSPUNS PLAN DE ANTRENAMENT ===`);
      
      console.log(`Răspuns plan de mese (încercare #${attempt}):`, mealPlanContent.substring(0, 200) + '...');
      console.log(`Răspuns plan de antrenament (încercare #${attempt}):`, workoutPlanContent.substring(0, 200) + '...');
      
      console.log(`Parsare răspuns plan de mese (încercare #${attempt})...`);
      const mealPlanData = parseJsonResponse(mealPlanContent);
      
      console.log(`Parsare răspuns plan de antrenament (încercare #${attempt})...`);
      const workoutPlanData = parseJsonResponse(workoutPlanContent);
      
      ensureAllDaysHaveMeals(mealPlanData);
      
      // Verificăm aportul caloric zilnic
      const caloriesByDay = calculateCaloriesByDay(mealPlanData);
      const validCalories = validateCaloriesByDay(caloriesByDay, userContext.targetDailyCalories);
      
      if (!validCalories) {
        throw new Error('Aportul caloric nu respectă cerințele minime');
      }
      
      if (!validateMealPlan(mealPlanData)) {
        throw new Error('Datele planului de mese nu sunt valide');
      }
      
      if (!validateWorkoutPlan(workoutPlanData)) {
        throw new Error('Datele planului de antrenament nu sunt valide');
      }
      
      return { mealPlanData, workoutPlanData };
    } catch (error) {
      console.error(`Eroare în încercarea #${attempt}:`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.log('S-au epuizat toate încercările. Se generează planuri de rezervă diverse...');
  return {
    mealPlanData: { 
      meals: createDiversePlaceholderMeals(userContext.targetDailyCalories, userContext.gender), 
      totalNutrition: calculateTotalNutrition(userContext.targetDailyCalories)
    },
    workoutPlanData: { workouts: createDiversePlaceholderWorkouts() }
  };
}

function calculateCaloriesByDay(mealPlanData) {
  const caloriesByDay = {};
  
  if (!mealPlanData || !mealPlanData.meals || !Array.isArray(mealPlanData.meals)) {
    return caloriesByDay;
  }
  
  for (let meal of mealPlanData.meals) {
    if (meal.day === undefined || !meal.macros || meal.macros.calories === undefined) {
      continue;
    }
    
    if (!caloriesByDay[meal.day]) {
      caloriesByDay[meal.day] = 0;
    }
    
    caloriesByDay[meal.day] += meal.macros.calories;
  }
  
  return caloriesByDay;
}

function validateCaloriesByDay(caloriesByDay, targetCalories) {
  // Permitem o variație de ±15% față de țintă
  const minAcceptable = targetCalories * 0.85;
  const maxAcceptable = targetCalories * 1.15;
  
  let isValid = true;
  const days = Object.keys(caloriesByDay);
  
  if (days.length < 7) {
    return false;
  }
  
  for (let day of days) {
    const calories = caloriesByDay[day];
    if (calories < minAcceptable || calories > maxAcceptable) {
      console.log(`Ziua ${day}: Calorii ${calories} în afara intervalului acceptabil [${minAcceptable}-${maxAcceptable}]`);
      isValid = false;
    }
  }
  
  return isValid;
}

function calculateTotalNutrition(targetDailyCalories) {
  return {
    calories: targetDailyCalories * 7,
    protein: Math.round(targetDailyCalories * 0.3 / 4) * 7, // 30% din calorii din proteine
    carbs: Math.round(targetDailyCalories * 0.4 / 4) * 7,   // 40% din calorii din carbohidrați
    fat: Math.round(targetDailyCalories * 0.3 / 9) * 7      // 30% din calorii din grăsimi
  };
}

function ensureAllDaysHaveMeals(mealPlanData) {
  if (!mealPlanData || !mealPlanData.meals || !Array.isArray(mealPlanData.meals)) {
    return;
  }
  
  const daysAndTypes = {};
  for (let day = 0; day <= 6; day++) {
    daysAndTypes[day] = {
      breakfast: false,
      lunch: false,
      dinner: false
    };
  }
  
  mealPlanData.meals.forEach(meal => {
    if (meal.day >= 0 && meal.day <= 6 && daysAndTypes[meal.day] && 
        (meal.mealType === 'breakfast' || meal.mealType === 'lunch' || meal.mealType === 'dinner')) {
      daysAndTypes[meal.day][meal.mealType] = true;
    }
  });
  
  const missingMeals = [];
  for (let day = 0; day <= 6; day++) {
    ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
      if (!daysAndTypes[day][mealType]) {
        missingMeals.push({ day, mealType });
      }
    });
  }
  
  if (missingMeals.length > 0) {
    console.log(`Completăm ${missingMeals.length} mese lipsă pentru a acoperi toate zilele săptămânii...`);
    
    missingMeals.forEach(({ day, mealType }) => {
      const similarMeal = mealPlanData.meals.find(m => m.mealType === mealType);
      
      if (similarMeal) {
        const newMeal = {
          day,
          mealType,
          name: `${similarMeal.name} (Varianta pentru ziua ${day+1})`,
          description: similarMeal.description,
          recipe: similarMeal.recipe,
          ingredients: [...similarMeal.ingredients],
          macros: { ...similarMeal.macros }
        };
        
        mealPlanData.meals.push(newMeal);
      } else {
        mealPlanData.meals.push(getDefaultMeal(day, mealType));
      }
    });
    
    recalculateTotalNutrition(mealPlanData);
  }
}

function getDefaultMeal(day, mealType) {
  const defaultMeals = {
    breakfast: {
      name: "Omletă cu legume",
      description: "O omletă simplă cu legume de sezon.",
      recipe: "Bate 3 ouă, adaugă legumele tocate și gătește într-o tigaie antiaderentă.",
      ingredients: ["3 ouă", "legume mixte", "ulei de măsline"],
      macros: {
        calories: 350,
        protein: 25,
        carbs: 10,
        fat: 24
      }
    },
    lunch: {
      name: "Salată cu piept de pui",
      description: "Salată hrănitoare cu piept de pui la grătar.",
      recipe: "Gătește 150g piept de pui la grătar. Amestecă cu salată verde, roșii și castraveți.",
      ingredients: ["piept de pui", "salată verde", "roșii", "castraveți", "ulei de măsline"],
      macros: {
        calories: 400,
        protein: 40,
        carbs: 15,
        fat: 20
      }
    },
    dinner: {
      name: "Pește la cuptor cu legume",
      description: "File de pește la cuptor cu garnitură de legume.",
      recipe: "Coace 200g file de pește în cuptor cu legume asortate.",
      ingredients: ["file de pește", "ardei", "dovlecei", "roșii", "ulei de măsline"],
      macros: {
        calories: 450,
        protein: 35,
        carbs: 20,
        fat: 25
      }
    }
  };
  
  return {
    day,
    mealType,
    ...defaultMeals[mealType]
  };
}

function recalculateTotalNutrition(mealPlanData) {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  };
  
  mealPlanData.meals.forEach(meal => {
    if (meal.macros) {
      totals.calories += meal.macros.calories || 0;
      totals.protein += meal.macros.protein || 0;
      totals.carbs += meal.macros.carbs || 0;
      totals.fat += meal.macros.fat || 0;
    }
  });
  
  mealPlanData.totalNutrition = totals;
}

function parseJsonResponse(content) {
  try {
    let cleanedContent = content;
    
    cleanedContent = cleanedContent.replace(/```json|```/g, '');
    
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}');
    
    if (jsonStart >= 0 && jsonEnd >= 0) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
    } else {
      throw new Error('Nu s-a putut identifica un obiect JSON valid');
    }
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Eroare la parsarea JSON-ului curățat:', parseError);
      
      if (cleanedContent.includes('"meals"')) {
        return {
          meals: extractMealsFromInvalidJson(cleanedContent),
          totalNutrition: {
            calories: 2000,
            protein: 150,
            carbs: 200,
            fat: 70
          }
        };
      } else if (cleanedContent.includes('"workouts"')) {
        return {
          workouts: extractWorkoutsFromInvalidJson(cleanedContent)
        };
      }
      
      throw new Error('Nu s-a putut parsa JSON-ul și nu s-a putut crea un backup');
    }
  } catch (error) {
    console.error('Eroare finală la parsarea JSON-ului:', error);
    throw new Error('Nu am putut procesa răspunsul. Vă rugăm încercați din nou.');
  }
}

function extractMealsFromInvalidJson(content) {
  try {
    const mealsMatch = content.match(/"meals"\s*:\s*\[([\s\S]*?)(?:\]\s*,\s*"totalNutrition"|\]$)/);
    if (mealsMatch && mealsMatch[1]) {
      const mealItems = [];
      let individualMealMatches = mealsMatch[1].match(/\{\s*"day"\s*:[^}]+\}/g);
      
      if (individualMealMatches) {
        individualMealMatches.forEach(mealJson => {
          try {
            mealJson = mealJson.replace(/,\s*$/, '');
            const meal = JSON.parse(mealJson);
            mealItems.push(meal);
          } catch (e) {
            console.log('Eroare la parsarea unei mese individuale:', e);
          }
        });
      }
      
      if (mealItems.length > 0) {
        return mealItems;
      }
    }
    
    return createDiversePlaceholderMeals();
  } catch (error) {
    console.error('Eroare la extragerea meselor:', error);
    return createDiversePlaceholderMeals();
  }
}

function extractWorkoutsFromInvalidJson(content) {
  try {
    const workoutsMatch = content.match(/"workouts"\s*:\s*\[([\s\S]*?)(?:\]\s*,|\]$)/);
    if (workoutsMatch && workoutsMatch[1]) {
      const workoutItems = [];
      let individualWorkoutMatches = workoutsMatch[1].match(/\{\s*"day"\s*:[^}]+\}/g);
      
      if (individualWorkoutMatches) {
        individualWorkoutMatches.forEach(workoutJson => {
          try {
            workoutJson = workoutJson.replace(/,\s*$/, '');
            const workout = JSON.parse(workoutJson);
            workoutItems.push(workout);
          } catch (e) {
            console.log('Eroare la parsarea unui antrenament individual:', e);
          }
        });
      }
      
      if (workoutItems.length > 0) {
        return workoutItems;
      }
    }
    
    return createDiversePlaceholderWorkouts();
  } catch (error) {
    console.error('Eroare la extragerea antrenamentelor:', error);
    return createDiversePlaceholderWorkouts();
  }
}

function validateMealPlan(mealPlanData) {
  if (!mealPlanData || !Array.isArray(mealPlanData.meals)) {
    return false;
  }
  
  if (mealPlanData.meals.length === 0) {
    return false;
  }
  
  for (const meal of mealPlanData.meals) {
    if (meal.day === undefined || !meal.mealType || !meal.name || !Array.isArray(meal.ingredients) || !meal.macros) {
      return false;
    }
  }
  
  if (!mealPlanData.totalNutrition || 
      mealPlanData.totalNutrition.calories === undefined || 
      mealPlanData.totalNutrition.protein === undefined || 
      mealPlanData.totalNutrition.carbs === undefined || 
      mealPlanData.totalNutrition.fat === undefined) {
    return false;
  }
  
  return true;
}

function validateWorkoutPlan(workoutPlanData) {
  if (!workoutPlanData || !Array.isArray(workoutPlanData.workouts)) {
    return false;
  }
  
  if (workoutPlanData.workouts.length === 0) {
    return false;
  }
  
  for (const workout of workoutPlanData.workouts) {
    if (workout.day === undefined || !workout.name || !workout.description || 
        !Array.isArray(workout.exercises) || workout.duration === undefined) {
      return false;
    }
    
    for (const exercise of workout.exercises) {
      if (!exercise.name || exercise.sets === undefined || !exercise.reps) {
        return false;
      }
    }
  }
  
  return true;
}

function createDiversePlaceholderMeals(targetDailyCalories = 2000, gender = 'masculin') {
  // Calculăm distribuția caloriilor pe mese
  const breakfastCalories = Math.round(targetDailyCalories * 0.25); // 25% din caloriile zilnice
  const lunchCalories = Math.round(targetDailyCalories * 0.4);      // 40% din caloriile zilnice
  const dinnerCalories = Math.round(targetDailyCalories * 0.35);    // 35% din caloriile zilnice
  
  const breakfastOptions = [
    {
      name: "Omletă cu legume",
      description: "Omletă simplă cu legume proaspete",
      recipe: "Bate 3 ouă într-un bol, adaugă sare și piper. Călește 50g ardei, 30g ceapă și 50g spanac în 1 lingură ulei de măsline. Toarnă ouăle peste legume și gătește 3-4 minute.",
      ingredients: ["3 ouă", "50g ardei", "30g ceapă", "50g spanac", "1 lingură ulei de măsline"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.3 / 4),
        carbs: Math.round(breakfastCalories * 0.3 / 4),
        fat: Math.round(breakfastCalories * 0.4 / 9)
      }
    },
    {
      name: "Terci de ovăz cu fructe",
      description: "Terci cremos cu fructe de pădure",
      recipe: "Fierbe 50g fulgi de ovăz în 200ml lapte timp de 5 minute. Adaugă 100g fructe de pădure și 1 lingură de miere. Amestecă bine și servește cald.",
      ingredients: ["50g fulgi de ovăz", "200ml lapte", "100g fructe de pădure", "1 lingură miere", "1/2 linguriță scorțișoară"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.2 / 4),
        carbs: Math.round(breakfastCalories * 0.6 / 4),
        fat: Math.round(breakfastCalories * 0.2 / 9)
      }
    },
    {
      name: "Iaurt grecesc cu nuci și miere",
      description: "Iaurt cremos cu topping crocant",
      recipe: "Pune într-un bol 200g iaurt grecesc. Adaugă deasupra 30g nuci tocate, 1 lingură miere și presară 1 linguriță semințe de chia și puțină scorțișoară.",
      ingredients: ["200g iaurt grecesc", "30g nuci", "1 lingură miere", "1 linguriță semințe de chia", "1/4 linguriță scorțișoară"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.3 / 4),
        carbs: Math.round(breakfastCalories * 0.3 / 4),
        fat: Math.round(breakfastCalories * 0.4 / 9)
      }
    },
    {
      name: "Smoothie proteic",
      description: "Băutură răcoritoare bogată în proteine",
      recipe: "Mixează în blender 1 banană, 200ml lapte de migdale, 1 măsură pudră proteică și 100g fructe de pădure congelate. Adaugă 1 linguriță semințe de in la final.",
      ingredients: ["1 banană", "200ml lapte de migdale", "30g pudră proteică", "100g fructe de pădure", "1 linguriță semințe de in"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.4 / 4),
        carbs: Math.round(breakfastCalories * 0.4 / 4),
        fat: Math.round(breakfastCalories * 0.2 / 9)
      }
    },
    {
      name: "Toast cu avocado și ou",
      description: "Toast hrănitor și sățios",
      recipe: "Prăjește 1 felie de pâine integrală. Zdrobește 1/2 avocado și întinde pe pâine. Adaugă 1 ou fiert tăiat felii și 3-4 roșii cherry tăiate jumătăți.",
      ingredients: ["1 felie pâine integrală", "1/2 avocado", "1 ou", "3-4 roșii cherry", "1 linguriță semințe de susan"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.25 / 4),
        carbs: Math.round(breakfastCalories * 0.35 / 4),
        fat: Math.round(breakfastCalories * 0.4 / 9)
      }
    },
    {
      name: "Clătite proteice",
      description: "Clătite ușoare bogate în proteine",
      recipe: "Amestecă 2 ouă cu 1 banană coaptă zdrobită și 1 măsură de pudră proteică. Gătește în tigaie ca pe clătite normale, câte 2-3 minute pe fiecare parte.",
      ingredients: ["2 ouă", "1 banană", "30g pudră proteică", "1/4 linguriță scorțișoară", "50g afine pentru servire"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.35 / 4),
        carbs: Math.round(breakfastCalories * 0.4 / 4),
        fat: Math.round(breakfastCalories * 0.25 / 9)
      }
    },
    {
      name: "Budincă de chia",
      description: "Budincă cremoasă cu semințe de chia",
      recipe: "Amestecă 3 linguri semințe de chia cu 250ml lapte de cocos. Lasă la frigider peste noapte. Dimineața adaugă 1 lingură miere și 100g fructe proaspete.",
      ingredients: ["3 linguri semințe de chia", "250ml lapte de cocos", "1 lingură miere", "100g fructe proaspete", "20g nuci"],
      macros: { 
        calories: breakfastCalories,
        protein: Math.round(breakfastCalories * 0.15 / 4),
        carbs: Math.round(breakfastCalories * 0.45 / 4),
        fat: Math.round(breakfastCalories * 0.4 / 9)
      }
    }
  ];
  
  const lunchOptions = [
    {
      name: "Salată cu pui",
      description: "Salată consistentă cu piept de pui",
      recipe: "Gătește 150g piept de pui la grătar cu puțin ulei. Amestecă într-un bol 100g salată verde, 1 roșie tăiată, 1/2 castravete și 1 lingură ulei de măsline.",
      ingredients: ["150g piept de pui", "100g salată verde", "1 roșie", "1/2 castravete", "1 lingură ulei de măsline"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.4 / 4),
        carbs: Math.round(lunchCalories * 0.2 / 4),
        fat: Math.round(lunchCalories * 0.4 / 9)
      }
    },
    {
      name: "Bowl cu quinoa și legume",
      description: "Bowl nutritiv cu proteină vegetală",
      recipe: "Gătește 70g quinoa conform instrucțiunilor. Adaugă 100g năut fiert, 1/2 ardei roșu, 1 morcov ras și 1 lingură dressing de lămâie.",
      ingredients: ["70g quinoa", "100g năut", "1/2 ardei roșu", "1 morcov", "1 lingură dressing de lămâie"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.25 / 4),
        carbs: Math.round(lunchCalories * 0.55 / 4),
        fat: Math.round(lunchCalories * 0.2 / 9)
      }
    },
    {
      name: "Supă cremă de legume",
      description: "Supă hrănitoare și ușor de digerat",
      recipe: "Călește 1 ceapă tocată, adaugă 1 dovlecel, 1 morcov, 1 cartof, toate tăiate cubulețe. Acoperă cu apă și fierbe 20 minute. Pasează și adaugă 2 linguri smântână.",
      ingredients: ["1 dovlecel", "1 morcov", "1 cartof", "1 ceapă", "2 linguri smântână"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.15 / 4),
        carbs: Math.round(lunchCalories * 0.6 / 4),
        fat: Math.round(lunchCalories * 0.25 / 9)
      }
    },
    {
      name: "Wrap cu ton și legume",
      description: "Wrap rapid și bogat în proteine",
      recipe: "Scurge 1 conservă de ton în apă. Umple 1 lipie integrală cu tonul, salată, 1/4 ardei tăiat și 2 linguri sos de iaurt.",
      ingredients: ["1 lipie integrală", "100g ton în apă", "30g salată", "1/4 ardei", "2 linguri sos de iaurt"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.35 / 4),
        carbs: Math.round(lunchCalories * 0.4 / 4),
        fat: Math.round(lunchCalories * 0.25 / 9)
      }
    },
    {
      name: "Paste integrale cu pui",
      description: "Paste hrănitoare cu piept de pui",
      recipe: "Fierbe 80g paste integrale. Separat, gătește 100g piept de pui tăiat cubulețe cu 100g sos de roșii, busuioc și usturoi. Amestecă pastele cu sosul.",
      ingredients: ["80g paste integrale", "100g piept de pui", "100g sos de roșii", "frunze de busuioc", "1 cățel usturoi"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.3 / 4),
        carbs: Math.round(lunchCalories * 0.5 / 4),
        fat: Math.round(lunchCalories * 0.2 / 9)
      }
    },
    {
      name: "Orez brun cu tofu",
      description: "Mâncare vegetariană bogată în proteine",
      recipe: "Fierbe 70g orez brun. Prăjește 150g tofu tăiat cuburi cu 1 lingură ulei. Adaugă 50g broccoli, 1 morcov și 1 lingură sos de soia.",
      ingredients: ["70g orez brun", "150g tofu", "50g broccoli", "1 morcov", "1 lingură sos de soia"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.25 / 4),
        carbs: Math.round(lunchCalories * 0.55 / 4),
        fat: Math.round(lunchCalories * 0.2 / 9)
      }
    },
    {
      name: "Sandviș cu hummus și legume",
      description: "Sandviș vegetal consistent",
      recipe: "Întinde 3 linguri hummus pe 2 felii de pâine integrală. Adaugă felii de roșie, castravete și frunze de spanac.",
      ingredients: ["2 felii pâine integrală", "3 linguri hummus", "1 roșie", "1/2 castravete", "frunze de spanac"],
      macros: { 
        calories: lunchCalories,
        protein: Math.round(lunchCalories * 0.2 / 4),
        carbs: Math.round(lunchCalories * 0.55 / 4),
        fat: Math.round(lunchCalories * 0.25 / 9)
      }
    }
  ];
  
  const dinnerOptions = [
    {
      name: "Somon la cuptor cu legume",
      description: "Pește gătit la cuptor cu garnitură",
      recipe: "Coace 150g file de somon la 180°C pentru 15-20 minute. Servește cu 100g broccoli și 100g morcovi fierți la abur. Stropește cu suc de lămâie și ulei de măsline.",
      ingredients: ["150g file de somon", "100g broccoli", "100g morcovi", "1/2 lămâie", "1 lingură ulei de măsline"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.4 / 4),
        carbs: Math.round(dinnerCalories * 0.2 / 4),
        fat: Math.round(dinnerCalories * 0.4 / 9)
      }
    },
    {
      name: "Piept de pui cu orez brun",
      description: "Meniu echilibrat proteic-carbohidrați",
      recipe: "Gătește 150g piept de pui la grătar cu condimente. Fierbe 70g orez brun. Adaugă 1/2 ardei gras și 1/4 ceapă călite.",
      ingredients: ["150g piept de pui", "70g orez brun", "1/2 ardei gras", "1/4 ceapă", "mix de condimente"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.35 / 4),
        carbs: Math.round(dinnerCalories * 0.45 / 4),
        fat: Math.round(dinnerCalories * 0.2 / 9)
      }
    },
    {
      name: "Tocană de linte",
      description: "Tocană vegană bogată în fibre",
      recipe: "Călește 1 ceapă și 1 morcov. Adaugă 100g linte roșie, 2 roșii tăiate cubulețe și condimente. Fierbe 20-25 minute cu capac.",
      ingredients: ["100g linte", "2 roșii", "1 morcov", "1 ceapă", "1 cățel usturoi"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.25 / 4),
        carbs: Math.round(dinnerCalories * 0.6 / 4),
        fat: Math.round(dinnerCalories * 0.15 / 9)
      }
    },
    {
      name: "Omletă cu legume și brânză",
      description: "Cină rapidă bogată în proteine",
      recipe: "Bate 3 ouă, adaugă 1/4 ardei, 50g ciuperci și 1/4 ceapă tăiate mărunt. Gătește în tigaie cu puțin ulei. Presară 30g brânză feta deasupra.",
      ingredients: ["3 ouă", "1/4 ardei", "50g ciuperci", "1/4 ceapă", "30g brânză feta"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.35 / 4),
        carbs: Math.round(dinnerCalories * 0.15 / 4),
        fat: Math.round(dinnerCalories * 0.5 / 9)
      }
    },
    {
      name: "Curcan la grătar cu cartofi dulci",
      description: "Cină hrănitoare post-antrenament",
      recipe: "Gătește 150g piept de curcan la grătar. Coace 150g cartofi dulci tăiați cuburi la 200°C timp de 25 minute cu rozmarin și 1 lingură ulei de măsline.",
      ingredients: ["150g piept de curcan", "150g cartofi dulci", "1 crenguță rozmarin", "1 lingură ulei de măsline", "1 cățel usturoi"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.4 / 4),
        carbs: Math.round(dinnerCalories * 0.4 / 4),
        fat: Math.round(dinnerCalories * 0.2 / 9)
      }
    },
    {
      name: "Tofu cu legume la wok",
      description: "Stir-fry vegetarian ușor de preparat",
      recipe: "Prăjește 150g tofu tăiat cuburi în 1 lingură ulei. Adaugă 1/2 ardei, 1 morcov, 100g ciuperci și 1 lingură sos de soia. Călește 5-7 minute.",
      ingredients: ["150g tofu", "1/2 ardei", "1 morcov", "100g ciuperci", "1 lingură sos de soia"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.3 / 4),
        carbs: Math.round(dinnerCalories * 0.35 / 4),
        fat: Math.round(dinnerCalories * 0.35 / 9)
      }
    },
    {
      name: "Chiftele de fasole cu salată",description: "Chiftele vegane cu garnitură proaspătă",
      recipe: "Pasează 200g fasole roșie fiartă cu 1/4 ceapă, 1 cățel usturoi și condimente. Formează chiftele și coace-le 20 minute la 180°C. Servește cu salată verde și roșii.",
      ingredients: ["200g fasole roșie", "1/4 ceapă", "1 cățel usturoi", "50g salată verde", "1 roșie"],
      macros: { 
        calories: dinnerCalories,
        protein: Math.round(dinnerCalories * 0.25 / 4),
        carbs: Math.round(dinnerCalories * 0.5 / 4),
        fat: Math.round(dinnerCalories * 0.25 / 9)
      }
    }
  ];

  const meals = [];
  
  for (let day = 0; day <= 6; day++) {
    // Asigură-te că avem suficiente opțiuni pentru toate zilele
    const breakfastIndex = day % breakfastOptions.length;
    const lunchIndex = day % lunchOptions.length;
    const dinnerIndex = day % dinnerOptions.length;
    
    meals.push({
      day: day,
      mealType: "breakfast",
      ...breakfastOptions[breakfastIndex]
    });
    
    meals.push({
      day: day,
      mealType: "lunch",
      ...lunchOptions[lunchIndex]
    });
    
    meals.push({
      day: day,
      mealType: "dinner",
      ...dinnerOptions[dinnerIndex]
    });
  }
  
  return meals;
}

function createDiversePlaceholderWorkouts() {
  return [
    {
      day: 0,
      name: "Antrenament Full Body",
      description: "Antrenament complet pentru tot corpul",
      exercises: [
        {
          name: "Genuflexiuni",
          sets: 3,
          reps: "10-12",
          restTime: 60,
          notes: "Menține spatele drept"
        },
        {
          name: "Flotări",
          sets: 3,
          reps: "10-15",
          restTime: 60,
          notes: "Coboară până când pieptul aproape atinge solul"
        },
        {
          name: "Deadlift",
          sets: 3,
          reps: "8-10",
          restTime: 90,
          notes: "Concentrează-te pe forma corectă"
        }
      ],
      duration: 45,
      intensity: "moderate",
      caloriesBurned: 350
    },
    {
      day: 1,
      name: "Cardio HIIT",
      description: "Antrenament intens în intervale",
      exercises: [
        {
          name: "Sprint-uri",
          sets: 6,
          reps: "30 sec sprint / 30 sec pauză",
          restTime: 30,
          notes: "Efort maxim în intervale"
        },
        {
          name: "Burpees",
          sets: 4,
          reps: "10",
          restTime: 45,
          notes: "Mișcare completă și controlată"
        }
      ],
      duration: 30,
      intensity: "high",
      caloriesBurned: 400
    },
    {
      day: 2,
      name: "Partea Superioară",
      description: "Antrenament pentru piept, umeri și brațe",
      exercises: [
        {
          name: "Bench Press",
          sets: 4,
          reps: "8-10",
          restTime: 90,
          notes: "Concentrează-te pe contracția mușchilor pectorali"
        },
        {
          name: "Tracțiuni",
          sets: 3,
          reps: "6-8",
          restTime: 90,
          notes: "Dacă e necesar, folosește banda elastică"
        },
        {
          name: "Ridicări laterale",
          sets: 3,
          reps: "12-15",
          restTime: 60,
          notes: "Menține coatele ușor îndoite"
        }
      ],
      duration: 50,
      intensity: "moderate",
      caloriesBurned: 320
    },
    {
      day: 3,
      name: "Zi de Recuperare",
      description: "Odihnă activă și stretching",
      exercises: [
        {
          name: "Plimbare",
          sets: 1,
          reps: "30 min",
          restTime: 0,
          notes: "Ritm moderat, în aer liber dacă e posibil"
        },
        {
          name: "Stretching",
          sets: 1,
          reps: "15 min",
          restTime: 0,
          notes: "Întinderi pentru tot corpul"
        }
      ],
      duration: 45,
      intensity: "light",
      caloriesBurned: 150
    },
    {
      day: 4,
      name: "Partea Inferioară",
      description: "Antrenament pentru picioare și abdomen",
      exercises: [
        {
          name: "Leg Press",
          sets: 4,
          reps: "10-12",
          restTime: 90,
          notes: "Coboară până formezi un unghi de 90° la genunchi"
        },
        {
          name: "Romanian Deadlift",
          sets: 3,
          reps: "10-12",
          restTime: 90,
          notes: "Menține spatele drept"
        },
        {
          name: "Abdomene",
          sets: 3,
          reps: "15-20",
          restTime: 60,
          notes: "Contracție completă a mușchilor abdominali"
        }
      ],
      duration: 50,
      intensity: "moderate",
      caloriesBurned: 380
    },
    {
      day: 5,
      name: "Cardio Steady State",
      description: "Antrenament cardio de ritm constant",
      exercises: [
        {
          name: "Alergare ușoară",
          sets: 1,
          reps: "40 min",
          restTime: 0,
          notes: "Menține un ritm confortabil"
        }
      ],
      duration: 40,
      intensity: "moderate",
      caloriesBurned: 320
    },
    {
      day: 6,
      name: "Antrenament Funcțional",
      description: "Exerciții complexe pentru tot corpul",
      exercises: [
        {
          name: "Kettlebell Swings",
          sets: 3,
          reps: "15-20",
          restTime: 60,
          notes: "Utilizează forța din șolduri"
        },
        {
          name: "Battle Ropes",
          sets: 3,
          reps: "30 sec",
          restTime: 60,
          notes: "Menține un ritm constant și intens"
        },
        {
          name: "Box Jumps",
          sets: 3,
          reps: "10-12",
          restTime: 60,
          notes: "Aterizare controlată"
        }
      ],
      duration: 45,
      intensity: "moderate",
      caloriesBurned: 350
    }
  ];
}

async function getCurrentPlans(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const mealPlan = await MealPlan.findOne({
      user: userId,
      startDate: { $lte: today },
      endDate: { $gte: today }
    });
    
    const workoutPlan = await WorkoutPlan.findOne({
      user: userId,
      startDate: { $lte: today },
      endDate: { $gte: today }
    });

    if (mealPlan) {
      console.log('Structura MealPlan în planningService:', {
        id: mealPlan._id,
        totalMeals: mealPlan.meals.length,
        sampleMealKeys: mealPlan.meals.length > 0 ? Object.keys(mealPlan.meals[0]) : [],
        sampleMealComplete: mealPlan.meals.length > 0 ? JSON.stringify(mealPlan.meals[0]) : 'No meals'
      });
      
      console.log('TOATE MESELE DIN PLANUL CURENT:', JSON.stringify(mealPlan.meals, null, 2));
    }
    
    if (workoutPlan) {
      console.log('TOATE ANTRENAMENTELE DIN PLANUL CURENT:', JSON.stringify(workoutPlan.workouts, null, 2));
    }
    
    return {
      mealPlan,
      workoutPlan,
      currentDay: today.getDay()
    };
  } catch (error) {
    console.error('Eroare la obținerea planurilor curente:', error);
    throw new Error('Nu am putut obține planurile curente.');
  }
}

async function updateMealStatus(userId, planId, mealIndex, completed, skipped) {
  try {
    const mealPlan = await MealPlan.findOne({
      _id: planId,
      user: userId
    });
    
    if (!mealPlan) {
      throw new Error('Plan negăsit sau acces neautorizat');
    }
    
    if (mealIndex < 0 || mealIndex >= mealPlan.meals.length) {
      throw new Error('Index de masă invalid');
    }
    
    mealPlan.meals[mealIndex].completed = completed;
    mealPlan.meals[mealIndex].skipped = skipped;
    
    await mealPlan.save();

    console.log('Meal actualizată:', {
      mealId: mealPlan._id,
      mealIndex,
      mealData: JSON.stringify(mealPlan.meals[mealIndex])
    });
    
    return mealPlan;
  } catch (error) {
    console.error('Eroare la actualizarea statusului mesei:', error);
    throw new Error('Nu am putut actualiza statusul mesei.');
  }
}

async function updateWorkoutStatus(userId, planId, workoutIndex, completed, skipped) {
  try {
    const workoutPlan = await WorkoutPlan.findOne({
      _id: planId,
      user: userId
    });
    
    if (!workoutPlan) {
      throw new Error('Plan negăsit sau acces neautorizat');
    }
    
    if (workoutIndex < 0 || workoutIndex >= workoutPlan.workouts.length) {
      throw new Error('Index de antrenament invalid');
    }
    
    workoutPlan.workouts[workoutIndex].completed = completed;
    workoutPlan.workouts[workoutIndex].skipped = skipped;
    
    await workoutPlan.save();
    
    return workoutPlan;
  } catch (error) {
    console.error('Eroare la actualizarea statusului antrenamentului:', error);
    throw new Error('Nu am putut actualiza statusul antrenamentului.');
  }
}

module.exports = {
  generateWeeklyPlans,
  getCurrentPlans,
  updateMealStatus,
  updateWorkoutStatus,
  ensureAllDaysHaveMeals,
  calculateBMR,
  getActivityFactor,
  getMinHealthyCalories,
  extractTimeframeMonths,
  validateCaloriesByDay
};