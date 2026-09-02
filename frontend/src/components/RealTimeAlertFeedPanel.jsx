import React, { useMemo, useEffect, useState } from 'react';
import { medicalTheme, getSeverityColor } from './MedicalTheme';
import { FiBell, FiAlertCircle, FiCheck, FiTrendingUp } from 'react-icons/fi';

/**
 * Real-Time Alert Feed Panel
 * Animated scrolling alert feed with severity badges
 * 
 * Data source: alerts array from surveillance API
 */
export default function RealTimeAlertFeedPanel({ alerts = [] }) {
  const [animationIndex, setAnimationIndex] = useState(0);

  // Helper functions (must be defined before useMemo)
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL': return <FiAlertCircle size={20} />;
      case 'HIGH': return <FiTrendingUp size={20} />;
      default: return <FiBell size={20} />;
    }
  };

  // Sort and prepare feed data
  const feedData = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    
    // Generate meaningful description based on alert_type and other fields
    const getAlertDescription = (alert) => {
      switch(alert.alert_type) {
        case 'FEVER_OUTBREAK':
          return `Fever detected in ${(alert.fever_percentage || 0).toFixed(1)}% of patients`;
        case 'MODEL_DRIFT':
          return `Model accuracy dropped ${(alert.accuracy_drop_percentage || 0).toFixed(1)}% (from ${(alert.previous_accuracy * 100 || 0).toFixed(1)}% to ${(alert.current_accuracy * 100 || 0).toFixed(1)}%)`;
        case 'COMPOSITE_RISK':
          return `Multiple risk factors detected - PHC Health Risk: ${alert.risk_score?.toFixed(1)} / 100`;
        case 'ANOMALY':
          return `Unusual pattern detected in patient data`;
        default:
          return alert.message || 'Alert generated';
      }
    };
    
    return alerts
      .sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0))
      .slice(0, 20) // Show last 20 alerts
      .map((alert, idx) => ({
        ...alert,
        id: `${alert._id || idx}`,
        severity: alert.severity || 'MEDIUM',
        timeAgo: getTimeAgo(alert.created_at || alert.timestamp),
        color: getSeverityColor(alert.severity || 'MEDIUM'),
        description: getAlertDescription(alert)
      }));
  }, [alerts]);

  // Auto-scroll animation
  useEffect(() => {
    if (feedData.length === 0) return;
    
    const interval = setInterval(() => {
      setAnimationIndex(prev => (prev + 1) % feedData.length);
    }, 5000); // Scroll every 5 seconds
    
    return () => clearInterval(interval);
  }, [feedData.length]);

  if (feedData.length === 0) {
    return (
      <div 
        className="rounded-xl shadow-md p-8 border text-center"
        style={{
          background: `linear-gradient(135deg, ${medicalTheme.colors.primary}08 0%, ${medicalTheme.colors.secondary}08 100%)`,
          borderColor: medicalTheme.colors.primary + '30'
        }}
      >
        <FiBell size={32} className="mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">No alerts at this time</p>
        <p className="text-xs text-gray-400 mt-1">All systems healthy</p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl shadow-md p-6 border"
      style={{
        background: `linear-gradient(135deg, ${medicalTheme.colors.primary}08 0%, ${medicalTheme.colors.secondary}08 100%)`,
        borderColor: medicalTheme.colors.primary + '30'
      }}
    >
      <h3 className="text-lg font-semibold mb-6" style={{ color: medicalTheme.colors.primary }}>
        Real-Time Alert Feed
      </h3>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
        <p className="text-xs font-semibold text-gray-600">
          {feedData.length} active alert{feedData.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Featured alert (highlighted scroll) */}
      {feedData.length > 0 && (
        <div 
          className="mb-4 p-4 rounded-lg border-l-4 shadow-sm animate-fade-in"
          style={{
            background: feedData[animationIndex].color + '10',
            borderColor: feedData[animationIndex].color
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-3 flex-1">
              <div style={{ color: feedData[animationIndex].color }}>
                {getAlertIcon(feedData[animationIndex].severity)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {feedData[animationIndex].phc_id}: {feedData[animationIndex].alert_type?.replace(/_/g, ' ') || 'Unknown Alert'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {feedData[animationIndex].description}
                </p>
              </div>
            </div>
            <span 
              className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              style={{
                background: feedData[animationIndex].color + '20',
                color: feedData[animationIndex].color
              }}
            >
              {feedData[animationIndex].severity}
            </span>
          </div>
          <p className="text-xs text-gray-500 text-right">
            {feedData[animationIndex].timeAgo}
          </p>
        </div>
      )}

      {/* Alert list */}
      <div className="space-y-2 max-h-96 overflow-y-auto" style={{
        scrollBehavior: 'smooth'
      }}>
        {feedData.map((alert, idx) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border-l-4 transition-all duration-300 flex items-start justify-between hover:shadow-sm ${
              idx === animationIndex ? 'ring-2 scale-105' : ''
            }`}
            style={{
              background: alert.color + '08',
              borderColor: alert.color,
              ringColor: alert.color
            }}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div 
                className="mt-1"
                style={{ color: alert.color }}
              >
                {alert.severity === 'CRITICAL' && <FiAlertCircle size={16} />}
                {alert.severity === 'HIGH' && <FiTrendingUp size={16} />}
                {alert.severity === 'MEDIUM' && <FiBell size={16} />}
                {alert.severity !== 'CRITICAL' && alert.severity !== 'HIGH' && alert.severity !== 'MEDIUM' && <FiCheck size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {alert.phc_id}: {alert.alert_type?.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {alert.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <span 
                className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                style={{
                  background: alert.color + '20',
                  color: alert.color
                }}
              >
                {alert.severity}
              </span>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {alert.timeAgo}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-500 mb-3">ALERT SUMMARY</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 rounded text-center">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-lg font-bold" style={{ color: medicalTheme.colors.primary }}>
              {feedData.length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded text-center">
            <p className="text-xs text-gray-600">Critical</p>
            <p className="text-lg font-bold text-red-600">
              {feedData.filter(a => a.severity === 'CRITICAL').length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded text-center">
            <p className="text-xs text-gray-600">High</p>
            <p className="text-lg font-bold text-orange-600">
              {feedData.filter(a => a.severity === 'HIGH').length}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded text-center">
            <p className="text-xs text-gray-600">Medium</p>
            <p className="text-lg font-bold text-yellow-600">
              {feedData.filter(a => a.severity === 'MEDIUM').length}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
