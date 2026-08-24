import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register', { name, email, password, role });
      login(response.data.user, response.data.token);
      
      if (response.data.user.role === 'PATIENT') navigate('/patient-dashboard');
      else if (response.data.user.role === 'DOCTOR') navigate('/doctor-dashboard');
      else if (response.data.user.role === 'ADMIN') navigate('/admin-dashboard');
      showToast('Registration successful!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto' }}>
      <Card>
        <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <Input 
            label="Name" 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            placeholder="John Doe"
          />
          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            placeholder="your@email.com"
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            minLength={6}
            placeholder="At least 6 characters"
          />
          <Select
            label="Role"
            value={role}
            onChange={e => setRole(e.target.value)}
            options={[
              { value: 'PATIENT', label: 'Patient' },
              { value: 'DOCTOR', label: 'Doctor' },
              { value: 'ADMIN', label: 'Admin' }
            ]}
          />
          <Button 
            type="submit" 
            fullWidth 
            isLoading={loading}
            style={{ marginTop: '8px' }}
          >
            Register
          </Button>
        </form>
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link to="/login">Log in here</Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
