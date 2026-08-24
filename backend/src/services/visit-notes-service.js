const prisma = require('../db/prisma');
const { generatePostVisitSummary } = require('./llm-service');
const { generateReminders } = require('./reminder-service');

/**
 * Creates a VisitNote for a given appointment and invokes the LLM.
 * @param {string} doctorId - ID of the doctor submitting notes
 * @param {string} appointmentId - ID of the appointment
 * @param {string} clinicalNotes - Free text clinical notes
 * @param {object} prescriptionJson - Structured prescription data
 * @returns {Promise<object>} The pending VisitNote record
 */
async function processVisitNotes(doctorId, appointmentId, clinicalNotes, prescriptionJson) {
  // 1. Verify the appointment exists and belongs to the doctor
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.doctorId !== doctorId) {
    throw new Error('Unauthorized: You can only submit notes for your own appointments');
  }

  // 2. Post-Visit Time Validation: Check if appointment.slotEnd <= current time
  const now = new Date();
  if (appointment.slotEnd > now) {
    throw new Error('You cannot submit post-visit notes before the appointment has concluded');
  }

  // 3. Create the record in PENDING state
  let visitNote;
  try {
    visitNote = await prisma.visitNote.create({
      data: {
        appointmentId,
        clinicalNotes,
        prescriptionJson: prescriptionJson || {},
        llmStatus: 'PENDING',
      },
    });
  } catch (err) {
    // Handle Prisma unique constraint violation (P2002)
    if (err.code === 'P2002') {
      throw new Error('Visit notes already submitted for this appointment');
    }
    throw err;
  }

  // Generate medication reminders safely (does not block Phase 5 logic on failure)
  try {
    await generateReminders(visitNote.id, appointment.patientId, prescriptionJson);
  } catch (err) {
    console.error('Failed to generate medication reminders:', err.message);
  }

  // 4. Call the LLM (non-blocking to the appointment itself)
  try {
    const summaryText = await generatePostVisitSummary(clinicalNotes, prescriptionJson);

    // Update with success
    visitNote = await prisma.visitNote.update({
      where: { id: visitNote.id },
      data: {
        aiPatientSummary: summaryText,
        llmStatus: 'SUCCESS',
      },
    });
  } catch (err) {
    console.error('LLM Failure during post-visit summary:', err.message);
    
    // Fallback on failure
    visitNote = await prisma.visitNote.update({
      where: { id: visitNote.id },
      data: {
        llmStatus: 'FAILED',
      },
    });
  }

  return visitNote;
}

module.exports = {
  processVisitNotes,
};
