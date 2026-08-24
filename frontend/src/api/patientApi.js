import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const getDoctors = async (specialisation = '') => {
  const res = await axios.get(`${API_URL}/appointments/doctors?specialisation=${specialisation}`, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const getAvailableSlots = async (doctorId, date) => {
  const res = await axios.get(`${API_URL}/appointments/doctors/${doctorId}/slots?date=${date}`, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const bookAppointment = async (doctorId, date, slotTime) => {
  const res = await axios.post(`${API_URL}/appointments`, 
    { doctorId, date, slotTime },
    { headers: getAuthHeaders() }
  );
  return res.data;
};

export const getPatientAppointments = async () => {
  const res = await axios.get(`${API_URL}/appointments/patient`, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const submitSymptoms = async (appointmentId, rawSymptomsText) => {
  const res = await axios.post(`${API_URL}/appointments/${appointmentId}/symptoms`,
    { rawSymptomsText },
    { headers: getAuthHeaders() }
  );
  return res.data;
};

export const cancelAppointment = async (appointmentId) => {
  const res = await axios.put(`${API_URL}/appointments/${appointmentId}/cancel`, {}, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const connectGoogleCalendar = async () => {
  const authWindow = window.open('', '_blank');
  if (!authWindow) {
    alert("Please allow popups for this site to connect Google Calendar.");
    return;
  }
  try {
    const res = await axios.post(`${API_URL}/auth/google/init`, {}, {
      headers: getAuthHeaders()
    });
    authWindow.location.href = res.data.url;
  } catch (error) {
    authWindow.close();
    throw error;
  }
};

export const checkCalendarStatus = async () => {
  const res = await axios.get(`${API_URL}/auth/me`, {
    headers: getAuthHeaders()
  });
  return res.data.hasCalendar;
};
