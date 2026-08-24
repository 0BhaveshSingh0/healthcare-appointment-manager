const API_URL = 'http://localhost:3000';

async function runAdminTests() {
  console.log('--- Starting Admin API Tests ---');
  let adminToken = '';
  let patientToken = '';
  let doctorUserId = '';
  
  const timestamp = Date.now();
  const adminEmail = `admin_${timestamp}@test.com`;
  const patientEmail = `patient_${timestamp}@test.com`;
  const doctorEmail = `doctor_${timestamp}@test.com`;

  // 1. Setup Users
  try {
    const resA = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin', email: adminEmail, password: 'password123', role: 'ADMIN' })
    });
    adminToken = (await resA.json()).token;

    const resP = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Patient', email: patientEmail, password: 'password123', role: 'PATIENT' })
    });
    patientToken = (await resP.json()).token;

    const resD = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Doctor', email: doctorEmail, password: 'password123', role: 'DOCTOR' })
    });
    doctorUserId = (await resD.json()).user.id;
  } catch (err) {
    console.error('FAILED: Setup Users', err.message);
    return;
  }

  // 2. Test Authorization
  try {
    const res = await fetch(`${API_URL}/admin/doctors`, { headers: { Authorization: `Bearer ${patientToken}` } });
    if (res.status === 403) console.log('SUCCESS: Non-admin gets 403 Forbidden.');
    else console.error('FAILED: Expected 403, got', res.status);
  } catch (err) {
    console.error('FAILED: Auth test', err);
  }

  // 3. Create Profile
  const validWorkingHours = {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: null, end: null },
    sunday: { enabled: false, start: null, end: null },
  };

  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        specialisation: 'Cardiology',
        workingHoursJson: validWorkingHours,
        slotDurationMinutes: 30
      })
    });
    const data = await res.json();
    if (res.ok) console.log('SUCCESS: DoctorProfile created.');
    else console.error('FAILED: Profile creation', data);
  } catch (err) {
    console.error('FAILED: Profile creation request', err);
  }

  // 4. Invalid Working Hours (start > end)
  const invalidWorkingHours = { ...validWorkingHours, monday: { enabled: true, start: "17:00", end: "09:00" } };
  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ specialisation: 'Cardiology', workingHoursJson: invalidWorkingHours, slotDurationMinutes: 30 })
    });
    if (res.status === 400) console.log('SUCCESS: Invalid working hours rejected.');
    else console.error('FAILED: Expected 400 for invalid hours, got', res.status);
  } catch(err) {}

  // 5. Create Leave
  // Make sure it's a future date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const leaveDateStr = tomorrow.toISOString();

  let leaveId = null;
  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ leaveDate: leaveDateStr, reason: 'Vacation' })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('SUCCESS: DoctorLeave created.');
      leaveId = data.leave.id;
    } else console.error('FAILED: Leave creation', data);
  } catch(err) {
    console.error(err);
  }

  // 6. Duplicate Leave
  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ leaveDate: leaveDateStr, reason: 'Vacation 2' })
    });
    if (res.status === 409) console.log('SUCCESS: Duplicate leave rejected (409).');
    else console.error('FAILED: Expected 409 for duplicate leave, got', res.status);
  } catch(err) {
    console.error(err);
  }
  
  // 7. Delete Leave
  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/leave/${leaveId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.status === 200) console.log('SUCCESS: Leave deleted successfully.');
    else console.error('FAILED: Leave deletion expected 200, got', res.status);
  } catch(err) {
    console.error('FAILED: Leave deletion request', err);
  }

  // 8. Delete Leave Again -> 404
  try {
    const res = await fetch(`${API_URL}/admin/doctors/${doctorUserId}/leave/${leaveId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.status === 404) console.log('SUCCESS: Double deletion rejected (404).');
    else console.error('FAILED: Double deletion expected 404, got', res.status);
  } catch(err) {
    console.error('FAILED: Double deletion request', err);
  }

  // 9. Get Doctors
  try {
    const res = await fetch(`${API_URL}/admin/doctors`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.ok && data.doctors.length > 0) {
       console.log('SUCCESS: Fetched doctors list successfully.');
       const testDoc = data.doctors.find(d => d.id === doctorUserId);
       if (testDoc.doctorProfile.leaves.length === 0) {
         console.log('SUCCESS: Doctor leaves array is empty after deletion.');
       } else {
         console.error('FAILED: Doctor leaves array is NOT empty after deletion.', testDoc.doctorProfile.leaves);
       }
    } else console.error('FAILED: Fetch doctors', data);
  } catch(err) {
    console.error(err);
  }
}

runAdminTests();
