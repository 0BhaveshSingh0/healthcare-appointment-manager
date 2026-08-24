require('dotenv').config();
const prisma = require('./src/db/prisma');
const jwt = require('jsonwebtoken');

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
}
const crypto = require('crypto');

const API_URL = 'http://localhost:3000';
const today = new Date();
const dateStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStrTom = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

async function createTestUsers() {
  // Store created IDs for teardown
  global.createdUserIds = [];
  global.createdLeaveIds = [];
  global.createdAppointmentIds = [];

  const patient = await prisma.user.create({
    data: {
      name: 'Test Patient',
      email: `patient_${Date.now()}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'PATIENT',
      oauthToken: {
        create: {
          accessToken: 'test',
          refreshToken: 'test',
          expiresAt: new Date(Date.now() + 10000000000)
        }
      }
    }
  });

  const patient2 = await prisma.user.create({
    data: {
      name: 'Test Patient 2',
      email: `patient2_${Date.now()}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'PATIENT',
      oauthToken: {
        create: {
          accessToken: 'test2',
          refreshToken: 'test2',
          expiresAt: new Date(Date.now() + 10000000000)
        }
      }
    }
  });

  const workingHoursJson = {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: true, start: "09:00", end: "17:00" },
    sunday: { enabled: true, start: "09:00", end: "17:00" }
  };

  const doctorA = await prisma.user.create({
    data: {
      name: 'Doctor Cardio A',
      email: `docA_${Date.now()}@test.com`,
      passwordHash: 'hashed',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: 'Cardiology',
          workingHoursJson,
          slotDurationMinutes: 30
        }
      }
    }, include: { doctorProfile: true }
  });

  const doctorB = await prisma.user.create({
    data: {
      name: 'Doctor Cardio B',
      email: `docB_${Date.now()}@test.com`,
      passwordHash: 'hashed',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: 'Cardiology',
          workingHoursJson,
          slotDurationMinutes: 30
        }
      }
    }, include: { doctorProfile: true }
  });

  const doctorC = await prisma.user.create({
    data: {
      name: 'Doctor Derm C',
      email: `docC_${Date.now()}@test.com`,
      passwordHash: 'hashed',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: 'Dermatology',
          workingHoursJson,
          slotDurationMinutes: 30
        }
      }
    }, include: { doctorProfile: true }
  });

  global.createdUserIds.push(patient.id, patient2.id, doctorA.id, doctorB.id, doctorC.id);

  return { patient, patient2, doctorA, doctorB, doctorC };
}

async function request(method, path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING BOOKING TESTS A-O ---');
  const { patient, patient2, doctorA, doctorB, doctorC } = await createTestUsers();
  
  const p1Token = generateToken(patient.id, 'PATIENT');
  const p2Token = generateToken(patient2.id, 'PATIENT');
  const docAToken = generateToken(doctorA.id, 'DOCTOR');

  let passed = 0;
  let failed = 0;

  function assertRule(name, actual, expectedStatus, errData = null) {
    if (actual === expectedStatus) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name} (Expected ${expectedStatus}, got ${actual})`);
      if (errData) console.log(`   Error data: ${JSON.stringify(errData)}`);
      failed++;
    }
  }

  // Initial valid booking
  let appA;
  try {
    const res = await request('POST', '/appointments', { doctorId: doctorA.id, date: dateStrTom, slotTime: "10:00" }, p1Token);
    appA = res.data.appointment;
    if (appA?.id) global.createdAppointmentIds.push(appA.id);
    assertRule('Setup: Initial Cardiology Booking', res.status, 201);
  } catch (err) {
    assertRule('Setup: Initial Cardiology Booking', err.status, 201, err.data);
  }

  // A. Same specialisation, same date
  try {
    await request('POST', '/appointments', { doctorId: doctorB.id, date: dateStrTom, slotTime: "11:00" }, p1Token);
    assertRule('A. Same specialisation, same date', 201, 409);
  } catch (err) {
    assertRule('A. Same specialisation, same date', err.status, 409, err.data);
  }

  // B. Different specialisation, same date
  try {
    const res = await request('POST', '/appointments', { doctorId: doctorC.id, date: dateStrTom, slotTime: "12:00" }, p1Token);
    if (res.data?.appointment?.id) global.createdAppointmentIds.push(res.data.appointment.id);
    assertRule('B. Different specialisation, same date', res.status, 201);
  } catch (err) {
    assertRule('B. Different specialisation, same date', err.status, 201, err.data);
  }

  // C. Overlapping patient appointments (different doctor, same time)
  // Setup p2 with an appointment
  try {
    const res1 = await request('POST', '/appointments', { doctorId: doctorA.id, date: dateStrTom, slotTime: "10:00" }, p2Token);
    if (res1.data?.appointment?.id) global.createdAppointmentIds.push(res1.data.appointment.id);
    
    // Try to book overlapping slot (Doctor C at 10:00)
    await request('POST', '/appointments', { doctorId: doctorC.id, date: dateStrTom, slotTime: "10:00" }, p2Token);
    assertRule('C. Overlapping patient appointments', 201, 409);
  } catch (err) {
    assertRule('C. Overlapping patient appointments', err.status, 409, err.data);
  }

  // D. Back-to-back patient appointments
  try {
    // p2 already has Doctor A at 10:00-10:30. Now book Doctor C at 10:30-11:00.
    const res = await request('POST', '/appointments', { doctorId: doctorC.id, date: dateStrTom, slotTime: "10:30" }, p2Token);
    if (res.data?.appointment?.id) global.createdAppointmentIds.push(res.data.appointment.id);
    assertRule('D. Back-to-back patient appointments', res.status, 201);
  } catch (err) {
    assertRule('D. Back-to-back patient appointments', err.status, 201, err.data);
  }

  // E. Same doctor, same slot (Double Booking)
  try {
    await request('POST', '/appointments', { doctorId: doctorA.id, date: dateStrTom, slotTime: "10:00" }, p2Token);
    assertRule('E. Same doctor, same slot', 201, 409);
  } catch (err) {
    assertRule('E. Same doctor, same slot', err.status, 409, err.data);
  }

  // F. Doctor Leave
  const leave = await prisma.doctorLeave.create({ data: { doctorProfileId: doctorA.doctorProfile.id, leaveDate: new Date(`${dateStrTom}T00:00:00Z`) }});
  global.createdLeaveIds.push(leave.id);
  try {
    await request('POST', '/appointments', { doctorId: doctorA.id, date: dateStrTom, slotTime: "14:00" }, p2Token);
    assertRule('F. Doctor leave', 201, 400);
  } catch (err) {
    assertRule('F. Doctor leave', err.status, 400, err.data);
  }

  // G. Past slot today
  try {
    await request('POST', '/appointments', { doctorId: doctorA.id, date: dateStr, slotTime: "01:00" }, p2Token);
    assertRule('G. Past slot today', 201, 400);
  } catch (err) {
    assertRule('G. Past slot today', err.status, 400, err.data);
  }

  // Prepare app for reschedule testing
  let docAAppId;
  try {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateNW = nextWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const res = await request('POST', '/appointments', { doctorId: doctorA.id, date: dateNW, slotTime: "09:00" }, p1Token);
    docAAppId = res.data.appointment.id;
    if (docAAppId) global.createdAppointmentIds.push(docAAppId);
  } catch(e) {}

  // H. Doctor reschedules own scheduled appointment
  try {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateNW = nextWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const res = await request('PUT', `/appointments/${docAAppId}/reschedule`, { date: dateNW, slotTime: "09:30" }, docAToken);
    assertRule('H. Doctor reschedules own appointment', res.status, 200);
  } catch (err) {
    assertRule('H. Doctor reschedules own appointment', err.status, 200, err.data);
  }

  // I. Reschedule another doctor's appointment
  try {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateNW = nextWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const res = await request('POST', '/appointments', { doctorId: doctorC.id, date: dateNW, slotTime: "10:00" }, p2Token);
    const docCAppId = res.data.appointment.id;
    if (docCAppId) global.createdAppointmentIds.push(docCAppId);
    await request('PUT', `/appointments/${docCAppId}/reschedule`, { date: dateNW, slotTime: "10:30" }, docAToken);
    assertRule('I. Reschedule another doctor appointment', 200, 403);
  } catch (err) {
    assertRule('I. Reschedule another doctor appointment', err.status, 403, err.data);
  }

  // N. Two simultaneous bookings that would overlap for the SAME patient
  try {
    const dateFar = new Date(today);
    dateFar.setDate(dateFar.getDate() + 14);
    const dateFarStr = dateFar.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    // Doctor A and C both have 10:00 slots. P1 tries to book both simultaneously.
    const p1Req = fetch(`${API_URL}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1Token}`}, body: JSON.stringify({ doctorId: doctorA.id, date: dateFarStr, slotTime: "10:00" })});
    const p2Req = fetch(`${API_URL}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1Token}`}, body: JSON.stringify({ doctorId: doctorC.id, date: dateFarStr, slotTime: "10:00" })});
    
    const responses = await Promise.all([p1Req, p2Req]);
    const successCount = responses.filter(r => r.status === 201).length;
    const failCount = responses.filter(r => r.status === 409).length;
    
    if (successCount === 1 && failCount === 1) {
      assertRule('N. Concurrent same-patient bookings prevented', 1, 1);
    } else {
      assertRule('N. Concurrent same-patient bookings prevented', 0, 1);
    }
  } catch (err) {
    assertRule('N. Concurrent same-patient bookings prevented', 0, 1);
  }

  // O. Two simultaneous bookings for the SAME doctor + SAME slot
  try {
    const dateFar2 = new Date(today);
    dateFar2.setDate(dateFar2.getDate() + 15);
    const dateFarStr2 = dateFar2.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    const p1Req = fetch(`${API_URL}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1Token}`}, body: JSON.stringify({ doctorId: doctorA.id, date: dateFarStr2, slotTime: "11:00" })});
    const p2Req = fetch(`${API_URL}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p2Token}`}, body: JSON.stringify({ doctorId: doctorA.id, date: dateFarStr2, slotTime: "11:00" })});
    
    const responses = await Promise.all([p1Req, p2Req]);
    for (const r of responses) {
      if (r.status === 201) {
        const data = await r.clone().json().catch(() => null);
        if (data?.appointment?.id) global.createdAppointmentIds.push(data.appointment.id);
      }
    }
    const successCount = responses.filter(r => r.status === 201).length;
    const failCount = responses.filter(r => r.status === 409).length;
    
    if (successCount === 1 && failCount === 1) {
      assertRule('O. Concurrent same-doctor bookings prevented', 1, 1);
    } else {
      assertRule('O. Concurrent same-doctor bookings prevented', 0, 1);
    }
  } catch (err) {
    assertRule('O. Concurrent same-doctor bookings prevented', 0, 1);
  }

  // Teardown block: Clean up ONLY created IDs
  try {
    if (global.createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({ where: { id: { in: global.createdAppointmentIds } } });
    }
    if (global.createdLeaveIds.length > 0) {
      await prisma.doctorLeave.deleteMany({ where: { id: { in: global.createdLeaveIds } } });
    }
    if (global.createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: global.createdUserIds } } });
    }
  } catch (err) {
    console.error('Failed to cleanup test data', err);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
