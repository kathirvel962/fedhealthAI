import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
};

export const phcAPI = {
  submitPatient: (patientData) => api.post('/phc/patient/', patientData),
  getPatients: () => api.get('/phc/patients/'),
  getPHCList: () => api.get('/phcs/'),
  updatePHC: (phc_id, data) => api.put(`/phcs/${phc_id}/`, data),
};

export const surveillanceAPI = {
  getAlerts: () => api.get('/surveillance/alerts/'),
  getPHCActiveAlerts: () => api.get('/surveillance/my-alerts/'),
  getAlertDetails: (id) => api.get(`/surveillance/alerts/${id}/`),
  acknowledgeAlert: (id) => api.post(`/surveillance/alerts/${id}/acknowledge/`),
  resolveAlert: (id) => api.post(`/surveillance/alerts/${id}/resolve/`),
  getDistrictAlerts: () => api.get('/surveillance/district-alerts/'),
  sendAdvisory: (data) => api.post('/surveillance/advisories/', data),
  triggerDetection: () => api.post('/surveillance/detect/'),
  requestNotification: (data) => api.post('/surveillance/notify/', data),
  confirmNotification: (data) => api.post('/surveillance/notify/confirm/', data),
  directSendAlert: (data) => api.post('/surveillance/direct-send/', data),
};

// STEP 7: Dashboard Metrics APIs
export const dashboardAPI = {
  // PHC Dashboard - local model accuracy, drift warnings, risk scores, alerts
  getPHCMetrics: () => api.get('/dashboards/phc/'),
  
  // District Dashboard - global model, aggregation, contributing PHCs, average risk
  getDistrictMetrics: () => api.get('/dashboards/district/'),
  
  // Surveillance Dashboard - outbreak trends, alert history, heatmap data
  getSurveillanceMetrics: () => api.get('/dashboards/surveillance/'),
  
  // Cohort history for trend analysis
  getCohortHistory: () => api.get('/cohort/history/'),
};

export const predictionAPI = {
  getPrediction: (clinicalFeatures, modelVersion = null) =>
    api.post('/predictions/', { clinical_features: clinicalFeatures, model_version: modelVersion }),
};

export const nonIIDAPI = {
  getAnalysis: () => api.get('/fl/non-iid/'),
  triggerAnalysis: () => api.post('/fl/non-iid/'),
};

