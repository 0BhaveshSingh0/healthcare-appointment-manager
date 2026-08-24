require('dotenv').config();
const prisma = require('./src/db/prisma');
const { generateReminders } = require('./src/services/reminder-service');
const { processReminders } = require('./src/jobs/reminder-scheduler');

// Tracking arrays for cleanup
let createdUserIds = [];
let createdProfileIds = [];
let createdAppointmentIds = [];
let createdVisitNoteIds = [];
let createdReminderIds = [];
let createdEmailLogIds = [];

async function cleanup() {
  console.log('\n--- Starting Cleanup ---');
  try {
    if (createdEmailLogIds.length > 0) {
      await prisma.emailLog.deleteMany({ where: { id: { in: createdEmailLogIds } } });
      console.log(`Cleaned up email logs`);
    }
    if (createdReminderIds.length > 0) {
      await prisma.medicationReminder.deleteMany({ where: { id: { in: createdReminderIds } } });
      console.log(`Cleaned up medication reminders`);
    }
    if (createdVisitNoteIds.length > 0) {
      await prisma.visitNote.deleteMany({ where: { id: { in: createdVisitNoteIds } } });
      console.log(`Cleaned up visit notes`);
    }
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
      console.log(`Cleaned up appointments`);
    }
    if (createdProfileIds.length > 0) {
      await prisma.doctorProfile.deleteMany({ where: { id: { in: createdProfileIds } } });
      console.log(`Cleaned up doctor profiles`);
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log(`Cleaned up users`);
    }
    console.log('--- Cleanup Complete ---\n');
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

async function runPhase8Tests() {
  console.log('--- Phase 8: Medication Reminders Tests (SAFE) ---');

  const timestamp = Date.now();
  
  try {
    // 1. Setup Isolated Users
    const doctor = await prisma.user.create({
      data: {
        name: 'Doctor P8', email: `doctor_phase8_${timestamp}@test.com`, passwordHash: 'hashed', role: 'DOCTOR',
        doctorProfile: {
          create: { specialisation: 'General', workingHoursJson: {}, slotDurationMinutes: 30 }
        }
      },
      include: { doctorProfile: true }
    });
    createdUserIds.push(doctor.id);
    createdProfileIds.push(doctor.doctorProfile.id);

    const patient = await prisma.user.create({
      data: { name: 'Patient P8', email: `patient_phase8_${timestamp}@test.com`, passwordHash: 'hashed', role: 'PATIENT' }
    });
    createdUserIds.push(patient.id);

    // 2. Create Appointment in the past (so we can add notes)
    const now = new Date();
    const pastStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotStart: pastStart,
        slotEnd: pastEnd,
        status: 'COMPLETED'
      }
    });
    createdAppointmentIds.push(appointment.id);

    // 3. Create VisitNote
    const prescriptionData = [
      { medication: 'Medicine A', dosage: '10mg', frequency: 'Twice daily', duration: '3 days' },
      { medication: 'Medicine B', dosage: '5mg', frequency: 'Once daily', duration: '2 days' }
    ];

    const visitNote = await prisma.visitNote.create({
      data: {
        appointmentId: appointment.id,
        clinicalNotes: "Test note",
        prescriptionJson: prescriptionData,
        llmStatus: 'SUCCESS'
      }
    });
    createdVisitNoteIds.push(visitNote.id);

    // 4. Test generateReminders
    await generateReminders(visitNote.id, patient.id, prescriptionData);

    const reminders = await prisma.medicationReminder.findMany({
      where: { visitNoteId: visitNote.id }
    });

    reminders.forEach(r => createdReminderIds.push(r.id));

    // Medicine A: Twice daily for 3 days = 6 reminders
    // Medicine B: Once daily for 2 days = 2 reminders
    // Total = 8 reminders
    if (reminders.length !== 8) {
      throw new Error(`Expected 8 reminders, but generated ${reminders.length}`);
    }
    console.log('✅ Generated correct number of reminders (8)');

    // 5. Test Scheduler Atomicity
    // We will spoof one reminder's time to be "due" now
    const reminderToSpoof = reminders[0];
    await prisma.medicationReminder.update({
      where: { id: reminderToSpoof.id },
      data: { scheduledTime: new Date(Date.now() - 1000) } // due 1 second ago
    });

    // Run scheduler
    await processReminders();

    // Check status
    const updatedReminder = await prisma.medicationReminder.findUnique({
      where: { id: reminderToSpoof.id },
      include: { emailLogs: true }
    });

    if (updatedReminder.status !== 'SENT') {
      throw new Error(`Reminder status not updated to SENT. Status is ${updatedReminder.status}`);
    }

    if (updatedReminder.emailLogs.length !== 1) {
      throw new Error(`Expected exactly 1 email log attached, found ${updatedReminder.emailLogs.length}`);
    }
    
    const emailLog = updatedReminder.emailLogs[0];
    createdEmailLogIds.push(emailLog.id);
    
    if (emailLog.type !== 'MEDICATION_REMINDER') {
      throw new Error(`Incorrect EmailLog type: ${emailLog.type}`);
    }
    
    console.log('✅ Scheduler successfully atomic processed reminder into EmailLog');
    console.log('🎉 Phase 8 Tests Completed Successfully!');

  } catch (err) {
    console.error('❌ Phase 8 Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runPhase8Tests();
