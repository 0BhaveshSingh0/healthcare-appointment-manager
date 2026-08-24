const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PROMPT_TEMPLATE = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}`;
const POST_VISIT_PROMPT_TEMPLATE = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    urgency: {
      type: Type.STRING,
      enum: ['Low', 'Medium', 'High'],
      description: 'The urgency level of the symptoms.',
    },
    chief_complaint: {
      type: Type.STRING,
      description: 'A brief summary of the main symptom or issue.',
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: 'Exactly three suggested questions for the doctor to ask.',
    },
  },
  required: ['urgency', 'chief_complaint', 'questions'],
};

/**
 * Generates a pre-visit summary using Google Gemini.
 * @param {string} symptomsText - The raw symptoms provided by the patient.
 * @returns {Promise<{urgency: string, chief_complaint: string, questions: string[]}>}
 */
async function generatePreVisitSummary(symptomsText) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }


  const prompt = PROMPT_TEMPLATE.replace('{symptoms}', symptomsText);

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.2, // Keep it focused
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from LLM');
  }

  const data = JSON.parse(text);

  // Enforce exactly 3 questions
  if (!Array.isArray(data.questions) || data.questions.length !== 3) {
    throw new Error('LLM did not return exactly 3 questions');
  }

  return data;
}

/**
 * Generates a post-visit patient-friendly summary using Google Gemini.
 * @param {string} notesText - The raw clinical notes.
 * @param {object} prescriptionData - The structured prescription data.
 * @returns {Promise<string>} The generated summary in plain text.
 */
async function generatePostVisitSummary(notesText, prescriptionData) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  // Inject prescription data if provided
  let fullNotes = notesText;
  if (prescriptionData && Object.keys(prescriptionData).length > 0) {
    fullNotes += `\n\nPrescription Data:\n${JSON.stringify(prescriptionData, null, 2)}`;
  }

  const prompt = POST_VISIT_PROMPT_TEMPLATE.replace('<notes>', fullNotes);

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      // Intentionally NOT using JSON schema here as requested
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from LLM');
  }

  return text;
}

module.exports = {
  generatePreVisitSummary,
  generatePostVisitSummary,
};
