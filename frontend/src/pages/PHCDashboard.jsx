import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { dashboardAPI, phcAPI, surveillanceAPI } from '../api';
import PatientForm from '../components/PatientForm';
import DiseasePredictor from '../components/DiseasePredictor';
import SymptomDistributionVisualization from '../components/SymptomDistributionVisualization';
import WhatChangedInsightCard from '../components/WhatChangedInsightCard';
import { LoadingSkeleton, EmptyState } from '../components/LoadingStates';
import { FiUsers, FiActivity, FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiHeart, FiBell, FiPlus } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

export default function PHCDashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const rawPhcId = user.phc_id || `PHC${user.id.slice(-1)}`;
  
  // Format phcId as "PHC 1" instead of "PHC_1" or "PHC1"
  const phcIdFormatted = useMemo(() => {
    const num = rawPhcId.replace(/[^0-9]/g, '');
    return `PHC ${num || '1'}`;
  }, [rawPhcId]);

  const [patients, setPatients] = useState([]);
  const [historicalSnapshot, setHistoricalSnapshot] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [patientsRes, metricsRes, historyRes] = await Promise.all([
        phcAPI.getPatients(),
        dashboardAPI.getPHCMetrics(),
        dashboardAPI.getCohortHistory().catch(() => ({ data: { snapshots: [] } }))
      ]);
      setPatients(patientsRes.data.patients || []);
      setMetrics(metricsRes.data);
      
      const snapshots = historyRes.data.snapshots || [];
      if (snapshots.length > 1) {
        setHistoricalSnapshot(snapshots[1]);
      } else {
        setHistoricalSnapshot(null);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  const symptomData = useMemo(() => {
    if (!patients || patients.length === 0) return [];
    const symptomKeys = ['fever', 'cough', 'fatigue', 'headache', 'breathlessness'];
    const counts = { fever: 0, cough: 0, fatigue: 0, headache: 0, breathlessness: 0 };
    
    patients.forEach(p => {
      symptomKeys.forEach(key => {
        if (p[key] === 1) counts[key]++;
      });
    });

    return symptomKeys.map(key => ({
      symptom: key.charAt(0).toUpperCase() + key.slice(1),
      percentage: parseFloat(((counts[key] / patients.length) * 100).toFixed(1))
    }));
  }, [patients]);

  const hasActiveAlerts = metrics?.risk?.current_severity === 'HIGH' || metrics?.risk?.current_severity === 'CRITICAL';
  const alertStatusText = hasActiveAlerts ? 'ATTENTION REQUIRED' : 'NORMAL';

  // Format Date cleanly
  const formattedLastUpdated = useMemo(() => {
    const options = { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    };
    return lastUpdated.toLocaleDateString('en-GB', options).replace(/,/g, '');
  }, [lastUpdated]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Header Section */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-extrabold text-sky-900 leading-tight">
              {phcIdFormatted} Dashboard
            </h1>
            <p className="text-gray-500 text-sm font-semibold mt-1">
              Welcome {user.username} — Clinical Overview
            </p>
            <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              Last updated: {formattedLastUpdated}
            </p>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition text-xs"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>

        {loading && !metrics ? (
          <LoadingSkeleton count={4} height="150px" />
        ) : metrics ? (
          <div className="space-y-8">

            {/* Top 4 KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Card 1: Prediction Model Accuracy */}
              <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-xs font-bold text-gray-550 mb-4">Prediction Model Accuracy</p>
                  <h3 className="text-3xl font-black text-emerald-600 leading-tight">
                    {metrics.model?.accuracy ? `${(metrics.model.accuracy * 100).toFixed(2)}%` : 'N/A'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-semibold mt-2.5">Active prediction model</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FiCheckCircle size={18} />
                </div>
              </div>

              {/* Card 2: PHC Health Risk */}
              <div className="bg-amber-50/20 border border-amber-100 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-xs font-bold text-gray-550 mb-4">PHC Health Risk</p>
                  <h3 className="text-3xl font-black text-amber-500 leading-tight">
                    {(metrics.risk?.latest_score || 0).toFixed(2)} / 100
                  </h3>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">Severity: {metrics.risk?.severity || 'LOW'}</p>
                  <p className="text-[9px] text-gray-400 font-semibold mt-1.5">Based on current surveillance data</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <FiHeart size={18} />
                </div>
              </div>

              {/* Card 3: Health Alerts */}
              <div 
                onClick={() => {
                  const el = document.getElementById('health-alerts-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-rose-50/10 border border-rose-100 rounded-2xl p-5 flex justify-between items-center shadow-sm cursor-pointer hover:bg-rose-50/20 transition"
              >
                <div>
                  <p className="text-xs font-bold text-gray-550 mb-4">Health Alerts</p>
                  <h3 className={`text-3xl font-black leading-tight ${metrics?.active_alert_count > 0 ? 'text-rose-650' : 'text-slate-500'}`}>
                    {metrics?.active_alert_count > 0 ? `${metrics.active_alert_count} Active` : 'NORMAL'}
                  </h3>
                  <p className="text-[10px] text-gray-455 font-semibold mt-1">
                    {metrics?.active_alert_count > 0 ? 'Alerts require review' : 'No active alerts'}
                  </p>
                  <p className="text-[9px] text-gray-400 font-semibold mt-1.5">
                    {metrics?.active_alert_count > 0 ? 'Abnormal indices detected' : 'All indicators within normal range'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                  <FiBell size={18} />
                </div>
              </div>

              {/* Card 4: Patient Records */}
              <div className="bg-sky-50/20 border border-sky-100 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-xs font-bold text-gray-550 mb-4">Patient Records</p>
                  <h3 className="text-3xl font-black text-blue-600 leading-tight">
                    {patients.length}
                  </h3>
                  <p className="text-[10px] text-gray-455 font-semibold mt-4">Total registered patients</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-blue-600">
                  <FiUsers size={18} />
                </div>
              </div>

            </section>

            {/* HEALTH ALERTS SECTION */}
            <section id="health-alerts-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-850 mb-4 uppercase tracking-wider">
                Health Alerts
              </h2>
              {!metrics?.health_alerts || metrics.health_alerts.length === 0 ? (
                <p className="text-xs text-gray-500 font-medium">
                  No active district health alerts.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-rose-600">
                    {metrics.active_alert_count} ACTIVE HEALTH ALERT{metrics.active_alert_count > 1 ? 'S' : ''}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metrics.health_alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className={`p-5 rounded-xl border flex flex-col justify-between ${
                          alert.severity === 'CRITICAL' ? 'border-red-200 bg-red-50/10' :
                          alert.severity === 'HIGH' ? 'border-orange-200 bg-orange-50/10' :
                          alert.severity === 'MEDIUM' ? 'border-amber-200 bg-amber-50/10' :
                          'border-blue-200 bg-blue-50/10'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2.5">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                              alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              alert.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {alert.alert_type === 'DISTRICT_ADVISORY' ? 'DISTRICT ADVISORY' : 'AUTOMATED SURVEILLANCE ALERT'} — {alert.severity} PRIORITY
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold">
                              Detected: {new Date(alert.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-bold text-gray-800 mb-2">
                            {alert.alert_type === 'DISTRICT_ADVISORY' ? (
                              `Health Advisory: ${alert.disease}`
                            ) : (
                              `${alert.disease} activity increased at nearby ${alert.source_phc}.`
                            )}
                          </h4>
                          
                          {alert.alert_type !== 'DISTRICT_ADVISORY' && (
                            <div className="grid grid-cols-3 gap-2 py-2.5 text-[11px] font-semibold text-gray-600">
                              <div>
                                <span className="text-gray-400 text-[10px] block font-bold uppercase">Current Incidence</span>
                                {alert.current_incidence}%
                              </div>
                              <div>
                                <span className="text-gray-400 text-[10px] block font-bold uppercase">Historical Baseline</span>
                                {alert.baseline_incidence}%
                              </div>
                              <div>
                                <span className="text-gray-400 text-[10px] block font-bold uppercase">Relative Increase</span>
                                <span className="text-rose-600 font-bold">+{alert.change_percentage}%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100/60">
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="px-4 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-50 rounded-lg transition"
                          >
                            View Details
                          </button>
                          {alert.status !== 'ACKNOWLEDGED' && (
                            <button
                              onClick={async () => {
                                try {
                                  await surveillanceAPI.acknowledgeAlert(alert.id);
                                  loadDashboard();
                                } catch (err) {
                                  console.error("Error acknowledging alert:", err);
                                }
                              }}
                              className="px-4 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* CURRENT PHC HEALTH OVERVIEW SECTION */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-gray-850">
                Current PHC Health Overview
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <SymptomDistributionVisualization patients={patients} />
                </div>
                <div>
                  <WhatChangedInsightCard patients={patients} historicalSnapshot={historicalSnapshot} />
                </div>
                <div>
                  <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-6 h-full flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">Common Symptoms</h3>
                      <p className="text-[11px] text-gray-500 font-semibold mb-6">Percentage of patients with each symptom</p>
                      {symptomData.length === 0 ? (
                        <div className="flex items-center justify-center h-[200px] text-gray-400 text-xs">
                          No symptom data available
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={210}>
                          <BarChart data={symptomData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                            <XAxis dataKey="symptom" stroke="#64748B" fontSize={10} fontStyle="normal" />
                            <YAxis 
                              stroke="#64748B" 
                              fontSize={10} 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]} 
                              tickFormatter={(val) => `${val}%`}
                            />
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Bar dataKey="percentage" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={25}>
                              <LabelList 
                                dataKey="percentage" 
                                position="top" 
                                formatter={(val) => `${val}%`} 
                                style={{ fontSize: 9, fill: '#475569', fontWeight: 'bold' }} 
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Section containing AI disease prediction left, and stats/registration on right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: AI Disease Prediction */}
              <div className="lg:col-span-8">
                <DiseasePredictor />
              </div>

              {/* Right Column: Recent Patient Records & Add New Patient */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Recent Patient Records */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Recent Patient Records</h3>
                  {patients.length === 0 ? (
                    <EmptyState
                      title="No Patient Records"
                      description="Add a record to start monitoring patient records history."
                      icon={FiUsers}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 font-bold uppercase">
                            <tr>
                              <th className="px-2 py-2">Age</th>
                              <th className="px-2 py-2">Gender</th>
                              <th className="px-2 py-2">Symptoms</th>
                              <th className="px-2 py-2">Diagnosis</th>
                              <th className="px-2 py-2 text-right">WBC</th>
                              <th className="px-2 py-2 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {patients.slice(0, 5).map((patient, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="px-2 py-2 text-gray-700 font-medium">{patient.age}</td>
                                <td className="px-2 py-2 text-gray-550">{patient.gender}</td>
                                <td className="px-2 py-2 text-gray-550 truncate max-w-[80px]">
                                  {[
                                    patient.fever && 'Fever', 
                                    patient.cough && 'Cough', 
                                    patient.fatigue && 'Fatigue',
                                    patient.headache && 'Headache',
                                  ].filter(Boolean).join(', ') || 'None'}
                                </td>
                                <td className="px-2 py-2 text-gray-700 font-bold">{patient.disease_label}</td>
                                <td className="px-2 py-2 text-right text-gray-600 font-semibold">{patient.wbc_count?.toLocaleString()}</td>
                                <td className="px-2 py-2 text-right text-gray-450 truncate">
                                  {new Date(patient.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="text-center pt-2.5 border-t border-gray-100">
                        <button
                          onClick={() => alert("All historical patient records are archived in District Surveillance.")}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                        >
                          View All Patient Records
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add New Patient */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Add New Patient</h3>
                    <p className="text-xs text-gray-500 mt-0.5 mb-4">Register a new patient health record.</p>
                  </div>
                  <button
                    onClick={() => setIsAddPatientModalOpen(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition text-xs"
                  >
                    <FiPlus size={14} />
                    Add Patient Record
                  </button>
                </div>

              </div>
            </div>

          </div>
        ) : (
          <EmptyState title="Dashboard metrics unavailable" subtitle="No data has been generated yet." />
        )}
      </div>

      {/* Patient Registration Dialog Modal */}
      {isAddPatientModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full p-6 relative border border-gray-100 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsAddPatientModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-base p-1.5 rounded-full hover:bg-gray-100 transition"
            >
              ✕
            </button>
            <PatientForm onSuccess={() => {
              setIsAddPatientModalOpen(false);
              loadDashboard();
            }} />
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative">
            <h3 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-wider">
              {selectedAlert.alert_type === 'DISTRICT_ADVISORY' ? 'District Admin Advisory' : 'Automated Surveillance Alert'} Details
            </h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    selectedAlert.status === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedAlert.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Severity</span>
                  <span>{selectedAlert.severity}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Disease / Topic</span>
                  <span>{selectedAlert.disease}</span>
                </div>
                {selectedAlert.alert_type !== 'DISTRICT_ADVISORY' && (
                  <>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold uppercase">Source Location</span>
                      <span>{selectedAlert.source_phc}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold uppercase">Metrics Summary</span>
                      <span>Current incidence {selectedAlert.current_incidence}% vs historical baseline {selectedAlert.baseline_incidence}% (+{selectedAlert.change_percentage}% increase)</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-gray-400 text-[10px] block font-bold uppercase">Full Alert Message</span>
                <div className="p-4 bg-yellow-50/30 border border-yellow-100 rounded-xl whitespace-pre-wrap leading-relaxed">
                  {selectedAlert.message}
                </div>
              </div>

              {selectedAlert.recommended_action && (
                <div className="space-y-1">
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Recommended Surveillance Action</span>
                  <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl">
                    {selectedAlert.recommended_action}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              {selectedAlert.status !== 'ACKNOWLEDGED' && (
                <button
                  onClick={async () => {
                    try {
                      await surveillanceAPI.acknowledgeAlert(selectedAlert.id);
                      setSelectedAlert(null);
                      loadDashboard();
                    } catch (err) {
                      console.error("Error acknowledging alert:", err);
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                >
                  Acknowledge Alert
                </button>
              )}
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
