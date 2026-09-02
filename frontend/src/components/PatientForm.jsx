import React, { useState } from 'react';
import { phcAPI } from '../api';
import { FiCheck, FiAlertCircle } from 'react-icons/fi';

export default function PatientForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    age: '',
    gender: 'Male',
    fever: 0,
    cough: 0,
    fatigue: 0,
    headache: 0,
    vomiting: 0,
    breathlessness: 0,
    temperature_c: '',
    heart_rate: '',
    bp_systolic: '',
    wbc_count: '',
    platelet_count: '',
    hemoglobin: '',
    disease_label: '',
    severity_level: 'Low',
  });

  const DISEASE_OPTIONS = [
    'Healthy',
    'Viral Fever',
    'Dengue',
    'Malaria',
    'Typhoid',
    'Pneumonia'
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validation
    if (!formData.age || !formData.temperature_c || !formData.heart_rate || !formData.bp_systolic || 
        !formData.wbc_count || !formData.platelet_count || !formData.hemoglobin || !formData.disease_label) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await phcAPI.submitPatient(formData);
      const training = response.data.training;
      
      // Build success message based on training status
      let message = 'Patient recorded successfully!';
      if (training?.model_trained) {
        message += ` Model trained: v${training.model_version} with ${(training.model_accuracy * 100).toFixed(2)}% accuracy`;
      } else {
        message += ' Queued for training (20 patients required)';
      }
      
      setSuccessMessage(message);
      // Reset form
      setFormData({
        age: '',
        gender: 'Male',
        fever: 0,
        cough: 0,
        fatigue: 0,
        headache: 0,
        vomiting: 0,
        breathlessness: 0,
        temperature_c: '',
        heart_rate: '',
        bp_systolic: '',
        wbc_count: '',
        platelet_count: '',
        hemoglobin: '',
        disease_label: '',
        severity_level: 'Low',
      });
      if (onSuccess) onSuccess();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(
        'Error submitting patient: ' + (error.response?.data?.error || error.message)
      );
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-white to-yellow-50/30 rounded-2xl shadow-golden-lg p-8 border border-yellow-200/30">
      <h2 className="text-3xl font-black bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-8">Patient Health Record</h2>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <FiCheck className="text-green-600 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <FiAlertCircle className="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Demographics Section */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-4">Patient Information</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age *</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="Enter age (0-120)"
                min="0"
                max="120"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vital Signs Section */}
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-4">Vital Signs</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (°C) *</label>
              <input
                type="number"
                name="temperature_c"
                value={formData.temperature_c}
                onChange={handleChange}
                placeholder="36.5-40.0"
                step="0.1"
                min="35"
                max="42"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heart Rate (BPM) *</label>
              <input
                type="number"
                name="heart_rate"
                value={formData.heart_rate}
                onChange={handleChange}
                placeholder="60-100"
                min="30"
                max="200"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">BP Systolic (mmHg) *</label>
              <input
                type="number"
                name="bp_systolic"
                value={formData.bp_systolic}
                onChange={handleChange}
                placeholder="90-180"
                min="50"
                max="250"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Symptoms Section */}
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-4">Symptoms</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="fever"
                checked={formData.fever === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Fever</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="cough"
                checked={formData.cough === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Cough</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="fatigue"
                checked={formData.fatigue === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Fatigue</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="headache"
                checked={formData.headache === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Headache</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="vomiting"
                checked={formData.vomiting === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Vomiting</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="breathlessness"
                checked={formData.breathlessness === 1}
                onChange={handleChange}
                className="rounded border-gray-300 text-yellow-600"
              />
              <span className="ml-2 text-sm text-gray-700">Breathlessness</span>
            </label>
          </div>
        </div>

        {/* Lab Values Section */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-4">Laboratory Results</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">WBC Count (cells/μL) *</label>
              <input
                type="number"
                name="wbc_count"
                value={formData.wbc_count}
                onChange={handleChange}
                placeholder="4000-15000"
                min="1000"
                max="20000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platelet Count (cells/μL) *</label>
              <input
                type="number"
                name="platelet_count"
                value={formData.platelet_count}
                onChange={handleChange}
                placeholder="100000-400000"
                min="10000"
                max="500000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hemoglobin (g/dL) *</label>
              <input
                type="number"
                name="hemoglobin"
                value={formData.hemoglobin}
                onChange={handleChange}
                placeholder="10-16"
                step="0.1"
                min="5"
                max="20"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Diagnosis Section */}
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-4">Diagnosis / Severity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Disease Label *</label>
              <select
                name="disease_label"
                value={formData.disease_label}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a disease...</option>
                {DISEASE_OPTIONS.map((disease) => (
                  <option key={disease} value={disease}>
                    {disease}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity Level</label>
              <select
                name="severity_level"
                value={formData.severity_level}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 py-3 px-4 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting Patient Data...' : 'Submit Patient Data'}
        </button>
      </form>
    </div>
  );
}
