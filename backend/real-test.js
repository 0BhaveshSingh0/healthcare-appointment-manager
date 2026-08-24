const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const API_URL = 'http://localhost:3000';

async function apiCall(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function runRealTest() {
  try {
    const ts = Date.now();
    // Register Patient
    const pEmail = `realpatient_${ts}@test.com`;
    const patientRes = await apiCall('POST', '/auth/register', { name: 'Real Patient', email: pEmail, password: 'password', role: 'PATIENT' });
    const patientToken = patientRes.token;

    // Register Doctor
    const dEmail = `realdoctor_${ts}@test.com`;
    const doctorRes = await apiCall('POST', '/auth/register', { name: 'Real Doctor', email: dEmail, password: 'password', role: 'DOCTOR' });
    const doctor = doctorRes.user;

    // Register Admin and assign profile to doctor
    const adminRes = await apiCall('POST', '/auth/register', { name: 'Admin', email: `admin_${ts}@test.com`, password: 'password', role: 'ADMIN' });
    await apiCall('POST', `/admin/doctors/${doctor.id}/profile`, {
      specialisation: 'General',
      experienceYears: 5,
      consultationFee: 100,
      clinicAddress: '123 Main St',
      workingHoursJson: {
        monday: { enabled: true, start: "09:00", end: "17:00" },
        tuesday: { enabled: true, start: "09:00", end: "17:00" },
        wednesday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
        friday: { enabled: true, start: "09:00", end: "17:00" },
        saturday: { enabled: false, start: null, end: null },
        sunday: { enabled: false, start: null, end: null }
      },
      slotDurationMinutes: 30
    }, adminRes.token);

    // Book Appointment
    const slotsRes = await apiCall('GET', `/appointments/doctors/${doctor.id}/slots?date=2026-08-25`, null, patientToken);
    const slotTime = slotsRes.slots[0];

    const bookRes = await apiCall('POST', '/appointments', { doctorId: doctor.id, date: '2026-08-25', slotTime }, patientToken);
    const appointmentId = bookRes.appointment.id;

    console.log('Sending real symptoms to Gemini via API...');
    const symptomText = "I have had a headache and mild fever since yesterday. I also feel tired and have difficulty concentrating.";
    const symptomRes = await apiCall('POST', `/appointments/${appointmentId}/symptoms`, { rawSymptomsText: symptomText }, patientToken);

    console.log('\n--- Real Test Result ---');
    console.log(JSON.stringify(symptomRes.symptomForm, null, 2));

  } catch (e) {
    console.error('Error:', e);
  }
}

runRealTest();
