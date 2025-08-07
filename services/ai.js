// server/services/ai.js
const { openaiClient, SYSTEM_PROMPTS } = require('../config/openai');

/**
 * Obține răspuns de la OpenAI adaptat obiectivului utilizatorului
 * @param {string} message - Mesajul utilizatorului
 * @param {string} objective - Obiectivul utilizatorului (slabire, muschi, mentinere)
 * @param {object} userData - Date despre utilizator pentru personalizare (opțional)
 * @param {array} conversationHistory - Istoricul conversației (opțional)
 * @returns {Promise<string>} - Răspunsul AI
 */
async function getAIResponse(message, objective, userData = null, conversationHistory = []) {
  try {
    // Verificăm dacă obiectivul este valid sau folosim default
    const validObjective = ['slabire', 'muschi', 'mentinere'].includes(objective) 
      ? objective 
      : 'mentinere';
    
    // Pregătim contextul utilizatorului pentru personalizare
    let userContext = '';
    if (userData) {
      userContext = `Informații despre utilizator:
      - Nume: ${userData.nume || 'N/A'}
      - Sex: ${userData.sex || 'N/A'}
      - Vârstă: ${userData.varsta || 'N/A'} ani
      - Înălțime: ${userData.inaltime || 'N/A'} cm
      - Greutate: ${userData.greutate || 'N/A'} kg
      - Nivel de activitate: ${userData.nivelActivitate || 'moderat'}
      ${userData.alteInformatii ? `- Informații adiționale: ${userData.alteInformatii}` : ''}`;
    }

    // Construim mesajele pentru API
    const messages = [
      { role: 'system', content: SYSTEM_PROMPTS[validObjective] + (userContext ? `\n\n${userContext}` : '') },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Realizăm cererea către API
    const response = await openaiClient.post('/chat/completions', {
      model: 'gpt-4o-mini', // Folosim modelul GPT-4 pentru performanță maximă
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Extragem și returnăm răspunsul
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Eroare la comunicarea cu OpenAI:', error);
    throw new Error('Eroare la comunicarea cu asistentul AI');
  }
}

/**
 * Analizează o fotografie a alimentelor folosind modelul Vision al OpenAI
 * @param {string} base64Image - Imaginea în format base64
 * @returns {Promise<object>} - Informații despre alimentele detectate
 */
async function analyzeFood(base64Image) {
  try {
    // Prompt sistem mai specific și directiv
    const systemPrompt = `Ești un expert în nutriție specializat în identificarea alimentelor și estimarea valorilor nutriționale.
    
    IMPORTANT: Dacă vezi orice aliment în imagine, identifică-l și oferă detalii despre el. Dacă nu ești complet sigur, 
    oferă cea mai bună estimare a ta și menționează că este o aproximare.
    
    Trebuie să returnezi EXACT următorul format JSON fără nicio explicație adițională:
    {
      "success": true,
      "foods": [
        {
          "name": "Numele alimentului",
          "portion": "Cantitatea/porția estimată",
          "calories": "Calorii estimate",
          "protein": "Proteine în grame",
          "carbs": "Carbohidrați în grame",
          "fat": "Grăsimi în grame"
        }
      ],
      "totalNutrition": {
        "calories": "Total calorii",
        "protein": "Total proteine (g)",
        "carbs": "Total carbohidrați (g)", 
        "fat": "Total grăsimi (g)"
      },
      "recommendations": [
        "Recomandare 1 legată de alimentele identificate",
        "Recomandare 2"
      ]
    }
    
    Dacă nu sunt alimente în imagine, răspunde cu un JSON în care array-ul foods este gol și valorile nutriționale sunt zero.
    Nu adăuga text suplimentar, caracterele de escape, backticks sau markdown. Răspunsul tău trebuie să fie doar JSON-ul.`;

    // Realizăm cererea către OpenAI cu prompt-ul îmbunătățit
    const response = await openaiClient.post('/chat/completions', {
      model: 'gpt-4o', // Folosim modelul cel mai capabil pentru analiză vizuală
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Analizează această imagine și identifică alimentele prezente. Oferă o estimare a valorilor nutriționale și recomandări.' 
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high" // Folosim detail high pentru o analiză mai precisă
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1, // Temperatură scăzută pentru răspunsuri consistente
    });

    // Extragem conținutul răspunsului
    const content = response.data.choices[0].message.content;
    
    // Verificăm dacă avem un răspuns valid
    if (!content) {
      throw new Error('Nu am primit un răspuns valid de la OpenAI');
    }
    
    // Logging pentru debugging (truncat pentru a nu umple log-urile)
    console.log("Răspuns de la OpenAI pentru analiza alimentelor:", content.substring(0, 300) + "...");
    
    // Curățăm răspunsul pentru a îndepărta orice cod markdown sau text suplimentar
    const cleanedContent = cleanJsonResponse(content);
    
    try {
      // Parsăm JSON-ul curățat
      const parsedResult = JSON.parse(cleanedContent);
      
      // Verificăm că avem structura corectă
      if (!parsedResult.foods || !Array.isArray(parsedResult.foods)) {
        parsedResult.foods = [];
      }
      
      if (!parsedResult.totalNutrition) {
        parsedResult.totalNutrition = { calories: "0", protein: "0", carbs: "0", fat: "0" };
      }
      
      if (!parsedResult.recommendations || !Array.isArray(parsedResult.recommendations)) {
        parsedResult.recommendations = ["Nu au fost găsite recomandări specifice."];
      }
      
      // Adăugăm text formatat pentru afișare în UI
      parsedResult.formattedText = formatFoodAnalysisForDisplay(parsedResult);
      
      return parsedResult;
    } catch (parseError) {
      console.error("Eroare la parsarea JSON:", parseError);
      
      // Încercăm încă o dată să extragem JSON-ul folosind regex dacă prima încercare eșuează
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          const reparsedResult = JSON.parse(extractedJson);
          
          // Adăugăm text formatat pentru afișare în UI
          reparsedResult.formattedText = formatFoodAnalysisForDisplay(reparsedResult);
          
          return reparsedResult;
        }
      } catch (retryError) {
        console.error("A doua încercare de parsare a eșuat:", retryError);
      }
      
      // Dacă nu reușim să parsăm JSON-ul, returnăm un răspuns formatat manual
      return createManualResponse(content);
    }
  } catch (error) {
    console.error('Eroare la analizarea imaginii:', error);
    
    // Returnăm un răspuns formatat în caz de eroare
    return {
      success: false,
      formattedText: 'Nu am putut analiza imaginea. Te rog să încerci din nou cu o fotografie mai clară.',
      foods: [],
      totalNutrition: { calories: "0", protein: "0", carbs: "0", fat: "0" },
      recommendations: ["Încearcă să faci o fotografie mai clară și mai apropiată a alimentului."]
    };
  }
}

/**
 * Curăță răspunsul JSON primit de la OpenAI, eliminând marcajele markdown și alte caractere nedorite
 * @param {string} content - Răspunsul brut de la OpenAI
 * @returns {string} - Răspunsul curățat, conținând doar JSON valid
 */
function cleanJsonResponse(content) {
  // Îndepărtăm backticks și marcajele markdown json
  let cleaned = content.replace(/```json\n?|\n?```/g, '');
  
  // Îndepărtăm orice text înainte și după acoladele JSON-ului
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  
  if (jsonStart >= 0 && jsonEnd >= 0) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  
  // Înlocuim orice secvențe de escape care ar putea cauza probleme
  cleaned = cleaned.replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' ');
  
  // Îndepărtăm alte caractere care pot cauza probleme
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  return cleaned;
}

/**
 * Creează un răspuns formatat manual când nu putem parsa JSON-ul de la OpenAI
 * @param {string} content - Răspunsul text de la OpenAI
 * @returns {object} - Un obiect structurat cu informațiile extrase
 */
function createManualResponse(content) {
  // Extrage posibile alimente din text folosind expresii regulate
  const foodMatches = content.match(/(\w+(?:\s+\w+)*)\s+(?:conține|are|estimat|aproximativ)\s+(\d+)\s*(?:calorii|kcal)/gi) || [];
  
  let foods = [];
  if (foodMatches.length > 0) {
    for (const match of foodMatches) {
      const parts = match.split(/conține|are|estimat|aproximativ/i);
      if (parts.length >= 2) {
        foods.push({
          name: parts[0].trim(),
          portion: "1 porție",
          calories: parts[1].trim().replace(/[^0-9]/g, '') + " kcal",
          protein: "N/A",
          carbs: "N/A",
          fat: "N/A"
        });
      }
    }
  }
  
  // Căutăm mențiuni specifice de alimente cunoscute
  const foodTypes = [
    "măr", "mere", "banană", "banane", "portocală", "portocale", "lămâie", "lămâi",
    "pâine", "carne", "pui", "vită", "porc", "pește", "orez", "paste", "cartofi",
    "legume", "fructe", "salată", "supă", "desert", "prăjitură", "tort", "ciocolată",
    "iaurt", "brânză", "lapte", "ou", "ouă", "nucă", "nuci", "seminţe", "cereale",
    "fasole", "linte", "mazăre", "morcov", "morcovi", "roșie", "roșii", "castravete",
    "castraveți", "ardei", "ceapă", "usturoi", "nutella", "unt", "ulei"
  ];
  
  // Dacă nu am găsit alimente cu expresii regulate, încercăm cu lista de alimente cunoscute
  if (foods.length === 0) {
    let foundFoodNames = [];
    for (const food of foodTypes) {
      if (content.toLowerCase().includes(food.toLowerCase())) {
        foundFoodNames.push(food);
      }
    }
    
    if (foundFoodNames.length > 0) {
      foods.push({
        name: foundFoodNames.join(", "),
        portion: "1 porție",
        calories: "Estimare indisponibilă",
        protein: "N/A",
        carbs: "N/A",
        fat: "N/A"
      });
    }
  }
  
  // Verifică dacă conținutul menționează că nu există alimente
  const noFoodDetected = content.toLowerCase().includes("nu am identificat") || 
                         content.toLowerCase().includes("nu s-au detectat") || 
                         content.toLowerCase().includes("nu sunt alimente") ||
                         content.toLowerCase().includes("nu am găsit");
  
  // Creează răspunsul formatat
  const responseObj = {
    success: true,
    formattedText: formatTextResponse(content, foods, noFoodDetected),
    foods: foods.length > 0 ? foods : [],
    totalNutrition: {
      calories: "0",
      protein: "0",
      carbs: "0",
      fat: "0"
    },
    recommendations: [
      noFoodDetected 
        ? "Nu au fost identificate alimente în imagine." 
        : "Pentru estimări nutriționale mai precise, încearcă să faci o fotografie mai clară a alimentului.",
      "Asigură-te că ai o dietă echilibrată și variată."
    ]
  };
  
  // Adăugă răspunsul brut pentru debugging
  responseObj.raw = content;
  
  return responseObj;
}

/**
 * Formatează textul răspunsului pentru afișare
 * @param {string} content - Conținutul răspunsului
 * @param {Array} foods - Array cu alimentele detectate
 * @param {boolean} noFoodDetected - Flag care indică dacă nu au fost detectate alimente
 * @returns {string} - Textul formatat pentru afișare
 */
function formatTextResponse(content, foods, noFoodDetected) {
  if (noFoodDetected) {
    return "Nu am identificat alimente în această imagine. Te rog să încerci cu o altă fotografie.";
  }
  
  if (foods.length === 0) {
    return "Nu am putut analiza imaginea cu precizie. Te rog să încerci cu o fotografie mai clară.";
  }
  
  // Construim un răspuns formatat pentru alimentele găsite
  let formattedText = "Iată ce am identificat în imaginea ta:\n\n";
  formattedText += "🍽️ **Alimente identificate:**\n";
  
  foods.forEach(food => {
    formattedText += `- ${food.name} (${food.portion}) - ${food.calories}\n`;
  });
  
  formattedText += "\n💡 **Recomandare:**\n";
  formattedText += "- Pentru estimări nutriționale mai precise, încearcă să faci o fotografie mai clară și mai apropiată a alimentului.";
  
  return formattedText;
}

/**
 * Formatează analiza alimentelor pentru afișare în interfața utilizatorului
 * @param {Object} analysis - Rezultatul analizei
 * @returns {string} - Text formatat pentru afișare
 */
function formatFoodAnalysisForDisplay(analysis) {
  // Verificăm dacă rezultatul este valid
  if (!analysis || !analysis.foods) {
    return "Nu am putut analiza imaginea cu precizie. Te rog să încerci din nou cu o fotografie mai clară.";
  }
  
  // Verificăm dacă nu există alimente
  if (analysis.foods.length === 0) {
    return "Nu am identificat alimente în această imagine. Te rog să încerci cu o altă fotografie.";
  }
  
  // Construim un răspuns formatat frumos
  let formattedText = "Iată ce am identificat în imaginea ta:\n\n";
  
  // Adăugăm alimentele identificate și valorile lor nutriționale
  formattedText += "🍽️ **Alimente identificate:**\n";
  analysis.foods.forEach(food => {
    formattedText += `- ${food.name} (${food.portion || 'porție'}) - ${food.calories || '?'} kcal\n`;
  });
  
  formattedText += "\n";
  
  // Adăugăm totalurile
  if (analysis.totalNutrition) {
    formattedText += "📊 **Total estimat:**\n";
    formattedText += `- Calorii: ${analysis.totalNutrition.calories || '?'} kcal\n`;
    
    if (analysis.totalNutrition.protein && analysis.totalNutrition.protein !== '0') {
      formattedText += `- Proteine: ${analysis.totalNutrition.protein}g\n`;
    }
    
    if (analysis.totalNutrition.carbs && analysis.totalNutrition.carbs !== '0') {
      formattedText += `- Carbohidrați: ${analysis.totalNutrition.carbs}g\n`;
    }
    
    if (analysis.totalNutrition.fat && analysis.totalNutrition.fat !== '0') {
      formattedText += `- Grăsimi: ${analysis.totalNutrition.fat}g\n`;
    }
    
    formattedText += "\n";
  }
  
  // Adăugăm recomandări
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    formattedText += "💡 **Recomandări:**\n";
    
    analysis.recommendations.forEach(recommendation => {
      formattedText += `- ${recommendation}\n`;
    });
  } else {
    // Recomandări default dacă nu avem specifice
    formattedText += "💡 **Recomandare:**\n";
    formattedText += "- Dacă ai nevoie de sfaturi specifice legate de această masă, te rog să mă întrebi!";
  }
  
  return formattedText;
}

/**
 * Generează rețete bazate pe ingredientele din fotografie
 * @param {string} base64Image - Imaginea în format base64
 * @returns {Promise<object>} - Rețete sugerate
 */
async function suggestRecipes(base64Image) {
  try {
    const response = await openaiClient.post('/chat/completions', {
      model: 'gpt-4o-mini', // Actualizat la modelul compatibil cu vision
      messages: [
        {
          role: 'system',
          content: `Ești un bucătar expert specializat în crearea de rețete din ingredientele disponibile. 
          Analizează imaginea și sugerează 2-3 rețete sănătoase care pot fi preparate folosind aceste ingrediente. 
          Pentru fiecare rețetă, oferă numele, timpul de preparare, lista de ingrediente (cu cantități) și pașii de preparare. 
          Include și valorile nutriționale aproximative. Returnează informațiile în format JSON curat, fără backticks sau markdown.`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Ce pot găti cu aceste ingrediente? Sugerează câteva rețete sănătoase.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high" // Detaliu înalt pentru recunoaștere mai precisă
              }
            }
          ]
        }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const content = response.data.choices[0].message.content;
    const cleanedContent = cleanJsonResponse(content);
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.log('Nu s-a putut parsa JSON-ul, returnez răspunsul text:', content);
      // Dacă nu putem obține JSON, returnăm informațiile sub formă de text
      return {
        success: true,
        formattedText: content,
        recipes: [{
          name: "Rețete sugerate",
          description: content,
          preparationTime: "N/A",
          ingredients: [],
          steps: [],
          nutritionalInfo: "N/A"
        }]
      };
    }
  } catch (error) {
    console.error('Eroare la sugerarea rețetelor:', error);
    throw new Error('Nu am putut genera rețete. Te rog să încerci din nou.');
  }
}

module.exports = {
  getAIResponse,
  analyzeFood,
  suggestRecipes
};