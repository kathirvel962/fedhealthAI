import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { predictionAPI } from '../api';
import { FiAlertTriangle } from 'react-icons/fi';

export default function DiseasePredictor() {
  const [patientInfo, setPatientInfo] = useState({
    age: '34',
    gender: 'Female',
  });

  const [features, setFeatures] = useState({
    fever: 1,
    cough: 1,
    fatigue: 1,
    headache: 0,
    vomiting: 0,
    breathlessness: 0,
    temperature_c: 37.0,
    heart_rate: 80,
    bp_systolic: 120,
    wbc_count: 7000,
    platelet_count: 250000,
    hemoglobin: 14.0,
  });

  const [result, setResult] = useState({
    predicted_disease: 'Viral Fever',
    confidence: 0.724,
    class_probabilities: {
      'Viral Fever': 0.724,
      'Dengue': 0.124,
      'Malaria': 0.081,
      'Pneumonia': 0.102,
      'Typhoid': 0.036,
      'Healthy': 0.053
    }
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePatientInfoChange = (e) => {
    const { name, value } = e.target;
    setPatientInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue;
    
    if (type === 'checkbox') {
      finalValue = checked ? 1 : 0;
    } else {
      finalValue = value === '' ? '' : parseFloat(value);
    }
    
    setFeatures(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate inputs
    if (!patientInfo.age) {
      setError("Please provide patient age.");
      setLoading(false);
      return;
    }

    for (const key in features) {
      if (features[key] === '' || isNaN(features[key])) {
        setError(`Please provide a valid numeric value for ${key.replace('_', ' ')}.`);
        setLoading(false);
        return;
      }
    }

    try {
      const response = await predictionAPI.getPrediction(features);
      setResult(response.data);
    } catch (err) {
      console.error('Prediction failed:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || 'No prediction model is currently trained or available.';
      setError(errMsg);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-base font-bold text-gray-900">AI Disease Prediction</h3>
        <p className="text-xs text-gray-500 mt-0.5">Enter patient information to receive an AI-assisted disease prediction.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form Column */}
        <form onSubmit={handlePredict} className="lg:col-span-7 space-y-5">
          
          {/* Patient Information Section */}
          <div>
            <p className="text-xs font-bold text-blue-600 mb-2.5">Patient Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Age (years)</label>
                <input
                  type="number"
                  name="age"
                  value={patientInfo.age}
                  onChange={handlePatientInfoChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Gender</label>
                <select
                  name="gender"
                  value={patientInfo.gender}
                  onChange={handlePatientInfoChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Symptoms Section */}
          <div>
            <p className="text-xs font-bold text-blue-600 mb-2.5">Symptoms (Select all that apply)</p>
            <div className="grid grid-cols-3 gap-3">
              {['fever', 'cough', 'fatigue', 'headache', 'vomiting', 'breathlessness'].map((symptom) => (
                <label 
                  key={symptom} 
                  className="flex items-center gap-2 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    name={symptom}
                    checked={features[symptom] === 1}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium capitalize text-gray-700">
                    {symptom}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Vitals Section */}
          <div>
            <p className="text-xs font-bold text-blue-600 mb-2.5">Vital Signs</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  name="temperature_c"
                  value={features.temperature_c}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Heart Rate (BPM)</label>
                <input
                  type="number"
                  name="heart_rate"
                  value={features.heart_rate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  name="bp_systolic"
                  value={features.bp_systolic}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Lab Metrics Section */}
          <div>
            <p className="text-xs font-bold text-blue-600 mb-2.5">Lab Results</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">WBC Count (cells/µL)</label>
                <input
                  type="number"
                  name="wbc_count"
                  value={features.wbc_count}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Platelet Count (cells/µL)</label>
                <input
                  type="number"
                  name="platelet_count"
                  value={features.platelet_count}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-550 mb-1 uppercase">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  name="hemoglobin"
                  value={features.hemoglobin}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs">
              <FiAlertTriangle className="flex-shrink-0 text-red-500 text-sm" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold text-white shadow-sm transition bg-blue-600 hover:bg-blue-700 text-sm"
          >
            {loading ? 'Processing...' : 'Get Disease Prediction'}
          </button>
        </form>

        {/* Results Column */}
        <div className="lg:col-span-5 h-full flex flex-col justify-between">
          <div className="border border-gray-100 rounded-2xl bg-gray-50/20 p-5 space-y-6">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Prediction Result</p>
              
              <div className="mt-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Predicted Condition</span>
                <h3 className="text-2xl font-black text-blue-800 leading-tight">
                  {result?.predicted_disease || 'N/A'}
                </h3>
              </div>
              
              <div className="mt-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Confidence</span>
                <h4 className="text-xl font-black text-blue-650 leading-tight">
                  {result ? `${(result.confidence * 100).toFixed(1)}%` : 'N/A'}
                </h4>
              </div>
            </div>

            {result?.class_probabilities && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Disease Probability</span>
                {Object.entries(result.class_probabilities)
                  .sort((a, b) => b[1] - a[1])
                  .map(([disease, prob]) => (
                    <div key={disease} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                        <span>{disease}</span>
                        <span>{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${prob * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            <p className="text-[10px] text-gray-450 leading-relaxed pt-2 border-t border-gray-100">
              AI prediction is decision support and does not replace clinical judgment.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
