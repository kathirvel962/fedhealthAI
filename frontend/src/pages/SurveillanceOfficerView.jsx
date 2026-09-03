import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertCircle,
  FiTrendingUp,
  FiMap,
  FiActivity,
  FiShield,
  FiBarChart2,
  FiRefreshCw,
  FiBell,
  FiCheckCircle,
  FiX,
  FiClock,
  FiInfo,
  FiCheck,
  FiAlertTriangle,
  FiSend
} from 'react-icons/fi';
import { dashboardAPI, surveillanceAPI } from '../api';
import GeographicSurveillanceMap from '../components/GeographicSurveillanceMap';
import KPICard from '../components/KPICard';
import PremiumCard from '../components/PremiumCard';
import { LoadingSkeleton } from '../components/LoadingStates';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { medicalTheme, getSeverityColor } from '../components/MedicalTheme';
import { sendPHCAlert } from '../services/emailService';

export default function SurveillanceOfficerView() {
  const user = JSON.parse(localStorage.getItem('user'));

  // State management
  const [surveillanceMetrics, setSurveillanceMetrics] = useState(null);
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedAlert, setSelectedAlert] = useState(null); // Detail modal
  const [refreshError, setRefreshError] = useState(null);

  // New notification states
  const [notifyLoading, setNotifyLoading] = useState({});
  const [selectedPhcOnMap, setSelectedPhcOnMap] = useState(null);

  // Direct Alert Dispatch Modal State (defaults to PHC_5)
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directForm, setDirectForm] = useState({
    target_phc_id: 'PHC_5',
    source_phc_id: 'PHC_4',
    disease: 'Dengue',
    severity: 'HIGH',
    risk_score: '85.0',
    message: ''
  });
  const [directSending, setDirectSending] = useState(false);
  const [directFeedback, setDirectFeedback] = useState(null);

  // Auto-refresh interval (15 seconds)
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      handleRefresh();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Direct Alert Dispatch to a specific PHC (e.g. PHC_3)
  const handleDirectDispatch = async (e) => {
    if (e) e.preventDefault();
    setDirectSending(true);
    setDirectFeedback(null);

    try {
      const res = await surveillanceAPI.directSendAlert({
        target_phc_id: directForm.target_phc_id,
        source_phc_id: directForm.source_phc_id,
        disease: directForm.disease,
        severity: directForm.severity,
        risk_score: directForm.risk_score,
        message: directForm.message.trim() || undefined
      });

      if (res.data.status === 'sent') {
        setDirectFeedback({
          type: 'success',
          text: res.data.message || `Surveillance email delivered successfully to ${directForm.target_phc_id}!`
        });
        await loadAllData();
      } else if (res.data.status === 'pending' && res.data.email_params) {
        // Fallback to EmailJS if backend SMTP not directly connected
        try {
          await sendPHCAlert(res.data.email_params);
          await surveillanceAPI.confirmNotification({
            log_id: res.data.log_id,
            status: 'SENT'
          });
          setDirectFeedback({
            type: 'success',
            text: `Email alert sent successfully to ${res.data.email_params.to_email} for ${directForm.target_phc_id}!`
          });
          await loadAllData();
        } catch (emailErr) {
          await surveillanceAPI.confirmNotification({
            log_id: res.data.log_id,
            status: 'FAILED',
            error_message: emailErr.message
          });
          throw emailErr;
        }
      }
    } catch (err) {
      console.error('Direct dispatch error:', err);
      setDirectFeedback({
        type: 'error',
        text: err?.response?.data?.error || err.message || 'Failed to dispatch alert email.'
      });
    } finally {
      setDirectSending(false);
    }
  };

  // Manual Notification Handler using confirm endpoint for robustness
  const handleNotifyPhc = async (alertId, recipientPhcId) => {
    const key = `${alertId}_${recipientPhcId}`;
    setNotifyLoading(prev => ({ ...prev, [key]: true }));

    try {
      // 1. Request parameters from the backend (manual notification)
      const requestRes = await surveillanceAPI.requestNotification({
        alert_id: alertId,
        recipient_phc_id: recipientPhcId,
        notification_type: 'manual'
      });

      if (requestRes.data.status === 'already_sent' || requestRes.data.status === 'sent') {
        // Notification delivered directly by backend or already delivered
        setNotifyLoading(prev => ({ ...prev, [key]: false }));
        await loadAllData();
        return;
      }

      const { log_id, email_params } = requestRes.data;

      // 2. Fallback to EmailJS send if configured
      if (email_params) {
        try {
          await sendPHCAlert(email_params);

          // 3. Confirm success on backend
          await surveillanceAPI.confirmNotification({
            log_id,
            status: 'SENT'
          });

        } catch (emailError) {
          // 4. Confirm failure on backend
          await surveillanceAPI.confirmNotification({
            log_id,
            status: 'FAILED',
            error_message: emailError?.message || 'Notification failed to deliver'
          });
          throw emailError;
        }
      }

      // Reload everything to update notification statuses in UI
      await loadAllData();

    } catch (err) {
      console.error('Notification dispatch error:', err);
      alert(err.message || 'Failed to send notification email. Please check configuration and try again.');
    } finally {
      setNotifyLoading(prev => ({ ...prev, [key]: false }));
    }
  };


  const loadAllData = async () => {
    setLoading(true);
    setRefreshError(null);
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        dashboardAPI.getSurveillanceMetrics(),
        surveillanceAPI.getDistrictAlerts(),
      ]);
      setSurveillanceMetrics(metricsRes.data);
      setHealthAlerts(alertsRes.data.alerts || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading surveillance data:', error);
      setRefreshError('Unable to load surveillance data. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setRefreshError(null);
    try {
      // Trigger automated surveillance cycle first
      try {
        await surveillanceAPI.triggerDetection();
      } catch (err) {
        console.warn('Detection engine trigger warning:', err);
      }

      const [metricsRes, alertsRes] = await Promise.all([
        dashboardAPI.getSurveillanceMetrics(),
        surveillanceAPI.getDistrictAlerts(),
      ]);
      setSurveillanceMetrics(metricsRes.data);
      setHealthAlerts(alertsRes.data.alerts || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing surveillance data:', error);
      setRefreshError('Failed to refresh data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await surveillanceAPI.acknowledgeAlert(alertId);
      // Refresh local list state directly or reload
      await loadAllData();
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert(prev => prev ? { ...prev, status: 'ACKNOWLEDGED' } : null);
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      alert('Unable to acknowledge alert. Please try again.');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await surveillanceAPI.resolveAlert(alertId);
      await loadAllData();
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert(prev => prev ? { ...prev, status: 'RESOLVED' } : null);
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      alert('Unable to resolve alert. Please try again.');
    }
  };

  const phcToCity = (phcId) => {
    if (surveillanceMetrics && surveillanceMetrics.phcs) {
      const phc = surveillanceMetrics.phcs.find(p => p.phc_id === phcId);
      if (phc) return phc.city;
    }
    const cityMapping = {
      'PHC_1': 'Thondamuthur',
      'PHC_2': 'Annur',
      'PHC_3': 'Pollachi North',
      'PHC_4': 'Madukkarai',
      'PHC_5': 'Madukkarai / Coimbatore South'
    };
    return cityMapping[phcId] || 'Unknown';
  };

  const NEARBY_PHCS = {
    'PHC_1': ['PHC_2', 'PHC_3'],
    'PHC_2': ['PHC_1', 'PHC_4'],
    'PHC_3': ['PHC_1', 'PHC_5'],
    'PHC_4': ['PHC_2', 'PHC_5'],
    'PHC_5': ['PHC_3', 'PHC_4']
  };

  const formatAlertDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Derived metrics from active alerts list
  const activeAlerts = healthAlerts.filter(a => a.status !== 'RESOLVED');
  const resolvedAlerts = healthAlerts.filter(a => a.status === 'RESOLVED');

  const activeAlertsCount = activeAlerts.length;
  const highPriorityCount = activeAlerts.filter(a => a.severity === 'HIGH').length;
  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;

  const affectedPHCsSet = new Set();
  activeAlerts.forEach(a => {
    if (a.source_phc) affectedPHCsSet.add(a.source_phc);
    if (a.target_phc) affectedPHCsSet.add(a.target_phc);
  });
  const affectedPHCsCount = affectedPHCsSet.size;

  const avgRiskScore = surveillanceMetrics?.summary?.average_risk_score || 0.0;

  // Sorting: CRITICAL -> HIGH -> MEDIUM -> LOW, then newest first
  const sortedActiveAlerts = [...activeAlerts].sort((a, b) => {
    const severityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    const weightA = severityWeight[a.severity] || 0;
    const weightB = severityWeight[b.severity] || 0;
    if (weightB !== weightA) return weightB - weightA;
    return new Date(b.created_at) - new Date(a.created_at);
  });


  const getNextActionMessage = () => {
    if (criticalCount > 0) {
      return {
        severity: 'CRITICAL',
        title: 'CRITICAL ALERT REVIEW REQUIRED',
        text: 'Review critical active alerts immediately. Coordinate emergency response and deploy district health surveillance teams to affected PHCs.'
      };
    } else if (highPriorityCount > 0) {
      return {
        severity: 'HIGH',
        title: 'HIGH SEVERITY MONITORING REQUIRED',
        text: 'Review high-severity alerts. Monitor suspected cases and patient admission trends closely in the affected areas.'
      };
    } else if (activeAlertsCount > 0) {
      return {
        severity: 'MEDIUM',
        title: 'ROUTINE SURVEILLANCE REVIEW',
        text: 'Review active alerts. Acknowledge and investigate signals once their details have been reviewed.'
      };
    } else {
      return {
        severity: 'LOW',
        title: 'NO IMMEDIATE ACTION REQUIRED',
        text: 'All system health signals are currently within normal baseline parameters. Continue routine surveillance.'
      };
    }
  };

  const nextAction = getNextActionMessage();
  const hasTrendData = surveillanceMetrics?.outbreak_trend && surveillanceMetrics.outbreak_trend.length >= 2;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FFFBF0 0%, #F8FAFC 50%, #FFFBF0 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold gradient-text-alert mb-2">
                SURVEILLANCE COMMAND CENTER
              </h1>
              <p className="text-gray-600 text-sm">
                District-wide disease surveillance and health alerts
              </p>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: medicalTheme.colors.danger }}></span>
                Last updated: {lastUpdated.toLocaleTimeString()} | Auto-refreshing (15s)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setDirectFeedback(null);
                  setShowDirectModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm shadow-md font-semibold transition cursor-pointer"
                title="Send manual surveillance alert email to a PHC"
              >
                <FiSend className="text-sm" />
                Send Alert to PHC
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                onClick={handleRefresh}
                className="btn-premium flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-black shadow-md font-semibold"
                style={{
                  background: medicalTheme.colors.gradients.danger_gradient
                }}
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </motion.button>
            </div>
          </div>
          {refreshError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <FiAlertCircle />
              {refreshError}
            </div>
          )}
        </motion.div>

        {/* District Surveillance Status (Status KPI Row) */}
        {loading && !surveillanceMetrics ? (
          <LoadingSkeleton count={5} height="120px" />
        ) : surveillanceMetrics ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <KPICard
              title="ACTIVE ALERTS"
              value={activeAlertsCount}
              subtitle="Requires review"
              icon={FiBell}
              gradient={medicalTheme.colors.gradients.primary_gradient}
            />
            <KPICard
              title="HIGH PRIORITY"
              value={highPriorityCount}
              subtitle="Monitor closely"
              icon={FiActivity}
              gradient={medicalTheme.colors.gradients.alert_gradient}
              isPulsing={highPriorityCount > 0}
            />
            <KPICard
              title="CRITICAL"
              value={criticalCount}
              subtitle="Immediate action"
              icon={FiAlertCircle}
              gradient={medicalTheme.colors.gradients.danger_gradient}
              isAlert={criticalCount > 0}
              isPulsing={criticalCount > 0}
            />
            <KPICard
              title="AFFECTED PHCs"
              value={affectedPHCsCount}
              subtitle="PHCs with active alerts"
              icon={FiMap}
              gradient={medicalTheme.colors.gradients.federation_gradient}
            />
            <KPICard
              title="AVERAGE RISK"
              value={`${avgRiskScore.toFixed(1)} / 100`}
              subtitle="District Risk Index"
              icon={FiShield}
              gradient={medicalTheme.colors.gradients.forecast_gradient}
            />
          </div>
        ) : null}

        {/* Priority Health Alerts & Next Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Main Feed: PHC Surveillance Risk Alerts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border-b pb-2 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  PHC SURVEILLANCE RISK ALERTS
                </h2>
                <p className="text-xs text-gray-500">
                  Real-time health center risk evaluation and recipient notifications
                </p>
              </div>
              <span className="px-2.5 py-0.5 bg-red-105 text-red-700 rounded-full font-bold text-[10px] uppercase animate-pulse">
                Live Feed
              </span>
            </div>

            {loading && (!surveillanceMetrics || !surveillanceMetrics.alert_history) ? (
              <LoadingSkeleton count={2} height="180px" />
            ) : (!surveillanceMetrics || !surveillanceMetrics.alert_history || surveillanceMetrics.alert_history.length === 0) ? (
              <div className="bg-white border rounded-xl p-8 text-center shadow-sm">
                <FiCheckCircle className="text-green-500 text-4xl mx-auto mb-2" />
                <h3 className="font-bold text-gray-700">NO ACTIVE SURVEILLANCE RISK ALERTS</h3>
                <p className="text-xs text-gray-500 mt-1">
                  All PHC risk profiles are currently within normal baseline tolerances.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {surveillanceMetrics.alert_history.map((alert) => {
                  const isCritical = alert.severity === 'CRITICAL';
                  const severityColor = getSeverityColor(alert.severity);

                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row justify-between relative"
                      style={{ borderLeftWidth: '6px', borderLeftColor: severityColor }}
                    >
                      {isCritical && (
                        <div className="absolute top-0 right-0 w-2 h-2 m-4 rounded-full bg-red-500 animate-ping"></div>
                      )}
                      <div className="p-5 flex-1 space-y-3">
                        {/* Alert Header */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: severityColor + '15', color: severityColor }}
                          >
                            {alert.severity} ALERT
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">
                            {alert.phc_id} — {alert.phc_name}
                          </span>
                        </div>

                        {/* Alert Title & Body */}
                        <div>
                          <h3 className="text-base font-bold text-slate-800">
                            {isCritical ? 'Critical disease-risk increase detected.' : 'Elevated disease-risk detected.'}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Surveillance metrics indicate outliers in patient lab reports and symptom tracking.
                          </p>
                        </div>

                        {/* Risk Score & Dominant Disease Stats */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center max-w-md text-[11px] font-bold text-slate-700">
                          <div>
                            <span className="text-[9px] text-gray-400 block uppercase">Risk Score</span>
                            <span className="text-xs text-slate-800">{alert.risk_score} / 100</span>
                          </div>
                          <div className="border-x border-slate-200">
                            <span className="text-[9px] text-gray-400 block uppercase">Primary Disease</span>
                            <span className="text-xs text-slate-800">{alert.primary_disease}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 block uppercase">Nearby PHCs</span>
                            <span className="text-xs text-slate-800">
                              {alert.nearby_phcs && alert.nearby_phcs.length > 0
                                ? alert.nearby_phcs.map(n => n.phc_id).join(', ')
                                : 'None'}
                            </span>
                          </div>
                        </div>

                        {/* Notifications Section */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Recipient Notifications</span>
                          {alert.notifications && alert.notifications.length > 0 ? (
                            <div className="space-y-1 text-xs">
                              {alert.notifications.map((notif) => {
                                const key = `${alert.id}_${notif.recipient_phc_id}`;
                                const isSending = notifyLoading[key];

                                let colorClass = 'text-gray-500 bg-gray-50';
                                if (notif.status === 'SENT') colorClass = 'text-green-700 bg-green-50 border-green-200';
                                else if (notif.status === 'FAILED') colorClass = 'text-red-700 bg-red-50 border-red-200';
                                else if (notif.status === 'PENDING') colorClass = 'text-amber-700 bg-amber-50 border-amber-200';

                                return (
                                  <div key={notif.recipient_phc_id} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                    <span className="font-semibold text-slate-650">
                                      {notif.recipient_phc_name} ({notif.recipient_email})
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${colorClass}`}>
                                        {isSending ? 'Sending...' : notif.status_text}
                                      </span>
                                      {notif.status !== 'SENT' && (
                                        <button
                                          disabled={isSending}
                                          onClick={() => handleNotifyPhc(alert.id, notif.recipient_phc_id)}
                                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs disabled:bg-gray-300 cursor-pointer"
                                          title={`Manually send email alert to ${notif.recipient_phc_name}`}
                                        >
                                          <FiSend className="text-[10px]" />
                                          Send Alert
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic block">No nearby PHCs within notification range.</span>
                          )}
                        </div>

                        {/* Time */}
                        <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                          <FiClock /> Detected: {formatAlertDate(alert.created_at)}
                        </div>
                      </div>

                      {/* Actions sidebar */}
                      <div className="bg-slate-50/50 p-5 border-t md:border-t-0 md:border-l flex flex-row md:flex-col justify-end md:justify-center gap-3">
                        <button
                          onClick={() => {
                            const foundPhc = surveillanceMetrics.phcs.find(p => p.phc_id === alert.phc_id);
                            if (foundPhc) {
                              setSelectedPhcOnMap(foundPhc);
                            }
                          }}
                          className="px-4 py-2 bg-white border border-gray-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition shadow-sm whitespace-nowrap uppercase tracking-wider"
                        >
                          View On Map
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Next Actions Side Panel */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-xl font-bold text-gray-800">NEXT ACTIONS</h2>
              <p className="text-xs text-gray-500">What requires attention now?</p>
            </div>

            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FiAlertTriangle className="text-xl" style={{ color: getSeverityColor(nextAction.severity) }} />
                <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">
                  {nextAction.title}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {nextAction.text}
              </p>

              {activeAlertsCount > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500">Active Tasks:</p>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      Investigate {criticalCount} critical disease alarms.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      Review {highPriorityCount} high priority updates.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                      Contact affected PHCs to audit patient vital signs.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk Distribution Heatmap */}
        {surveillanceMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <PremiumCard
              title="REAL-TIME GEOGRAPHIC PHC SURVEILLANCE MAP"
              subtitle="Visualizes real-time primary health center risk levels and active disease alerts on a geographical layout."
              variant="light"
            >
              <GeographicSurveillanceMap
                phcs={surveillanceMetrics.phcs || []}
                alertHistory={surveillanceMetrics.alert_history || []}
                onNotifyPhc={handleNotifyPhc}
                notifyLoading={notifyLoading}
                selectedPhcProp={selectedPhcOnMap}
              />
            </PremiumCard>
          </motion.div>
        )}

        {/* Trend Chart / Empty State */}
        {surveillanceMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <PremiumCard
              title="SURVEILLANCE ALERT TREND"
              subtitle="30-day historical progression of health surveillance metrics"
              variant="light"
            >
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={surveillanceMetrics.outbreak_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={medicalTheme.colors.primary + '20'} />
                    <XAxis dataKey="date" stroke={medicalTheme.colors.text.secondary} />
                    <YAxis stroke={medicalTheme.colors.text.secondary} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: `1px solid ${medicalTheme.colors.primary}40`,
                        borderRadius: '0.75rem'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="alert_count"
                      stroke={medicalTheme.colors.primary}
                      name="Total Alerts"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="high_severity"
                      stroke={medicalTheme.colors.accent}
                      name="High Severity"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="critical_severity"
                      stroke={medicalTheme.colors.danger}
                      name="Critical"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 border border-dashed rounded-xl">
                  <FiBarChart2 className="text-gray-400 text-5xl mb-2" />
                  <h4 className="font-bold text-gray-700 text-sm">INSUFFICIENT HISTORICAL DATA</h4>
                  <p className="text-xs text-gray-500 max-w-sm mt-1">
                    More surveillance records are required to display a meaningful 30-day trend.
                  </p>
                </div>
              )}
            </PremiumCard>
          </motion.div>
        )}

        {/* Alert History Section */}
        <div className="mb-8">
          <div className="border-b pb-2 mb-4">
            <h2 className="text-xl font-bold text-gray-800">ALERT HISTORY</h2>
            <p className="text-xs text-gray-500">Historical archive of resolved and acknowledged notifications</p>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500">
                <thead className="bg-gray-50 text-xs text-gray-700 uppercase font-black border-b">
                  <tr>
                    <th className="px-6 py-3">Detected Time</th>
                    <th className="px-6 py-3">Disease</th>
                    <th className="px-6 py-3">PHC / Node</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {healthAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-xs text-gray-400">
                        No historical alerts found.
                      </td>
                    </tr>
                  ) : (
                    healthAlerts.map((alert) => (
                      <tr key={alert.id} className="border-b hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          {formatAlertDate(alert.created_at)}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {alert.disease}
                        </td>
                        <td className="px-6 py-4">
                          {alert.source_phc || alert.target_phc} ({phcToCity(alert.source_phc || alert.target_phc)})
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              background: getSeverityColor(alert.severity) + '15',
                              color: getSeverityColor(alert.severity)
                            }}
                          >
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {alert.status}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Alert Details Modal popup */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border"
          >
            <div className="flex justify-between items-center bg-gray-50 p-4 border-b">
              <h3 className="font-black text-gray-900 text-sm">ALERT DETAILS</h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs uppercase block">Disease</span>
                  <span className="font-bold text-gray-900">{selectedAlert.disease}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase block">Severity</span>
                  <span
                    className="font-black text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: getSeverityColor(selectedAlert.severity) + '15',
                      color: getSeverityColor(selectedAlert.severity)
                    }}
                  >
                    {selectedAlert.severity}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase block">Affected PHC</span>
                  <span className="font-bold text-gray-900">
                    {selectedAlert.source_phc || selectedAlert.target_phc}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase block">City</span>
                  <span className="font-bold text-gray-900">
                    {phcToCity(selectedAlert.source_phc || selectedAlert.target_phc)}
                  </span>
                </div>
              </div>

              {selectedAlert.alert_type !== 'DISTRICT_ADVISORY' && selectedAlert.current_incidence !== null && (
                <div className="border-y py-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Current Incidence</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {selectedAlert.current_incidence.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Historical Baseline</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {selectedAlert.baseline_incidence?.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Change</span>
                    <span className="font-black text-red-600 text-sm">
                      +{selectedAlert.change_percentage?.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between border-b pb-1">
                  <span>Surveillance period:</span>
                  <span className="font-bold">Last 14 days</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Comparison period:</span>
                  <span className="font-bold">Days 15–90</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Detected:</span>
                  <span className="font-bold">{formatAlertDate(selectedAlert.created_at)}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Detection method:</span>
                  <span className="font-bold">
                    {selectedAlert.detection_method === 'automatic' ? 'Automated surveillance' : 'Manual advisory'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-xs uppercase block mb-1">Potentially affected nearby PHCs</span>
                <div className="flex gap-2 flex-wrap">
                  {(NEARBY_PHCS[selectedAlert.source_phc || selectedAlert.target_phc] || []).map((phc) => (
                    <span key={phc} className="px-2.5 py-1 bg-yellow-50 text-yellow-800 font-semibold rounded-lg text-xs border border-yellow-200">
                      {phc} ({phcToCity(phc)})
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-xs uppercase block mb-1">Alert Message</span>
                <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 whitespace-pre-wrap border font-mono">
                  {selectedAlert.message}
                </div>
              </div>

              {selectedAlert.recommended_action && (
                <div>
                  <span className="text-gray-500 text-xs uppercase block mb-1">Recommended Action</span>
                  <div className="bg-blue-50/50 p-3 border border-blue-150 rounded-lg text-xs text-blue-900 leading-relaxed font-medium">
                    {selectedAlert.recommended_action}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close
              </button>
              {selectedAlert.status === 'NEW' && (
                <button
                  onClick={() => handleAcknowledge(selectedAlert.id)}
                  className="px-4 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                  style={{ background: medicalTheme.colors.success }}
                >
                  Acknowledge Alert
                </button>
              )}
              {selectedAlert.status === 'ACKNOWLEDGED' && (
                <button
                  onClick={() => handleResolve(selectedAlert.id)}
                  className="px-4 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm bg-blue-600"
                >
                  Resolve Alert
                </button>
              )}
              {selectedAlert.status === 'RESOLVED' && (
                <span className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
                  <FiCheckCircle /> Resolved
                </span>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Direct Alert Dispatch Modal (e.g. For PHC_3) */}
      {showDirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100"
          >
            <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FiSend className="text-xl" />
                <h3 className="font-bold text-lg">Dispatch Direct Alert Email</h3>
              </div>
              <button
                onClick={() => setShowDirectModal(false)}
                className="text-white/80 hover:text-white transition cursor-pointer"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleDirectDispatch} className="p-6 space-y-4">
              {directFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                    directFeedback.type === 'success'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {directFeedback.type === 'success' ? (
                    <FiCheckCircle className="text-base shrink-0 text-green-600 mt-0.5" />
                  ) : (
                    <FiAlertCircle className="text-base shrink-0 text-red-600 mt-0.5" />
                  )}
                  <span>{directFeedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Target PHC (Recipient)
                  </label>
                  <select
                    value={directForm.target_phc_id}
                    onChange={(e) => setDirectForm({ ...directForm, target_phc_id: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="PHC_5">PHC_5 - Kuniamuthur (phc.5fed@gmail.com)</option>
                    <option value="PHC_4">PHC_4 - Vellalore (phc.4fed@gmail.com)</option>
                    <option value="PHC_3">PHC_3 - Z. Puravipalayam (phc.3fed@gmail.com)</option>
                    <option value="PHC_2">PHC_2 - S.M.C. Palayam (phc.2fed@gmail.com)</option>
                    <option value="PHC_1">PHC_1 - Narasipuram (phc.1fed@gmail.com)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Source PHC (Outbreak)
                  </label>
                  <select
                    value={directForm.source_phc_id}
                    onChange={(e) => setDirectForm({ ...directForm, source_phc_id: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="PHC_4">PHC_4 - Vellalore</option>
                    <option value="PHC_3">PHC_3 - Z. Puravipalayam</option>
                    <option value="PHC_2">PHC_2 - S.M.C. Palayam</option>
                    <option value="PHC_1">PHC_1 - Narasipuram</option>
                    <option value="PHC_5">PHC_5 - Kuniamuthur</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Disease
                  </label>
                  <select
                    value={directForm.disease}
                    onChange={(e) => setDirectForm({ ...directForm, disease: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="Dengue">Dengue</option>
                    <option value="Viral Fever">Viral Fever</option>
                    <option value="Typhoid">Typhoid</option>
                    <option value="Cholera">Cholera</option>
                    <option value="Influenza">Influenza</option>
                    <option value="Tuberculosis">Tuberculosis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Severity
                  </label>
                  <select
                    value={directForm.severity}
                    onChange={(e) => setDirectForm({ ...directForm, severity: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Risk Score
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    value={directForm.risk_score}
                    onChange={(e) => setDirectForm({ ...directForm, risk_score: e.target.value })}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Surveillance Instructions / Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="Optional custom clinical instructions for the target health center..."
                  value={directForm.message}
                  onChange={(e) => setDirectForm({ ...directForm, message: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block mb-0.5">Recipients:</span>
                This will deliver an official disease surveillance alert email directly to{' '}
                <strong className="text-indigo-700 font-bold">
                  {directForm.target_phc_id === 'PHC_5'
                    ? 'phc.5fed@gmail.com (PHC_5 - Kuniamuthur)'
                    : directForm.target_phc_id === 'PHC_3'
                    ? 'phc.3fed@gmail.com (PHC_3 - Z. Puravipalayam)'
                    : directForm.target_phc_id === 'PHC_4'
                    ? 'phc.4fed@gmail.com (PHC_4 - Vellalore)'
                    : directForm.target_phc_id === 'PHC_1'
                    ? 'phc.1fed@gmail.com (PHC_1 - Narasipuram)'
                    : 'phc.2fed@gmail.com (PHC_2 - S.M.C. Palayam)'}
                </strong>.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={directSending}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:bg-gray-300 cursor-pointer"
                >
                  <FiSend className="text-xs" />
                  {directSending ? 'Sending Alert Email...' : `Send Email to ${directForm.target_phc_id}`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}

