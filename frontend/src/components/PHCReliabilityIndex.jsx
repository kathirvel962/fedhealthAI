import React, { useMemo } from 'react';
import { medicalTheme } from './MedicalTheme';
import { FiCheckCircle, FiAlertCircle, FiTrendingDown, FiActivity, FiShield } from 'react-icons/fi';

/**
 * PHC Reliability Index Cards
 * Shows status cards for each PHC separating Health Risk, Model Stability, and Data Heterogeneity.
 */
export default function PHCReliabilityIndex({ phcBreakdown = [] }) {
  const cards = useMemo(() => {
    // Sort PHCs alphabetically (PHC_1, PHC_2, etc.)
    return [...phcBreakdown]
      .sort((a, b) => a.phc_id.localeCompare(b.phc_id))
      .map(phc => {
        const accuracy = phc.local_model_accuracy || 0;
        const riskScore = phc.risk_score || 0;
        const patientCount = phc.patients || 0;
        const drift = phc.performance_drift || 0.0;
        const heterogeneity = phc.data_heterogeneity || 0.0;

        // Health Risk Severity Styling
        let riskColor = '#10B981'; // Green
        if (phc.severity === 'CRITICAL') riskColor = '#EF4444'; // Red
        else if (phc.severity === 'HIGH') riskColor = '#F97316'; // Orange
        else if (phc.severity === 'MEDIUM') riskColor = '#F59E0B'; // Yellow

        // Stability Label and Styling
        let stabilityStatus = 'Stable';
        let stabilityColor = 'text-green-700 bg-green-50 border-green-200';
        if (drift >= 15.0) {
          stabilityStatus = 'Volatile';
          stabilityColor = 'text-red-700 bg-red-50 border-red-200';
        } else if (drift >= 5.0) {
          stabilityStatus = 'Watch';
          stabilityColor = 'text-amber-700 bg-amber-50 border-amber-200';
        }

        // Heterogeneity Label and Styling
        let heterogeneityStatus = 'Low';
        let heterogeneityColor = 'text-green-700 bg-green-50 border-green-200';
        if (heterogeneity >= 0.15) {
          heterogeneityStatus = 'High';
          heterogeneityColor = 'text-red-700 bg-red-50 border-red-200';
        } else if (heterogeneity >= 0.05) {
          heterogeneityStatus = 'Moderate';
          heterogeneityColor = 'text-amber-700 bg-amber-50 border-amber-200';
        }

        return {
          name: phc.phc_id || 'Unknown PHC',
          accuracy: (accuracy * 100).toFixed(1),
          drift,
          heterogeneity,
          patientCount,
          riskScore,
          severity: phc.severity || 'UNKNOWN',
          riskColor,
          stabilityStatus,
          stabilityColor,
          heterogeneityStatus,
          heterogeneityColor
        };
      });
  }, [phcBreakdown]);

  if (cards.length === 0) {
    return (
      <div 
        className="rounded-xl shadow-md p-8 border text-center"
        style={{
          background: `linear-gradient(135deg, ${medicalTheme.colors.primary}08 0%, ${medicalTheme.colors.secondary}08 100%)`,
          borderColor: medicalTheme.colors.primary + '30'
        }}
      >
        <p className="text-gray-500">No PHC data available</p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-2xl shadow-sm p-6 border bg-white"
      style={{
        borderColor: medicalTheme.colors.primary + '15'
      }}
    >
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900">
        <FiShield className="text-blue-500" />
        PHC Reliability & Risk Index
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="rounded-xl border shadow-sm hover:shadow transition-shadow p-4 flex flex-col justify-between"
            style={{ 
              borderColor: card.riskColor + '30',
              background: card.riskColor + '03'
            }}
          >
            {/* Header */}
            <div>
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-bold text-gray-800 text-sm">{card.name}</h4>
                {card.severity === 'LOW' ? (
                  <FiCheckCircle size={18} className="text-green-500" />
                ) : (
                  <FiAlertCircle size={18} style={{ color: card.riskColor }} />
                )}
              </div>

              {/* Concepts Status Breakdown */}
              <div className="space-y-2 mb-4 pt-2 border-t border-gray-100">
                
                {/* 1. HEALTH RISK */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Health Risk</span>
                  <span 
                    className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border"
                    style={{
                      background: card.riskColor + '15',
                      color: card.riskColor,
                      borderColor: card.riskColor + '30'
                    }}
                  >
                    {card.severity}
                  </span>
                </div>

                {/* 2. MODEL STABILITY */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Model Stability</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${card.stabilityColor}`}>
                    {card.stabilityStatus}
                  </span>
                </div>

                {/* 3. DATA HETEROGENEITY */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Data Heterogeneity</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${card.heterogeneityColor}`}>
                    {card.heterogeneityStatus}
                  </span>
                </div>

              </div>

              {/* Exact Metrics List */}
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Accuracy:</span>
                  <span className="font-semibold text-gray-800">{card.accuracy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Drift:</span>
                  <span className="font-semibold text-gray-800">{card.drift.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">JSD Divergence:</span>
                  <span className="font-semibold text-gray-800">{card.heterogeneity.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Patients:</span>
                  <span className="font-semibold text-gray-800">{card.patientCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Risk Score:</span>
                  <span className="font-semibold text-gray-800">{card.riskScore.toFixed(1)}/100</span>
                </div>
              </div>
            </div>

            {/* Health Bar (Local Model Accuracy) */}
            <div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(parseFloat(card.accuracy), 100)}%`,
                    background: `linear-gradient(90deg, ${card.riskColor}, ${card.riskColor}90)`
                  }}
                ></div>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-150">
        <p className="text-[10px] font-bold text-gray-400 mb-3 tracking-wider uppercase">Network Overview Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
            <p className="text-xs text-gray-500">Total active nodes</p>
            <p className="text-xl font-black mt-1 text-gray-800">
              {cards.length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
            <p className="text-xs text-gray-500">At HIGH/CRITICAL health risk</p>
            <p className="text-xl font-black mt-1 text-red-600">
              {cards.filter(c => ['HIGH', 'CRITICAL'].includes(c.severity)).length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
            <p className="text-xs text-gray-500">Volatile model drift</p>
            <p className="text-xl font-black mt-1 text-orange-600">
              {cards.filter(c => c.stabilityStatus === 'Volatile').length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
            <p className="text-xs text-gray-500">High data heterogeneity</p>
            <p className="text-xl font-black mt-1 text-indigo-600">
              {cards.filter(c => c.heterogeneityStatus === 'High').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
