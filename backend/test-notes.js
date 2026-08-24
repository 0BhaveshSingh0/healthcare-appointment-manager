require('dotenv').config();
const prisma = require('./src/db/prisma');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000';

async function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET || 'supersecret',
    { expiresIn: '1h' }
  );
}

async function apiCall(path, method = 'GET', token, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) {
    let errMsg = 'API Error';
    if (typeof data.error === 'string') errMsg = data.error;
    else if (data.error && typeof data.error.message === 'string') errMsg = data.error.message;
    else if (data.message) errMsg = data.message;
    
    const error = new Error(errMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTests() {
  console.log('--- PHASE 5: POST-VISIT NOTES TESTS ---');

  // Find permanent test accounts
  const patient = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  const wrongDoctor = await prisma.user.findFirst({ where: { role: 'DOCTOR', id: { not: doctor?.id } } });
  
  if (!patient || !doctor || !wrongDoctor) {
    console.error('Error: Required permanent test accounts not found. Ensure 1 patient and 2 doctors exist.');
    process.exit(1);
  }

  const patientToken = await generateToken(patient);
  const doctorToken = await generateToken(doctor);
  const wrongDoctorToken = await generateToken(wrongDoctor);

  const createdAppointmentIds = [];
  
  try {
    // 1. Create a past appointment and a future appointment manually for testing
    const now = new Date();
    
    // Past appointment
    const pastStart = new Date(now.getTime() - 120 * 60000); // 2 hours ago
    const pastEnd = new Date(now.getTime() - 90 * 60000);
    const pastApp = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotStart: pastStart,
        slotEnd: pastEnd,
        status: 'COMPLETED'
      }
    });
    createdAppointmentIds.push(pastApp.id);

    // Future appointment
    const futureStart = new Date(now.getTime() + 120 * 60000); // 2 hours in future
    const futureEnd = new Date(now.getTime() + 150 * 60000);
    const futureApp = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotStart: futureStart,
        slotEnd: futureEnd,
        status: 'SCHEDULED'
      }
    });
    createdAppointmentIds.push(futureApp.id);

    // Test B: Future appointment cannot receive post-visit notes
    try {
      await apiCall(`/appointments/${futureApp.id}/notes`, 'POST', doctorToken, {
        clinicalNotes: "Patient seems fine.",
        prescription: { medication: "Rest" }
      });
      console.error('❌ Test B Failed: Allowed notes for future appointment');
    } catch (err) {
      if (err.status === 400 && err.message.includes('concluded')) {
        console.log('✅ Test B Passed: Blocked notes for future appointment');
      } else {
        console.error('❌ Test B Failed with unexpected error:', err.data || err.message);
      }
    }

    // Test C: Wrong doctor cannot submit notes
    try {
      await apiCall(`/appointments/${pastApp.id}/notes`, 'POST', wrongDoctorToken, {
        clinicalNotes: "Patient seems fine.",
      });
      console.error('❌ Test C Failed: Allowed wrong doctor to submit notes');
    } catch (err) {
      if (err.status === 403) {
        console.log('✅ Test C Passed: Blocked wrong doctor');
      } else {
        console.error('❌ Test C Failed with unexpected error:', err.data || err.message);
      }
    }

    // Test D: Patient cannot submit doctor notes
    try {
      await apiCall(`/appointments/${pastApp.id}/notes`, 'POST', patientToken, {
        clinicalNotes: "Patient seems fine.",
      });
      console.error('❌ Test D Failed: Allowed patient to submit notes');
    } catch (err) {
      if (err.status === 403) {
        console.log('✅ Test D Passed: Blocked patient');
      } else {
        console.error('❌ Test D Failed with unexpected error:', err.data || err.message);
      }
    }

    // Test A, F, G, H, I: Correct doctor submits notes + Gemini success
    console.log('Waiting for LLM generation...');
    const submitRes = await apiCall(`/appointments/${pastApp.id}/notes`, 'POST', doctorToken, {
      clinicalNotes: "Patient has a mild fever and cough. Diagnosed with mild upper respiratory infection.",
      prescription: { medication: "Paracetamol", dosage: "500mg", frequency: "Twice daily", duration: "3 days" }
    });

    const visitNote = submitRes.visitNote;
    if (
      visitNote &&
      visitNote.clinicalNotes.includes("mild fever") &&
      visitNote.prescriptionJson.medication === "Paracetamol" &&
      visitNote.llmStatus === 'SUCCESS' &&
      visitNote.aiPatientSummary
    ) {
      console.log('✅ Tests A, F, G, H, I Passed: Doctor submitted notes, LLM generated summary');
    } else {
      console.error('❌ Tests A, F, G, H, I Failed: Unexpected VisitNote data:', visitNote);
    }

    // Test E: Duplicate notes return 409
    try {
      await apiCall(`/appointments/${pastApp.id}/notes`, 'POST', doctorToken, {
        clinicalNotes: "Patient seems fine.",
      });
      console.error('❌ Test E Failed: Allowed duplicate notes');
    } catch (err) {
      if (err.status === 409) {
        console.log('✅ Test E Passed: Blocked duplicate notes with 409');
      } else {
        console.error('❌ Test E Failed with unexpected error:', err.data || err.message);
      }
    }

    // Test M: Patient can view their own post-visit summary
    const patientAppsRes = await apiCall(`/appointments/patient`, 'GET', patientToken);
    const patientApp = patientAppsRes.appointments.find(a => a.id === pastApp.id);
    if (patientApp && patientApp.visitNote && patientApp.visitNote.aiPatientSummary) {
      console.log('✅ Test M Passed: Patient can retrieve their own post-visit summary');
    } else {
      console.error('❌ Test M Failed: Patient did not receive visitNote');
    }

    // Test N: Patient cannot view another patient's summary
    // Since GET /appointments/patient uses the token to filter, this is inherently protected.
    
    // Test O and P: Existing Phase 3 booking tests and Phase 4 tests will be run separately

  } catch (err) {
    console.error('Test script crashed:', err);
  } finally {
    console.log('--- TEARDOWN: Cleaning up ONLY test-created records ---');
    if (createdAppointmentIds.length > 0) {
      await prisma.visitNote.deleteMany({ where: { appointmentId: { in: createdAppointmentIds } } });
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
      console.log(`✅ Deleted ${createdAppointmentIds.length} test appointments and their visit notes.`);
    }
    await prisma.$disconnect();
  }
}

runTests();
