const API_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- Starting API Tests ---');
  let token = '';

  const timestamp = Date.now();
  const email = `patient_${timestamp}@test.com`;

  try {
    console.log('\n1. Testing Registration...');
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Patient',
        email: email,
        password: 'password123',
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    console.log('SUCCESS: Registration works.', data.user);
    token = data.token;
  } catch (err) {
    console.error('FAILED: Registration', err.message);
  }

  try {
    console.log('\n2. Testing Duplicate Email...');
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Patient 2',
        email: email,
        password: 'password123',
        role: 'PATIENT'
      })
    });
    if (res.status === 409) {
      console.log('SUCCESS: Duplicate email rejected.');
    } else {
      console.error('FAILED: Expected 409 Conflict, got', res.status);
    }
  } catch (err) {
    console.error('FAILED: Duplicate email test', err.message);
  }

  try {
    console.log('\n3. Testing Successful Login...');
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: 'password123'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    console.log('SUCCESS: Login works. Token received.');
  } catch (err) {
    console.error('FAILED: Login', err.message);
  }

  try {
    console.log('\n4. Testing Invalid Credentials...');
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: 'wrongpassword'
      })
    });
    if (res.status === 401) {
      console.log('SUCCESS: Invalid credentials rejected.');
    } else {
      console.error('FAILED: Expected 401 Unauthorized, got', res.status);
    }
  } catch (err) {
    console.error('FAILED: Invalid credentials test', err.message);
  }

  try {
    console.log('\n5. Testing JWT Protected Access (/auth/me)...');
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    console.log('SUCCESS: Protected route access works.', data.user);
  } catch (err) {
    console.error('FAILED: Protected route', err.message);
  }
}

runTests();
