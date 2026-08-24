require('dotenv').config();
const prisma = require('./src/db/prisma');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000';

// Tracking arrays for cleanup
let createdUserIds = [];
let createdProfileIds = [];
let createdTokenIds = [];
let createdAppointmentIds = [];
let createdLeaveIds = [];
let createdEmailLogIds = [];

async function cleanup() {
  console.log('\n--- Starting Cleanup ---');
  try {
    // 1. EmailLogs
    if (createdEmailLogIds.length > 0) {
      await prisma.emailLog.deleteMany({ where: { id: { in: createdEmailLogIds } } });
      // Also delete any emails linked to the appointments just in case
      await prisma.emailLog.deleteMany({ where: { appointmentId: { in: createdAppointmentIds } } });
      console.log(`Cleaned up email logs`);
    }

    // 2. OAuthTokens
    if (createdTokenIds.length > 0) {
      await prisma.oAuthToken.deleteMany({ where: { id: { in: createdTokenIds } } });
      console.log(`Cleaned up OAuth tokens`);
    }

    // 3. Appointments
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
      console.log(`Cleaned up appointments`);
    }

    // 4. DoctorLeaves
    if (createdLeaveIds.length > 0) {
      await prisma.doctorLeave.deleteMany({ where: { id: { in: createdLeaveIds } } });
      console.log(`Cleaned up doctor leaves`);
    }

    // 5. DoctorProfiles
    if (createdProfileIds.length > 0) {
      await prisma.doctorProfile.deleteMany({ where: { id: { in: createdProfileIds } } });
      console.log(`Cleaned up doctor profiles`);
    }

    // 6. Users
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log(`Cleaned up users`);
    }
    console.log('--- Cleanup Complete ---\n');
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

async function runPhase7Tests() {
  console.log('--- Phase 7: Leave Conflict Cascade Tests (SAFE) ---');

  const timestamp = Date.now();
  let adminToken, doctor1Token, doctor2Token, patientToken;
  let adminId, doctor1Id, doctor2Id, patientId;
  let doctor1ProfileId;

  try {
    // 1. Setup Isolated Users
    const admin = await prisma.user.create({
      data: { name: 'Admin', email: `admin_phase7_${timestamp}@test.com`, passwordHash: 'hashed', role: 'ADMIN' }
    });
    createdUserIds.push(admin.id);
    adminId = admin.id;

    const doctor1 = await prisma.user.create({
      data: {
        name: 'Doctor 1', email: `doctor1_phase7_${timestamp}@test.com`, passwordHash: 'hashed', role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialisation: 'Cardiology',
            workingHoursJson: {},
            slotDurationMinutes: 30
          }
        }
      },
      include: { doctorProfile: true }
    });
    createdUserIds.push(doctor1.id);
    doctor1Id = doctor1.id;
    doctor1ProfileId = doctor1.doctorProfile.id;
    createdProfileIds.push(doctor1ProfileId);

    const doctor2 = await prisma.user.create({
      data: {
        name: 'Doctor 2', email: `doctor2_phase7_${timestamp}@test.com`, passwordHash: 'hashed', role: 'DOCTOR',
        doctorProfile: {
          create: { specialisation: 'Neurology', workingHoursJson: {}, slotDurationMinutes: 30 }
        }
      },
      include: { doctorProfile: true }
    });
    createdUserIds.push(doctor2.id);
    doctor2Id = doctor2.id;
    createdProfileIds.push(doctor2.doctorProfile.id);

    const patient = await prisma.user.create({
      data: { name: 'Patient', email: `patient_phase7_${timestamp}@test.com`, passwordHash: 'hashed', role: 'PATIENT' }
    });
    createdUserIds.push(patient.id);
    patientId = patient.id;

    // Tokens
    adminToken = jwt.sign({ userId: adminId, role: 'ADMIN' }, process.env.JWT_SECRET || 'secret123');
    doctor1Token = jwt.sign({ userId: doctor1Id, role: 'DOCTOR' }, process.env.JWT_SECRET || 'secret123');
    doctor2Token = jwt.sign({ userId: doctor2Id, role: 'DOCTOR' }, process.env.JWT_SECRET || 'secret123');
    patientToken = jwt.sign({ userId: patientId, role: 'PATIENT' }, process.env.JWT_SECRET || 'secret123');

    // 2. Setup Mock OAuth Token for Patient
    const token = await prisma.oAuthToken.create({
      data: {
        userId: patientId,
        accessToken: 'test_token',
        refreshToken: 'test_refresh',
        expiresAt: new Date(Date.now() + 1000000)
      }
    });
    createdTokenIds.push(token.id);

    console.log('✅ Setup: Created isolated test users and mock OAuth token.');

    // 3. Define Dates
    const targetDate = new Date();
    targetDate.setUTCFullYear(targetDate.getUTCFullYear() + 2);
    targetDate.setUTCMonth(5); // June
    targetDate.setUTCDate(15);
    const dateString = targetDate.toISOString().split('T')[0];

    const differentDate = new Date(targetDate);
    differentDate.setUTCDate(differentDate.getUTCDate() + 1);

    const pastDate = new Date(targetDate);
    pastDate.setUTCDate(pastDate.getUTCDate() - 1);

    // Helper to create an appointment
    const makeAppt = async (docId, patId, slotStart, status) => {
      const a = await prisma.appointment.create({
        data: {
          doctorId: docId,
          patientId: patId,
          slotStart: slotStart,
          slotEnd: new Date(slotStart.getTime() + 30 * 60000),
          status: status
        }
      });
      createdAppointmentIds.push(a.id);
      return a;
    };

    // --- Create Test Appointments ---

    // A. Target date, Doctor 1, SCHEDULED (Should be cancelled)
    await makeAppt(doctor1Id, patientId, new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 9, 0)), 'SCHEDULED');
    await makeAppt(doctor1Id, patientId, new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 10, 0)), 'SCHEDULED');
    
    // B. Target date, Doctor 1, COMPLETED (Should NOT be cancelled)
    await makeAppt(doctor1Id, patientId, new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 11, 0)), 'COMPLETED');

    // C. Target date, Doctor 1, CANCELLED (Should NOT be re-cancelled)
    await makeAppt(doctor1Id, patientId, new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 12, 0)), 'CANCELLED');

    // D. Target date, Doctor 2, SCHEDULED (Should NOT be cancelled, different doctor)
    await makeAppt(doctor2Id, patientId, new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 9, 30)), 'SCHEDULED');

    // E. Different date, Doctor 1, SCHEDULED (Should NOT be cancelled, different date)
    await makeAppt(doctor1Id, patientId, new Date(Date.UTC(differentDate.getUTCFullYear(), differentDate.getUTCMonth(), differentDate.getUTCDate(), 14, 0)), 'SCHEDULED');

    // ==========================================
    // TESTS
    // ==========================================

    let testsPassed = 0;
    let testsFailed = 0;

    const assert = (condition, msg) => {
      if (condition) {
        console.log(`✅ ${msg}`);
        testsPassed++;
      } else {
        console.error(`❌ FAILED: ${msg}`);
        testsFailed++;
      }
    };

    // Test 1: Impact endpoint with affected appointments
    let res = await fetch(`${API_URL}/admin/doctors/${doctor1Id}/leave/impact?date=${dateString}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    let data = await res.json();
    assert(res.ok && data.count === 2, `Impact endpoint identified exactly 2 affected SCHEDULED appointments (Found: ${data.count})`);

    // Test 2: Impact endpoint with zero affected appointments (Doctor 2 on different date)
    const diffDateString = differentDate.toISOString().split('T')[0];
    res = await fetch(`${API_URL}/admin/doctors/${doctor2Id}/leave/impact?date=${diffDateString}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    data = await res.json();
    assert(res.ok && data.count === 0, `Impact endpoint returned 0 for no conflicts`);

    // Test 3: Admin authorization (Patient should fail)
    res = await fetch(`${API_URL}/admin/doctors/${doctor1Id}/leave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
      body: JSON.stringify({ leaveDate: dateString, reason: 'Test' })
    });
    assert(res.status === 403, `Non-admin blocked from creating leave (Got ${res.status})`);

    // Test 4: Leave creation & Cascade
    res = await fetch(`${API_URL}/admin/doctors/${doctor1Id}/leave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ leaveDate: dateString, reason: 'Conference' })
    });
    data = await res.json();
    assert(res.ok, `Admin successfully created leave`);
    if (res.ok && data.leave && data.leave.id) {
      createdLeaveIds.push(data.leave.id);
    }

    // Verify Appointments
    const finalAppts = await prisma.appointment.findMany({
      where: { id: { in: createdAppointmentIds } },
      orderBy: { slotStart: 'asc' }
    });

    const doc1TargetScheduled = finalAppts.filter(a => a.doctorId === doctor1Id && a.status === 'CANCELLED' && a.slotStart.getUTCDate() === targetDate.getUTCDate() && a.slotStart.getUTCHours() < 11);
    const doc1TargetCompleted = finalAppts.find(a => a.doctorId === doctor1Id && a.slotStart.getUTCHours() === 11);
    const doc1TargetCancelledOrig = finalAppts.find(a => a.doctorId === doctor1Id && a.slotStart.getUTCHours() === 12);
    const doc2Target = finalAppts.find(a => a.doctorId === doctor2Id);
    const doc1Diff = finalAppts.find(a => a.slotStart.getUTCDate() === differentDate.getUTCDate());

    // Test 5: Affected SCHEDULED become CANCELLED
    assert(doc1TargetScheduled.length === 2, `Exactly 2 affected SCHEDULED appointments transitioned to CANCELLED`);

    // Test 6 & 7 & 8: Unaffected remain unchanged
    assert(doc1TargetCompleted.status === 'COMPLETED', `Completed appointments remain unchanged`);
    assert(doc1TargetCancelledOrig.status === 'CANCELLED', `Previously cancelled appointments remain unchanged`);
    
    // Test 9 & 10: Wrong doctor/date remain unchanged
    assert(doc2Target.status === 'SCHEDULED', `Appointments belonging to another doctor remain unchanged`);
    assert(doc1Diff.status === 'SCHEDULED', `Appointments on another date remain unchanged`);

    // Test 11: Cancellation notifications enqueued
    await new Promise(r => setTimeout(r, 2000)); // wait for workers
    const emails = await prisma.emailLog.findMany({
      where: { appointmentId: { in: doc1TargetScheduled.map(a => a.id) }, type: 'CANCELLATION' }
    });
    // 2 appointments cancelled, each should email Patient and Doctor = 4 emails
    assert(emails.length === 4, `4 cancellation emails were correctly enqueued (Found: ${emails.length})`);
    
    // Test 12: Duplicate leave behavior
    res = await fetch(`${API_URL}/admin/doctors/${doctor1Id}/leave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ leaveDate: dateString, reason: 'Duplicate' })
    });
    assert(res.status === 409, `Duplicate leave creation is rejected with 409`);

    console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
    
  } catch (error) {
    console.error('\n❌ Unhandled Exception in Tests:', error);
  } finally {
    await cleanup();
  }
}

runPhase7Tests();
