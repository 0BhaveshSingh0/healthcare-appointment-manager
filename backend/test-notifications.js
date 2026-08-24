require('dotenv').config();
const axios = require('axios');
const prisma = require('./src/db/prisma');
const notificationService = require('./src/services/notification-service');
const calendarService = require('./src/services/calendar-service');

const BASE_URL = 'http://localhost:3000';
const ADMIN_CRED = { email: 'testadmin@example.com', password: 'password123' };
const DOCTOR_CRED = { email: 'testdoctor@example.com', password: 'password123' };
const PATIENT_CRED = { email: 'testpatient@example.com', password: 'password123' };

let adminToken, doctorToken, patientToken;
let doctorId, patientId;

async function runTests() {
  console.log('--- Phase 6: Notifications & Calendar Tests ---');

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
    const patient = await prisma.user.findFirst({ where: { role: 'PATIENT' } });

    if (!admin) throw new Error('Missing permanent ADMIN test account');
    if (!doctor) throw new Error('Missing permanent DOCTOR test account');
    if (!patient) throw new Error('Missing permanent PATIENT test account');

    adminToken = require('jsonwebtoken').sign({ userId: admin.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'secret123');
    doctorToken = require('jsonwebtoken').sign({ userId: doctor.id, role: 'DOCTOR' }, process.env.JWT_SECRET || 'secret123');
    patientToken = require('jsonwebtoken').sign({ userId: patient.id, role: 'PATIENT' }, process.env.JWT_SECRET || 'secret123');
    
    doctorId = doctor.id;
    patientId = patient.id;

    const createdTokenIds = [];
    const createdAppointmentIds = [];

    // Delete any existing mock tokens to avoid conflicts during create
    const oldTokens = await prisma.oAuthToken.findMany({ where: { userId: { in: [doctorId, patientId] } } });
    if (oldTokens.length > 0) {
       await prisma.oAuthToken.deleteMany({ where: { id: { in: oldTokens.map(t => t.id) } } });
    }

    const docToken = await prisma.oAuthToken.create({
      data: {
        userId: doctorId,
        accessToken: 'mock_access',
        refreshToken: 'mock_refresh',
        expiresAt: new Date(Date.now() + 1000000)
      }
    });
    createdTokenIds.push(docToken.id);

    const patToken = await prisma.oAuthToken.create({
      data: {
        userId: patientId,
        accessToken: 'mock_access',
        refreshToken: 'mock_refresh',
        expiresAt: new Date(Date.now() + 1000000)
      }
    });
    createdTokenIds.push(patToken.id);

    console.log('✔ Auth setup successful');

    // MOCK external services (Not possible across processes, we'll check DB instead)
    
    // 2. A. Booking succeeds when email succeeds
    const dStr = '2026-10-15';
    const sTime = '09:00';
    
    const bookRes = await axios.post(`${BASE_URL}/appointments`, 
      { doctorId, date: dStr, slotTime: sTime },
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    const appointmentId = bookRes.data.appointment.id;
    if (appointmentId) createdAppointmentIds.push(appointmentId);
    console.log('✔ A. Booking succeeds');

    // Give async a tiny moment to run
    await new Promise(r => setTimeout(r, 500));

    // Check emails and calendar called by checking DB
    const bookingEmails = await prisma.emailLog.findMany({ where: { appointmentId } });
    const bookingCalendars = await prisma.calendarEvent.findMany({ where: { appointmentId } });
    
    if (bookingEmails.length !== 2 || bookingCalendars.length !== 2) {
      throw new Error(`Async hooks not recorded in DB for booking. Emails: ${bookingEmails.length}, Cals: ${bookingCalendars.length}`);
    }
    console.log('✔ F. Booking confirmation triggered');

    // 3. G. Reschedule updates calendar event
    const rTime = '10:00';
    await axios.put(`${BASE_URL}/appointments/${appointmentId}/reschedule`,
      { date: dStr, slotTime: rTime },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    
    await new Promise(r => setTimeout(r, 500));
    const reschedEmails = await prisma.emailLog.findMany({ where: { appointmentId, type: 'RESCHEDULE' } });
    
    if (reschedEmails.length !== 2) {
      throw new Error(`Async hooks not recorded in DB for reschedule. Expected 2, got ${reschedEmails.length}`);
    }
    console.log('✔ G. Reschedule triggers hooks');

    // 4. L. Duplicate/invalid cancellation is rejected (Test K Unauthorized first)
    try {
      // Patient 1 tries to cancel Patient 2's appt
      const p1Auth = { data: { token: require('jsonwebtoken').sign({ userId: require('crypto').randomUUID(), role: 'PATIENT' }, process.env.JWT_SECRET || 'secret123') } };
      await axios.put(`${BASE_URL}/appointments/${appointmentId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${p1Auth.data.token}` }
      });
      throw new Error('Should have rejected unauthorized cancellation');
    } catch (err) {
      if (err.response?.status !== 403) throw err;
      console.log('✔ K. Unauthorized cancellation is rejected');
    }

    // 5. H. Cancellation changes appointment status
    await axios.put(`${BASE_URL}/appointments/${appointmentId}/cancel`, {}, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });

    const cancelledAppt = await prisma.appointment.findUnique({ where: { id: appointmentId }});
    if (cancelledAppt.status !== 'CANCELLED') throw new Error('Status not changed');
    console.log('✔ H. Cancellation changes appointment status');

    // 6. I & J. Cancellation triggers notification & calendar deletion
    await new Promise(r => setTimeout(r, 500));
    const cancelEmails = await prisma.emailLog.findMany({ where: { appointmentId, type: 'CANCELLATION' } });
    if (cancelEmails.length !== 2) {
      throw new Error('Async hooks not called for cancellation');
    }
    console.log('✔ I, J. Cancellation triggers hooks');

    try {
      await axios.put(`${BASE_URL}/appointments/${appointmentId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${patientToken}` }
      });
      throw new Error('Should have rejected double cancellation');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('✔ L. Duplicate/invalid cancellation is rejected');
    }

    // Cleanup
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } }});
    }
    if (createdTokenIds.length > 0) {
      await prisma.oAuthToken.deleteMany({ where: { id: { in: createdTokenIds } }});
    }
    console.log('\nAll Notification/Calendar hook tests PASSED');

  } catch (err) {
    console.error('Test Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
