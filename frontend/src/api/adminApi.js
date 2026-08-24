import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const getDoctors = async () => {
  const response = await axios.get(`${API_URL}/admin/doctors`, getAuthHeaders());
  return response.data.doctors;
};

export const createDoctorProfile = async (userId, profileData) => {
  const response = await axios.post(`${API_URL}/admin/doctors/${userId}/profile`, profileData, getAuthHeaders());
  return response.data.profile;
};

export const updateDoctorProfile = async (userId, profileData) => {
  const response = await axios.put(`${API_URL}/admin/doctors/${userId}/profile`, profileData, getAuthHeaders());
  return response.data.profile;
};

export const markLeave = async (userId, leaveData) => {
  const response = await axios.post(`${API_URL}/admin/doctors/${userId}/leave`, leaveData, getAuthHeaders());
  return response.data.leave;
};

export const cancelLeave = async (userId, leaveId) => {
  const response = await axios.delete(`${API_URL}/admin/doctors/${userId}/leave/${leaveId}`, getAuthHeaders());
  return response.data;
};

export const checkLeaveImpact = async (userId, date) => {
  const response = await axios.get(`${API_URL}/admin/doctors/${userId}/leave/impact?date=${date}`, getAuthHeaders());
  return response.data;
};
