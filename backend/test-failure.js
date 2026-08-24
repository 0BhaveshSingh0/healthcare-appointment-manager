require('dotenv').config();
process.env.GEMINI_API_KEY = 'invalid_key_for_test';

const sinon = require('sinon');
const symptomService = require('./src/services/symptom-service');
const llmService = require('./src/services/llm-service');
const prisma = require('./src/db/prisma');

async function testFailureHandling() {
  let llmStub;
  try {
    console.log('--- Step 8: VERIFY FAILURE HANDLING ---');
    
    // Create a mock appointment for this test
    const user = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
    const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
    
    const appointment = await prisma.appointment.create({
      data: {
        patientId: user.id,
        doctorId: doctor.id,
        slotStart: new Date(),
        slotEnd: new Date(Date.now() + 30 * 60000),
        status: 'SCHEDULED'
      }
    });

    console.log('Created test appointment:', appointment.id);

    // Call symptomService to process symptoms with huge payload
    const payload = "headache";
    process.env.GEMINI_API_KEY = 'invalid_key_for_test';
    const resultForm = await symptomService.processSymptomForm(
      appointment.id,
      payload
    );

    console.log('Returned SymptomForm Status:', resultForm.llmStatus);

    // Verify in DB
    const dbForm = await prisma.symptomForm.findUnique({ where: { id: resultForm.id } });
    console.log('DB SymptomForm Status:', dbForm.llmStatus);
    console.log('DB Raw Symptoms stored:', dbForm.rawSymptomsText === "I have a simulated failure test symptom.");
    console.log('DB AI fields are null:', dbForm.aiUrgency === null && dbForm.aiChiefComplaint === null);

    const dbAppt = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    console.log('Appointment remains:', dbAppt.status);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    if (llmStub) llmStub.restore();
    await prisma.$disconnect();
  }
}

testFailureHandling();
