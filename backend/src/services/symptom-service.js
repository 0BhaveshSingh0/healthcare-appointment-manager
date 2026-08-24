const prisma = require('../db/prisma');
const { generatePreVisitSummary } = require('./llm-service');

/**
 * Handles the creation and processing of a symptom form.
 *
 * @param {string} appointmentId
 * @param {string} rawSymptomsText
 * @returns {Promise<object>} The symptom form record
 */
async function processSymptomForm(appointmentId, rawSymptomsText) {
  // First, verify the appointment exists
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Create the record in PENDING state
  let symptomForm = await prisma.symptomForm.create({
    data: {
      appointmentId,
      rawSymptomsText,
      llmStatus: 'PENDING',
    },
  });

  try {
    // Call the LLM (this is non-blocking to the appointment itself, 
    // but we await it here so the response has the data if fast enough)
    const summary = await generatePreVisitSummary(rawSymptomsText);

    // Update with success
    symptomForm = await prisma.symptomForm.update({
      where: { id: symptomForm.id },
      data: {
        aiUrgency: summary.urgency,
        aiChiefComplaint: summary.chief_complaint,
        aiQuestionsJson: summary.questions, // JSON object
        llmStatus: 'SUCCESS',
      },
    });
  } catch (error) {
    console.error('LLM generation failed for symptom form:', symptomForm.id, error.message);
    
    // Update with failure, but keep the raw text
    symptomForm = await prisma.symptomForm.update({
      where: { id: symptomForm.id },
      data: {
        llmStatus: 'FAILED',
      },
    });
  }

  return symptomForm;
}

module.exports = {
  processSymptomForm,
};
