import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { dashboardAPI, surveillanceAPI, phcAPI } from '../api';
import PHCReliabilityIndex from '../components/PHCReliabilityIndex';
import NonIIDAnalysisPanel from '../components/NonIIDAnalysisPanel';
import KPICard from '../components/KPICard';
import PremiumCard from '../components/PremiumCard';
import { LoadingSkeleton, EmptyState } from '../components/LoadingStates';
import { FiTrendingUp, FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiShield, FiSliders, FiCpu, FiActivity, FiMail, FiPlay, FiSettings, FiEdit } from 'react-icons/fi';
import { medicalTheme, getSeverityColor } from '../components/MedicalTheme';

export default function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const [districtMetrics, setDistrictMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [isAdvisoryModalOpen, setIsAdvisoryModalOpen] = useState(false);
  const [advisoryForm, setAdvisoryForm] = useState({
    disease: '',
    severity: 'MEDIUM',
    target_phcs: [],
    message: '',
    recommended_action: ''
  });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [triggeringDetection, setTriggeringDetection] = useState(false);

  const [phcs, setPhcs] = useState([]);
  const [editingPhc, setEditingPhc] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    phc_name: '',
    city: '',
    district: '',
    latitude: '',
    longitude: '',
    email: ''
  });
  const [configError, setConfigError] = useState(null);
  const [submittingConfig, setSubmittingConfig] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [districtRes, alertsRes, phcListRes] = await Promise.all([
        dashboardAPI.getDistrictMetrics(),
        surveillanceAPI.getDistrictAlerts(),
        phcAPI.getPHCList()
      ]);
      setDistrictMetrics(districtRes.data);
      setAlerts(alertsRes.data.alerts || []);
      setPhcs(phcListRes.data.phcs || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  const handleOpenConfig = (phc) => {
    setEditingPhc(phc);
    setConfigForm({
      phc_name: phc.phc_name || '',
      city: phc.city || '',
      district: phc.district || '',
      latitude: phc.latitude !== null && phc.latitude !== undefined ? phc.latitude : '',
      longitude: phc.longitude !== null && phc.longitude !== undefined ? phc.longitude : '',
      email: phc.email || ''
    });
    setConfigError(null);
    setIsConfigModalOpen(true);
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    setConfigError(null);
    setSubmittingConfig(true);
    
    const lat = configForm.latitude === '' ? null : parseFloat(configForm.latitude);
    const lon = configForm.longitude === '' ? null : parseFloat(configForm.longitude);
    
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      setConfigError('Latitude must be a valid number between -90 and 90.');
      setSubmittingConfig(false);
      return;
    }
    
    if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) {
      setConfigError('Longitude must be a valid number between -180 and 180.');
      setSubmittingConfig(false);
      return;
    }
    
    if (configForm.email !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(configForm.email)) {
        setConfigError('Please enter a valid email address.');
        setSubmittingConfig(false);
        return;
      }
    }
    
    try {
      await phcAPI.updatePHC(editingPhc.phc_id, {
        phc_name: configForm.phc_name,
        city: configForm.city,
        district: configForm.district,
        latitude: lat,
        longitude: lon,
        email: configForm.email
      });
      setIsConfigModalOpen(false);
      await loadDashboard();
    } catch (err) {
      console.error('Error updating PHC settings:', err);
      const errMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to update PHC settings.';
      setConfigError(errMsg);
    } finally {
      setSubmittingConfig(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadDashboard();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getDistrictRiskSeverity = (score) => {
    if (score < 25.0) return 'LOW';
    if (score < 50.0) return 'MEDIUM';
    if (score < 75.0) return 'HIGH';
    return 'CRITICAL';
  };

  const getSeverityColorClass = (severity) => {
    const colors = {
      'CRITICAL': 'text-red-700 bg-red-50 border-red-200',
      'HIGH': 'text-orange-700 bg-orange-50 border-orange-200',
      'MEDIUM': 'text-yellow-700 bg-yellow-50 border-yellow-200',
      'LOW': 'text-green-700 bg-green-50 border-green-200',
      'UNKNOWN': 'text-gray-700 bg-gray-50 border-gray-200'
    };
    return colors[severity] || colors['UNKNOWN'];
  };

  // Sort breakdown alphabetically (PHC_1 to PHC_5)
  const sortedPHCs = districtMetrics?.phc_breakdown
    ? [...districtMetrics.phc_breakdown].sort((a, b) => a.phc_id.localeCompare(b.phc_id))
    : [];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FFFBF0 0%, #F8FAFC 50%, #FFFBF0 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold gradient-text-federation mb-2">
                District Strategic Dashboard
              </h1>
              <p className="text-gray-600 text-lg">Welcome {user.username} — Federated Model Oversight</p>
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: medicalTheme.colors.primary }}></span>
                Last updated: {lastUpdated.toLocaleTimeString()}
                {autoRefresh && ' (Auto-refresh ON)'}
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="btn-premium flex items-center gap-2"
                style={{
                  background: autoRefresh
                    ? medicalTheme.colors.gradients.success_gradient
                    : 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)',
                  color: 'white'
                }}
              >
                <FiRefreshCw />
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadDashboard}
                className="btn-premium flex items-center gap-2"
                style={{
                  background: medicalTheme.colors.gradients.primary_gradient,
                  color: 'white'
                }}
              >
                <FiRefreshCw />
                Refresh Now
              </motion.button>
            </div>
          </div>
        </motion.div>

        {loading && !districtMetrics ? (
          <LoadingSkeleton count={4} height="180px" />
        ) : districtMetrics ? (
          <div className="space-y-10">
            
            {/* 1. FEDERATED NETWORK OVERVIEW */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiShield className="text-blue-500" />
                1. Federated Network Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                  title="Global Model Version"
                  value={districtMetrics.global_model.version ? `v${districtMetrics.global_model.version}` : 'N/A'}
                  subtitle={districtMetrics.global_model.version ? `Round ${districtMetrics.global_model.aggregation_round}` : 'Aggregation not active'}
                  icon={FiTrendingUp}
                  gradient={medicalTheme.colors.gradients.federation_gradient}
                />

                <KPICard
                  title="Global Accuracy"
                  value={districtMetrics.global_model.version ? `${(districtMetrics.global_model.accuracy * 100).toFixed(2)}%` : 'N/A'}
                  subtitle="Federated Model"
                  icon={FiCheckCircle}
                  gradient={medicalTheme.colors.gradients.success_gradient}
                />

                <KPICard
                  title="Contributing PHCs"
                  value={districtMetrics.global_model.version ? `${districtMetrics.global_model.total_contributors}/${districtMetrics.phc_breakdown?.length || 5}` : '0/5'}
                  subtitle="PHCs in Aggregation"
                  icon={FiCheckCircle}
                  gradient={medicalTheme.colors.gradients.primary_gradient}
                />

                <KPICard
                  title="District Risk"
                  value={`${(districtMetrics?.average_phc_risk_score || 0).toFixed(2)} / 100`}
                  subtitle={`Severity: ${getDistrictRiskSeverity(districtMetrics?.average_phc_risk_score || 0)}`}
                  icon={FiAlertTriangle}
                  gradient={medicalTheme.colors.gradients.alert_gradient}
                  isPulsing={districtMetrics?.average_phc_risk_score > 50.0}
                />
              </div>
            </section>

            {/* 2. FEDERATED ROUND STATUS */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiSliders className="text-blue-500" />
                2. Federated Round Status
              </h2>
              {districtMetrics.latest_round ? (
                <PremiumCard 
                  title={`Federated Round #${districtMetrics.latest_round.round_id} Status`}
                  subtitle={`Started: ${new Date(districtMetrics.latest_round.created_at).toLocaleString()}`}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5'].map(phcId => {
                        const received = districtMetrics.latest_round.updates_received[phcId] === 'received';
                        const isParticipant = districtMetrics.latest_round.participants.includes(phcId);
                        return (
                          <div 
                            key={phcId} 
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${
                              received 
                                ? 'border-green-200 bg-green-50/50 text-green-800' 
                                : isParticipant
                                  ? 'border-blue-200 bg-blue-50/50 text-blue-800 animate-pulse'
                                  : 'border-gray-200 bg-gray-50/50 text-gray-400'
                            }`}
                          >
                            <span className="text-xs font-bold">{phcId}</span>
                            <span className="text-[10px] mt-1 font-semibold uppercase tracking-wider">
                              {received ? 'Update Received' : isParticipant ? 'Training...' : 'Inactive'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-3 border-t border-gray-150 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-gray-600">
                      <div>
                        <span>Local Client Submissions: </span>
                        <span className="font-bold text-gray-800">
                          {Object.keys(districtMetrics.latest_round.updates_received).length} / {districtMetrics.latest_round.participants.length} updates
                        </span>
                      </div>
                      <div>
                        <span>FedAvg Aggregation: </span>
                        <span className={`font-bold ${
                          districtMetrics.latest_round.status === 'COMPLETED' 
                            ? 'text-green-600' 
                            : 'text-amber-500'
                        }`}>
                          {districtMetrics.latest_round.status === 'COMPLETED' ? 'Completed' : 'IN PROGRESS'}
                        </span>
                      </div>
                      <div>
                        <span>Global Model: </span>
                        <span className={`font-bold ${
                          districtMetrics.latest_round.global_model_version 
                            ? 'text-indigo-600' 
                            : 'text-gray-400'
                        }`}>
                          {districtMetrics.latest_round.global_model_version ? `global_v${districtMetrics.latest_round.global_model_version} Created` : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              ) : (
                <div className="p-6 bg-white border rounded-2xl text-center text-gray-500">
                  No active federated learning rounds recorded in the system.
                </div>
              )}
            </section>

            {/* 3. GLOBAL MODEL PERFORMANCE */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiCpu className="text-blue-500" />
                3. Global Model Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PremiumCard title="Metadata" subtitle="Version & Training context">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Global Version:</span>
                      <span className="font-bold text-gray-800">{districtMetrics.global_model.version_string || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Federated Round:</span>
                      <span className="font-bold text-gray-800">Round #{districtMetrics.global_model.aggregation_round}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contributors:</span>
                      <span className="font-bold text-gray-800">{districtMetrics.global_model.total_contributors} PHC nodes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Evaluation Type:</span>
                      <span className="font-bold text-blue-600">District Validation Dataset</span>
                    </div>
                  </div>
                </PremiumCard>

                <PremiumCard title="Classification Metrics" subtitle="Generalization metrics on district validation dataset">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Accuracy Score:</span>
                      <span className="font-bold text-green-600">{(districtMetrics.global_model.accuracy * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Precision:</span>
                      <span className="font-bold text-gray-800">{(districtMetrics.global_model.precision * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Recall:</span>
                      <span className="font-bold text-gray-800">{(districtMetrics.global_model.recall * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">F1 Score:</span>
                      <span className="font-bold text-gray-800">{(districtMetrics.global_model.f1_score * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </PremiumCard>

                <PremiumCard title="Aggregation Parameters" subtitle="Aggregated client attributes">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total training samples:</span>
                      <span className="font-bold text-gray-800">
                        {districtMetrics.phc_breakdown?.reduce((sum, item) => sum + item.patients, 0) || 0} patients
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Aggregation Algorithm:</span>
                      <span className="font-bold text-indigo-600">Weighted FedAvg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Weights Method:</span>
                      <span className="font-bold text-gray-800">Sample Count (n_k / N)</span>
                    </div>
                  </div>
                </PremiumCard>
              </div>
            </section>

            {/* 4. LOCAL VS GLOBAL PERFORMANCE */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiTrendingUp className="text-blue-500" />
                4. Local vs Global Performance
              </h2>
              <PremiumCard 
                title="Performance Gap Comparison" 
                subtitle="Calculates performance gap (Local Accuracy - Global Accuracy) in percentage points"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b font-bold text-gray-800 bg-gray-50">
                        <th className="px-4 py-3 text-left">PHC ID</th>
                        <th className="px-4 py-3 text-center">Local Model Accuracy</th>
                        <th className="px-4 py-3 text-center">Global Model Accuracy</th>
                        <th className="px-4 py-3 text-center">Performance Gap</th>
                        <th className="px-4 py-3 text-left">Generalization Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPHCs.map((phc) => {
                        const localAcc = phc.local_model_accuracy * 100;
                        const globalAcc = districtMetrics.global_model.accuracy * 100;
                        const gap = localAcc - globalAcc;
                        const severity = gap > 20 ? 'Critical Gap' : gap > 10 ? 'High Gap' : 'Stable';
                        const colorClass = gap > 20 ? 'text-red-600 font-bold' : gap > 10 ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold';
                        
                        return (
                          <tr key={phc.phc_id} className="border-b hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-semibold text-gray-900">{phc.phc_id}</td>
                            <td className="px-4 py-3 text-center">{localAcc.toFixed(2)}%</td>
                            <td className="px-4 py-3 text-center">{globalAcc.toFixed(2)}%</td>
                            <td className={`px-4 py-3 text-center font-bold`}>
                              {gap >= 0 ? `+${gap.toFixed(2)} pp` : `${gap.toFixed(2)} pp`}
                            </td>
                            <td className={`px-4 py-3 text-left ${colorClass}`}>
                              {severity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PremiumCard>
            </section>

            {/* 5. PHC HEALTH RISK */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiShield className="text-blue-500" />
                5. PHC Health Risk Index
              </h2>
              <PHCReliabilityIndex phcBreakdown={districtMetrics.phc_breakdown || []} />
            </section>

            {/* 6. NON-IID / HETEROGENEITY ANALYSIS & 7. DATA QUALITY / IMBALANCE */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiActivity className="text-blue-500" />
                6 & 7. Non-IID Skewness & Data Quality Auditing
              </h2>
              <NonIIDAnalysisPanel />
            </section>

            {/* 8. HIGH-RISK PHCs */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                <FiAlertTriangle className="text-blue-500" />
                8. High-Risk PHCs Alert Feed
              </h2>
              {districtMetrics.high_risk_phcs && districtMetrics.high_risk_phcs.length > 0 ? (
                <PremiumCard
                  title="Active High-Risk Warnings"
                  subtitle={`${districtMetrics.high_risk_phcs.length} PHCs exceed high-risk severity thresholds`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {districtMetrics.high_risk_phcs.map(phc => (
                      <div
                        key={phc.phc_id}
                        className={`${getSeverityColorClass(phc.severity)} rounded-xl p-4 border border-l-4`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-lg">{phc.phc_id}</p>
                            <p className="text-sm opacity-90">Health Risk: {phc.risk_score.toFixed(1)} / 100</p>
                          </div>
                          <span className="font-bold px-3 py-1 rounded-full text-xs bg-white border border-red-200">
                            {phc.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {districtMetrics.high_risk_phcs.length === districtMetrics.phc_breakdown?.length && (
                    <div className="mt-4 p-3 bg-red-50 text-red-800 text-xs font-semibold rounded-lg border border-red-200 text-center">
                      All participating PHCs currently exceed the configured high-risk threshold.
                    </div>
                  )}
                </PremiumCard>
              ) : (
                <div className="p-6 bg-white border rounded-2xl text-center text-gray-500 flex flex-col items-center justify-center">
                  <FiCheckCircle className="text-green-500 text-4xl mb-2" />
                  <p className="font-semibold">All nodes reporting within safe margins</p>
                  <p className="text-xs text-gray-400">No PHCs exceed the high-risk alert threshold.</p>
                </div>
              )}
            </section>

            {/* 9. DISTRICT SURVEILLANCE ALERTS & HEALTH ADVISORY CENTER */}
            <section className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FiAlertTriangle className="text-blue-500" />
                  9. District Surveillance Alerts & Health Advisory Center
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setTriggeringDetection(true);
                      try {
                        await surveillanceAPI.triggerDetection();
                        await loadDashboard();
                      } catch (err) {
                        console.error("Error triggering detection:", err);
                      }
                      setTriggeringDetection(false);
                    }}
                    disabled={triggeringDetection}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <FiPlay />
                    {triggeringDetection ? "Running..." : "Run Outbreak Assessment"}
                  </button>
                  <button
                    onClick={() => {
                      setAdvisoryForm({
                        disease: '',
                        severity: 'MEDIUM',
                        target_phcs: [],
                        message: '',
                        recommended_action: ''
                      });
                      setIsAdvisoryModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition"
                  >
                    <FiMail />
                    Send Health Advisory
                  </button>
                </div>
              </div>

              <PremiumCard
                title="District Surveillance Alert Log"
                subtitle="View active outbreaks and resolved historical events"
              >
                {alerts.length === 0 ? (
                  <p className="text-center py-8 text-xs text-gray-400 font-medium">
                    No alerts or advisories have been recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50/50">
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Disease / Topic</th>
                          <th className="px-4 py-3">Source PHC</th>
                          <th className="px-4 py-3">Recipient PHC</th>
                          <th className="px-4 py-3">Severity</th>
                          <th className="px-4 py-3">Details</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created At</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {alerts.map((alert) => (
                          <tr key={alert.id} className="hover:bg-gray-50/30">
                            <td className="px-4 py-3 font-semibold text-gray-700">
                              {alert.alert_type === 'DISTRICT_ADVISORY' ? 'Advisory' : 'Surveillance'}
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-800">
                              {alert.disease}
                            </td>
                            <td className="px-4 py-3 text-gray-550 font-medium">
                              {alert.source_phc || 'District Admin'}
                            </td>
                            <td className="px-4 py-3 text-gray-550 font-medium">
                              {alert.target_phc}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                alert.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {alert.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-550">
                              {alert.alert_type === 'DISTRICT_ADVISORY' ? 'Manual message' : `Incidence ${alert.current_incidence}% vs ${alert.baseline_incidence}% (+${alert.change_percentage}%)`}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                alert.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                alert.status === 'ACKNOWLEDGED' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-gray-100 text-gray-650'
                              }`}>
                                {alert.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {new Date(alert.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => setSelectedAlert(alert)}
                                className="px-2.5 py-1 text-sky-700 hover:bg-sky-50 rounded font-semibold transition"
                              >
                                View
                              </button>
                              {alert.status !== 'RESOLVED' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await surveillanceAPI.resolveAlert(alert.id);
                                      await loadDashboard();
                                    } catch (err) {
                                      console.error("Error resolving alert:", err);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded font-semibold transition"
                                >
                                  Resolve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </PremiumCard>
            </section>

            {/* 10. PRIMARY HEALTH CENTER CONFIGURATION & GEOGRAPHIC SURVEILLANCE */}
            <section className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FiSettings className="text-blue-500" />
                  10. Primary Health Center Configuration & Geographic Settings
                </h2>
              </div>

              <PremiumCard
                title="Geographic and Contact Settings"
                subtitle="Configure geographic coordinates and contact details for the notification pipeline"
              >
                {phcs.length === 0 ? (
                  <p className="text-center py-8 text-xs text-gray-400 font-medium">
                    No registered Primary Health Centers discovered.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50/50">
                          <th className="px-4 py-3">PHC ID</th>
                          <th className="px-4 py-3">Official Name</th>
                          <th className="px-4 py-3">City</th>
                          <th className="px-4 py-3">District</th>
                          <th className="px-4 py-3 text-center">Latitude</th>
                          <th className="px-4 py-3 text-center">Longitude</th>
                          <th className="px-4 py-3">Official Contact Email</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {phcs.map((phc) => (
                          <tr key={phc.phc_id} className="hover:bg-gray-50/30">
                            <td className="px-4 py-3 font-bold text-gray-800">
                              {phc.phc_id}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-700">
                              {phc.phc_name || <span className="text-gray-400 italic">Not configured</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-650 font-medium">
                              {phc.city}
                            </td>
                            <td className="px-4 py-3 text-gray-650 font-medium">
                              {phc.district}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 font-mono">
                              {phc.latitude !== null && phc.latitude !== undefined ? phc.latitude.toFixed(5) : <span className="text-gray-450 italic">None</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 font-mono">
                              {phc.longitude !== null && phc.longitude !== undefined ? phc.longitude.toFixed(5) : <span className="text-gray-450 italic">None</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-semibold break-all">
                              {phc.email || <span className="text-gray-450 italic">Not configured</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleOpenConfig(phc)}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold transition flex items-center gap-1.5 ml-auto text-[10px]"
                              >
                                <FiEdit /> Configure
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </PremiumCard>
            </section>

          </div>
        ) : (
          <EmptyState title="District Dashboard metrics unavailable" subtitle="No data has been generated yet." />
        )}
      </div>

      {/* Manual Health Advisory Send Modal */}
      {isAdvisoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative">
            <h3 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-wider">
              Send District Health Advisory
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!advisoryForm.disease || !advisoryForm.message || advisoryForm.target_phcs.length === 0) {
                alert("Please fill in disease, message and select at least one target PHC.");
                return;
              }
              try {
                await surveillanceAPI.sendAdvisory(advisoryForm);
                setIsAdvisoryModalOpen(false);
                await loadDashboard();
              } catch (err) {
                console.error("Error sending advisory:", err);
                alert("Failed to send advisory.");
              }
            }} className="space-y-4 text-xs font-semibold text-slate-700">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Topic / Disease</label>
                  <input
                    type="text"
                    value={advisoryForm.disease}
                    onChange={(e) => setAdvisoryForm({ ...advisoryForm, disease: e.target.value })}
                    placeholder="e.g. Dengue Surveillance"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Severity</label>
                  <select
                    value={advisoryForm.severity}
                    onChange={(e) => setAdvisoryForm({ ...advisoryForm, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase">Target PHCs</label>
                <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-xl">
                  {['PHC_1', 'PHC_2', 'PHC_3', 'PHC_4', 'PHC_5'].map((phc) => (
                    <label key={phc} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advisoryForm.target_phcs.includes(phc)}
                        onChange={(e) => {
                          const list = e.target.checked 
                            ? [...advisoryForm.target_phcs, phc]
                            : advisoryForm.target_phcs.filter(item => item !== phc);
                          setAdvisoryForm({ ...advisoryForm, target_phcs: list });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold">{phc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Message</label>
                <textarea
                  rows="4"
                  value={advisoryForm.message}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, message: e.target.value })}
                  placeholder="Enter message context..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Recommended Action</label>
                <input
                  type="text"
                  value={advisoryForm.recommended_action}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, recommended_action: e.target.value })}
                  placeholder="e.g. Please monitor suspected cases..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                >
                  Send Advisory
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvisoryModalOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative">
            <h3 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-wider">
              {selectedAlert.alert_type === 'DISTRICT_ADVISORY' ? 'Health Advisory' : 'Surveillance Alert'} Details
            </h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Status</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-sky-100 text-sky-800">
                    {selectedAlert.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Recipient</span>
                  <span>{selectedAlert.target_phc}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Severity</span>
                  <span>{selectedAlert.severity}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block font-bold uppercase">Created By</span>
                  <span>{selectedAlert.created_by}</span>
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
              {selectedAlert.status !== 'RESOLVED' && (
                <button
                  onClick={async () => {
                    try {
                      await surveillanceAPI.resolveAlert(selectedAlert.id);
                      setSelectedAlert(null);
                      await loadDashboard();
                    } catch (err) {
                      console.error("Error resolving alert:", err);
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-650 hover:bg-red-700 rounded-xl transition"
                >
                  Resolve Alert
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHC Geographic & Contact Configuration Modal */}
      {isConfigModalOpen && editingPhc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative">
            <h3 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wider">
              Configure {editingPhc.phc_id}
            </h3>
            <p className="text-[10px] text-gray-400 font-semibold mb-4 uppercase">
              Update administrative settings, geographic plotting parameters, and automated alerts routing.
            </p>
            
            {configError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                {configError}
              </div>
            )}
            
            <form onSubmit={handleConfigSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">PHC ID</label>
                  <input
                    type="text"
                    value={editingPhc.phc_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-100 rounded-xl outline-none text-xs bg-slate-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Official PHC Name</label>
                  <input
                    type="text"
                    value={configForm.phc_name}
                    onChange={(e) => setConfigForm({ ...configForm, phc_name: e.target.value })}
                    placeholder="e.g. Zamin Uthukuli PHC"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">City</label>
                  <input
                    type="text"
                    value={configForm.city}
                    onChange={(e) => setConfigForm({ ...configForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">District</label>
                  <input
                    type="text"
                    value={configForm.district}
                    onChange={(e) => setConfigForm({ ...configForm, district: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Latitude (-90 to 90)</label>
                  <input
                    type="number"
                    step="any"
                    value={configForm.latitude}
                    onChange={(e) => setConfigForm({ ...configForm, latitude: e.target.value })}
                    placeholder="e.g. 10.9765"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Longitude (-180 to 180)</label>
                  <input
                    type="number"
                    step="any"
                    value={configForm.longitude}
                    onChange={(e) => setConfigForm({ ...configForm, longitude: e.target.value })}
                    placeholder="e.g. 77.0012"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Official Contact Email</label>
                <input
                  type="email"
                  value={configForm.email}
                  onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                  placeholder="e.g. user@domain.gov.in"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none text-xs bg-white focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submittingConfig}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition"
                >
                  {submittingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
