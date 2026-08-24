import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const getDoctorAppointments = async () => {
  const res = await axios.get(`${API_URL}/appointments/doctor`, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const getDoctorAvailableSlots = async (doctorId, date) => {
  const res = await axios.get(`${API_URL}/appointments/doctors/${doctorId}/slots?date=${date}`, {
    headers: getAuthHeaders()
  });
  return res.data;
};

export const rescheduleAppointment = async (appointmentId, date, slotTime) => {
  const res = await axios.put(`${API_URL}/appointments/${appointmentId}/reschedule`, 
    { date, slotTime },
    { headers: getAuthHeaders() }
  );
  return res.data;
};

export const submitNotes = async (appointmentId, clinicalNotes, prescription) => {
  const res = await axios.post(`${API_URL}/appointments/${appointmentId}/notes`, 
    { clinicalNotes, prescription },
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
