import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { nonIIDAPI } from '../api';
import PremiumCard from './PremiumCard';
import { medicalTheme } from './MedicalTheme';
import { FiActivity, FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function NonIIDAnalysisPanel() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nonIIDAPI.getAnalysis();
      setAnalysis(response.data);
    } catch (err) {
      console.error('Error fetching Non-IID analysis:', err);
      setError(err.response?.data?.details || 'No statistical heterogeneity analysis is currently available.');
    }
    setLoading(false);
  };

  const triggerAnalysis = async () => {
    setTriggering(true);
    setError(null);
    try {
      await nonIIDAPI.triggerAnalysis();
      await fetchAnalysis();
    } catch (err) {
      console.error('Error triggering Non-IID analysis:', err);
      setError(err.response?.data?.details || 'Failed to trigger statistical heterogeneity analysis.');
    }
    setTriggering(false);
  };

  const getHeatmapColor = (val) => {
    if (val === 0) return 'bg-green-50 text-green-700';
    if (val < 0.05) return 'bg-green-100/70 text-green-800';
    if (val < 0.15) return 'bg-yellow-100/70 text-yellow-800';
    return 'bg-red-100/70 text-red-800';
  };

  const prepareChartData = () => {
    if (!analysis?.phc_metrics) return [];
    return Object.entries(analysis.phc_metrics)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([phcId, metrics]) => {
        const dists = metrics.disease_distribution || {};
        return {
          phc: phcId,
          Dengue: parseFloat((dists.Dengue * 100).toFixed(1)),
          Healthy: parseFloat((dists.Healthy * 100).toFixed(1)),
          Malaria: parseFloat((dists.Malaria * 100).toFixed(1)),
          Pneumonia: parseFloat((dists.Pneumonia * 100).toFixed(1)),
          Typhoid: parseFloat((dists.Typhoid * 100).toFixed(1)),
          'Viral Fever': parseFloat((dists['Viral Fever'] * 100).toFixed(1)),
        };
      });
  };

  const getAverageJSD = () => {
    if (!analysis?.global_divergences) return 0;
    const vals = Object.values(analysis.global_divergences);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const avgJSD = getAverageJSD();
  const chartData = prepareChartData();

  return (
    <div className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FiActivity className="text-indigo-500" />
            Non-IID Statistical Heterogeneity Analysis
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Measures database-derived client data skewness and divergence using Jensen-Shannon Divergence (JSD)
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchAnalysis}
            disabled={loading}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold text-xs text-gray-600 flex items-center gap-2"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh stats
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={triggerAnalysis}
            disabled={triggering}
            className="px-4 py-2 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2"
            style={{ background: medicalTheme.colors.gradients.primary_gradient }}
          >
            <FiActivity className={triggering ? 'animate-pulse' : ''} />
            {triggering ? 'Analyzing DB...' : 'Re-calculate skewness'}
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm">
          <FiAlertTriangle className="text-amber-500 text-lg flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis ? (
        <div className="space-y-6">
          
          {/* Heterogeneity Report Alert */}
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row gap-4 items-start ${
            avgJSD > 0.15 
              ? 'bg-red-50/60 border-red-100 text-red-900' 
              : avgJSD > 0.05 
                ? 'bg-yellow-50/60 border-yellow-100 text-yellow-900'
                : 'bg-green-50/60 border-green-100 text-green-900'
          }`}>
            <div className="p-3 bg-white rounded-xl shadow-sm self-start">
              {avgJSD > 0.05 ? (
                <FiAlertTriangle className={`text-2xl ${avgJSD > 0.15 ? 'text-red-500' : 'text-yellow-600'}`} />
              ) : (
                <FiCheckCircle className="text-2xl text-green-600" />
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-base flex flex-wrap gap-2 items-center">
                <span>District-Wide Heterogeneity Assessment</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white border border-green-205 text-green-850">
                  Current Dataset Heterogeneity: {avgJSD > 0.15 ? 'HIGH' : avgJSD > 0.05 ? 'MODERATE' : 'LOW'}
                </span>
              </h4>
              <div className="text-xs opacity-90 leading-relaxed space-y-1">
                <div>Jensen-Shannon Divergence: <strong>{avgJSD.toFixed(4)}</strong></div>
                <div>
                  <strong>Interpretation:</strong>{' '}
                  {avgJSD > 0.15 
                    ? 'High statistical heterogeneity (Non-IID distributions) detected. Clinical symptoms vary significantly between primary health centers due to localized factors, necessitating client-weighted aggregation (FedAvg).' 
                    : avgJSD > 0.05 
                      ? 'Moderate statistical heterogeneity observed. Standard FedAvg weighted parameters aggregation is sufficient to generalize models across all locations.'
                      : 'The current PHC disease distributions are highly similar to the district distribution. The current dataset demonstrates limited Non-IID variation.'}
                </div>
              </div>
              {analysis.created_at && (
                <p className="text-[10px] opacity-75 pt-1">
                  Report Version: #{analysis.analysis_version} | Timestamp: {new Date(analysis.created_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Divergence Matrix Heatmap */}
            <div className="lg:col-span-6">
              <PremiumCard 
                title="Pairwise Jensen-Shannon Divergence (JSD)"
                subtitle="Symmetric distance matrix comparing disease distributions (0.0 = identical, 1.0 = disjoint)"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-bold text-gray-700 bg-gray-50/50">PHC</th>
                        {Object.keys(analysis.pairwise_divergences).sort().map(phcId => (
                          <th key={phcId} className="px-2 py-2 font-bold text-gray-700 bg-gray-50/50">{phcId}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analysis.pairwise_divergences).sort((a, b) => a[0].localeCompare(b[0])).map(([rowPhc, cols]) => (
                        <tr key={rowPhc} className="border-b">
                          <td className="px-3 py-2 text-left font-bold text-gray-900 bg-gray-50/20">{rowPhc}</td>
                          {Object.keys(analysis.pairwise_divergences).sort().map(colPhc => {
                            const val = cols[colPhc] ?? 0.0;
                            return (
                              <td key={colPhc} className={`px-2 py-2 font-semibold ${getHeatmapColor(val)}`}>
                                {val.toFixed(4)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumCard>
            </div>

            {/* Global Baseline Divergences */}
            <div className="lg:col-span-6">
              <PremiumCard
                title="Divergence from District Global Distribution"
                subtitle="Calculates skewness of each local PHC relative to overall population averages"
              >
                <div className="space-y-4">
                  {Object.entries(analysis.global_divergences).sort((a, b) => a[0].localeCompare(b[0])).map(([phcId, jsVal]) => (
                    <div key={phcId} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-700">{phcId}</span>
                        <span className="text-gray-600">JSD: {jsVal.toFixed(4)}</span>
                      </div>
                      <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden">
                        <div 
                          className="h-3 rounded-full"
                          style={{
                            width: `${Math.min(100, jsVal * 300)}%`,
                            background: jsVal > 0.15 
                              ? medicalTheme.colors.gradients.danger_gradient 
                              : jsVal > 0.05 
                                ? medicalTheme.colors.gradients.warning_gradient 
                                : medicalTheme.colors.gradients.success_gradient
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </div>

          </div>

          {/* Disease Class Stacked Distribution Chart */}
          <PremiumCard
            title="Disease Class Distribution Comparison"
            subtitle="Real database-derived percentage distributions of clinical labels across health centers"
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={medicalTheme.colors.primary + '20'} />
                <XAxis dataKey="phc" stroke={medicalTheme.colors.text.secondary} />
                <YAxis unit="%" domain={[0, 100]} stroke={medicalTheme.colors.text.secondary} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${medicalTheme.colors.primary}40`,
                    borderRadius: '0.75rem'
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Legend />
                <Bar dataKey="Dengue" stackId="a" fill="#3B82F6" />
                <Bar dataKey="Healthy" stackId="a" fill="#10B981" />
                <Bar dataKey="Malaria" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Pneumonia" stackId="a" fill="#EF4444" />
                <Bar dataKey="Typhoid" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="Viral Fever" stackId="a" fill="#EC4899" />
              </BarChart>
            </ResponsiveContainer>
          </PremiumCard>

          {/* Detailed Statistics Table */}
          <PremiumCard
            title="Statistical Summary & Imbalance Auditing"
            subtitle="Audits data balance entropy, samples, and continuous metrics by PHC location"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-gray-50/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-900">PHC Node</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Sample Count</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Class Balance Entropy (bits)</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Max/Min Imbalance Ratio</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Age Range (Mean ± Std)</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Gender (Male / Female %)</th>
                    <th className="px-4 py-3 font-bold text-gray-900">Missing Values</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analysis.phc_metrics).sort((a, b) => a[0].localeCompare(b[0])).map(([phcId, metrics]) => (
                    <tr key={phcId} className="border-b hover:bg-gray-50/20">
                      <td className="px-4 py-3 font-bold text-gray-900">{phcId}</td>
                      <td className="px-4 py-3 text-gray-700">{metrics.sample_count}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {metrics.class_imbalance?.entropy.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {metrics.class_imbalance?.imbalance_ratio.toFixed(2)}x
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {metrics.age_stats?.mean.toFixed(1)} ± {metrics.age_stats?.std.toFixed(1)} years
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {(metrics.gender_distribution?.Male * 100).toFixed(0)}% / {(metrics.gender_distribution?.Female * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold">
                        {metrics.missing_value_count} records
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <FiAlertTriangle className="text-gray-300 text-5xl mb-4" />
          <h4 className="font-bold text-lg text-gray-750 mb-1">Heterogeneity Analysis Unavailable</h4>
          <p className="text-xs text-gray-500 max-w-sm">
            Click the 'Re-calculate skewness' button to execute Jensen-Shannon divergence and continuous statistics calculation over the database.
          </p>
        </div>
      )}

    </div>
  );
}
