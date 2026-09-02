import React, { useEffect, useState } from 'react';
import { medicalTheme, getDriftStatus } from './MedicalTheme';
import { FiRadio } from 'react-icons/fi';

/**
 * Anomaly Radar Pulse Indicator
 * Animated visual indicator of model drift status
 * 
 * Data source: drift.detected and drift.accuracy_drop_percentage from backend
 */
export default function AnomalyRadarPulse({ driftData }) {
  const [pulseActive, setPulseActive] = useState(true);
  
  // Derive status from drift data
  const driftStatus = getDriftStatus(driftData?.accuracy_drop_percentage);
  const isDrifting = driftData?.detected || false;
  
  // Pulse animation intensity based on drift severity
  const pulseIntensity = driftData?.accuracy_drop_percentage ? 
    Math.min(driftData.accuracy_drop_percentage / 20, 1) : 0;

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseActive(prev => !prev);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      className="relative rounded-xl shadow-md p-6 border overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${driftStatus.color}15 0%, ${driftStatus.color}05 100%)`,
        borderColor: driftStatus.color + '30'
      }}
    >
      {/* Pulsing background effect */}
      <div 
        className="absolute inset-0 opacity-20 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle, ${driftStatus.color}40 0%, transparent 70%)`,
          opacity: pulseActive ? 0.3 : 0.1,
          pointerEvents: 'none'
        }}
      ></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: medicalTheme.colors.primary }}>
            Drift Status Monitor
          </h3>
          <FiRadio 
            size={24} 
            className={`transition-transform duration-1000 ${pulseActive ? 'scale-125' : 'scale-100'}`}
            style={{ color: driftStatus.color }}
          />
        </div>

        {/* Main Status Display */}
        <div className="flex items-end gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Current Status</p>
            <p 
              className="text-3xl font-bold"
              style={{ color: driftStatus.color }}
            >
              {driftStatus.label}
            </p>
          </div>

          {/* Animated pulse circle */}
          <div className="mb-2 flex items-center gap-2">
            <div 
              className="relative w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: driftStatus.color + '20' }}
            >
              <div
                className={`absolute inset-1 rounded-full transition-all duration-1000 ${pulseActive ? 'scale-100 opacity-100' : 'scale-150 opacity-0'}`}
                style={{ 
                  backgroundColor: driftStatus.color,
                  filter: `drop-shadow(0 0 6px ${driftStatus.color})`
                }}
              ></div>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: driftStatus.color }}
              ></div>
            </div>
          </div>
        </div>

        {/* Drift Details */}
        {isDrifting && driftData?.accuracy_drop_percentage && (
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: driftStatus.color + '10' }}>
            <p className="text-sm font-medium" style={{ color: driftStatus.color }}>
              Accuracy dropped by {driftData.accuracy_drop_percentage.toFixed(2)}%
            </p>
            {driftData.previous_accuracy && driftData.current_accuracy && (
              <p className="text-xs text-gray-600 mt-1">
                {(driftData.previous_accuracy * 100).toFixed(2)}% → {(driftData.current_accuracy * 100).toFixed(2)}%
              </p>
            )}
          </div>
        )}

        {!isDrifting && (
          <div className="mt-4 p-3 rounded-lg bg-green-50">
            <p className="text-sm font-medium text-green-700">
              Model performing within acceptable parameters
            </p>
          </div>
        )}
      </div>

      {/* Animated border pulse effect */}
      <div 
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: `2px solid ${driftStatus.color}`,
          opacity: pulseActive ? 0.5 : 0.2,
          transition: 'opacity 1s ease-in-out'
        }}
      ></div>
    </div>
  );
}
