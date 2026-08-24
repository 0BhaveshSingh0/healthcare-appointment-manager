import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleGuard from './components/RoleGuard';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import { ToastProvider } from './context/ToastContext';
import Button from './components/ui/Button';
import Badge from './components/ui/Badge';


// Basic top navbar component for auth state
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{ 
      padding: '16px 24px', 
      backgroundColor: 'var(--bg-card)', 
      borderBottom: '1px solid var(--border-color)', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)' }}>Healthcare Clinic</h2>
      <div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {user.name} <Badge>{user.role}</Badge>
            </span>
            <Button variant="secondary" onClick={handleLogout}>Logout</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Register</Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

function App() {
  const [health, setHealth] = useState('Checking backend health...');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    axios.get(`${apiUrl}/health`)
      .then(res => setHealth(`Backend connected. Status: ${res.data.status}`))
      .catch(err => setHealth(`Backend connection failed: ${err.message}`));
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <main className="container" style={{ flex: 1, padding: '32px 16px' }}>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: 'var(--info-bg)', 
                color: 'var(--info-text)',
                borderRadius: 'var(--border-radius)', 
                marginBottom: '24px', 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem' 
              }}>
                <span style={{ display: 'flex', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                <strong>System Status:</strong> {health}
              </div>
              
              <Routes>
                <Route path="/" element={
                  <div style={{ maxWidth: '600px', margin: '64px auto', textAlign: 'center' }}>
                    <h1 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '2.5rem' }}>Healthcare Appointment & Follow-up Manager</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>Please log in or register to continue.</p>
                  </div>
                } />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/patient-dashboard" element={
                <RoleGuard allowedRoles={['PATIENT']}>
                  <PatientDashboard />
                </RoleGuard>
              } />
              <Route path="/doctor-dashboard" element={
                <RoleGuard allowedRoles={['DOCTOR']}>
                  <DoctorDashboard />
                </RoleGuard>
              } />

              <Route path="/admin-dashboard" element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </RoleGuard>
              } />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
