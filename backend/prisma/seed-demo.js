require('dotenv').config();
const prisma = require('../src/db/prisma');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DEMO_EMAILS = {
  PATIENT: 'patient.demo@healthcare-demo.com',
  DOCTOR: 'doctor.demo@healthcare-demo.com',
  ADMIN: 'admin.demo@healthcare-demo.com',
  PENDING_DOCTOR: 'pending.doctor.demo@healthcare-demo.com'
};

const ALL_DEMO_EMAILS = Object.values(DEMO_EMAILS);

async function main() {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');

  if (isReset) {
    console.log('Reset flag detected. Deleting existing demo records...');
    const result = await prisma.user.deleteMany({
      where: { email: { in: ALL_DEMO_EMAILS } }
    });
    console.log(`Deleted ${result.count} demo user(s) and their cascaded relations (appointments, notes, profiles).`);
    console.log('Safe reset complete.');
    return;
  }

  console.log('Starting safe demo data seed...');
  
  const demoDataPath = path.join(__dirname, 'demo-data.json');
  const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
  
  const passwordHashPatient = await bcrypt.hash('Patient@12345', 10);
  const passwordHashDoctor = await bcrypt.hash('Doctor@12345', 10);
  const passwordHashAdmin = await bcrypt.hash('Admin@12345', 10);

  console.log('Ensuring demo users exist...');

  // Upsert Users
  const adminUser = await prisma.user.upsert({
    where: { email: DEMO_EMAILS.ADMIN },
    update: {},
    create: {
      name: 'Demo Admin',
      email: DEMO_EMAILS.ADMIN,
      passwordHash: passwordHashAdmin,
      role: 'ADMIN'
    }
  });

  const patientUser = await prisma.user.upsert({
    where: { email: DEMO_EMAILS.PATIENT },
    update: {},
    create: {
      name: 'Demo Patient',
      email: DEMO_EMAILS.PATIENT,
      passwordHash: passwordHashPatient,
      role: 'PATIENT'
    }
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: DEMO_EMAILS.DOCTOR },
    update: {},
    create: {
      name: 'Dr. Demo Doctor',
      email: DEMO_EMAILS.DOCTOR,
      passwordHash: passwordHashDoctor,
      role: 'DOCTOR'
    }
  });

  const pendingDoctorUser = await prisma.user.upsert({
    where: { email: DEMO_EMAILS.PENDING_DOCTOR },
    update: {},
    create: {
      name: 'Dr. Pending Demo',
      email: DEMO_EMAILS.PENDING_DOCTOR,
      passwordHash: passwordHashDoctor, // same pass
      role: 'DOCTOR'
    }
  });

  // Upsert Doctor Profile for main doctor
  await prisma.doctorProfile.upsert({
    where: { userId: doctorUser.id },
    update: demoData.doctorProfile,
    create: {
      userId: doctorUser.id,
      specialisation: demoData.doctorProfile.specialisation,
      slotDurationMinutes: demoData.doctorProfile.slotDurationMinutes,
      workingHoursJson: demoData.doctorProfile.workingHoursJson
    }
  });

  // Calculate Relative Dates
  const now = new Date();
  
  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - 2);
  pastDate.setHours(10, 0, 0, 0);
  const pastEnd = new Date(pastDate);
  pastEnd.setMinutes(30);

  const activeDate = new Date(now);
  activeDate.setDate(now.getDate() + 1);
  activeDate.setHours(14, 0, 0, 0);
  const activeEnd = new Date(activeDate);
  activeEnd.setMinutes(30);

  const upcomingDate = new Date(now);
  upcomingDate.setDate(now.getDate() + 5);
  upcomingDate.setHours(11, 0, 0, 0);
  const upcomingEnd = new Date(upcomingDate);
  upcomingEnd.setMinutes(30);

  // Idempotency for appointments: delete only the appointments between the demo patient and demo doctor
  // before recreating them to prevent duplicate records upon running seed multiple times without --reset.
  await prisma.appointment.deleteMany({
    where: {
      patientId: patientUser.id,
      doctorId: doctorUser.id
    }
  });

  console.log('Seeding demo appointments...');

  // App 1: Completed
  const app1 = await prisma.appointment.create({
    data: {
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      slotStart: pastDate,
      slotEnd: pastEnd,
      status: 'COMPLETED'
    }
  });

  await prisma.symptomForm.create({
    data: {
      appointmentId: app1.id,
      rawSymptomsText: demoData.symptoms.completed.rawSymptomsText,
      aiUrgency: demoData.symptoms.completed.aiUrgency,
      aiChiefComplaint: demoData.symptoms.completed.aiChiefComplaint,
      aiQuestionsJson: demoData.symptoms.completed.aiQuestionsJson,
      llmStatus: 'SUCCESS'
    }
  });

  await prisma.visitNote.create({
    data: {
      appointmentId: app1.id,
      clinicalNotes: demoData.visitNotes.completed.clinicalNotes,
      prescriptionJson: demoData.visitNotes.completed.prescriptionJson,
      aiPatientSummary: demoData.visitNotes.completed.aiPatientSummary,
      llmStatus: 'SUCCESS'
    }
  });

  // App 2: Active / Upcoming
  const app2 = await prisma.appointment.create({
    data: {
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      slotStart: activeDate,
      slotEnd: activeEnd,
      status: 'SCHEDULED'
    }
  });

  await prisma.symptomForm.create({
    data: {
      appointmentId: app2.id,
      rawSymptomsText: demoData.symptoms.active.rawSymptomsText,
      aiUrgency: demoData.symptoms.active.aiUrgency,
      aiChiefComplaint: demoData.symptoms.active.aiChiefComplaint,
      aiQuestionsJson: demoData.symptoms.active.aiQuestionsJson,
      llmStatus: 'SUCCESS'
    }
  });

  // App 3: Upcoming without Symptoms
  await prisma.appointment.create({
    data: {
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      slotStart: upcomingDate,
      slotEnd: upcomingEnd,
      status: 'SCHEDULED'
    }
  });

  console.log('Demo data seeded successfully!');
  console.log(`- Patient: ${DEMO_EMAILS.PATIENT}`);
  console.log(`- Doctor: ${DEMO_EMAILS.DOCTOR}`);
  console.log(`- Admin: ${DEMO_EMAILS.ADMIN}`);
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
