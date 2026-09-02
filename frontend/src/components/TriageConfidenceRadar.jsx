import React, { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { medicalTheme } from './MedicalTheme';

/**
 * AI Triage Confidence Radar
 * Shows influence of key diagnostic factors on model predictions
 * 
 * Data source: Computed from patient symptom distribution
 */
export default function TriageConfidenceRadar({ patients }) {
  const radarData = useMemo(() => {
    if (!patients || patients.length === 0) {
      return [
        { metric: 'Fever', value: 0 },
        { metric: 'Cough', value: 0 },
        { metric: 'Rash', value: 0 },
        { metric: 'WBC Variance', value: 0 },
        { metric: 'Age Factor', value: 0 }
      ];
    }

    // Calculate symptom prevalence (0-100)
    const feverRate = (patients.filter(p => p.fever === 1).length / patients.length) * 100;
    const coughRate = (patients.filter(p => p.cough === 1).length / patients.length) * 100;
    const rashRate = (patients.filter(p => p.rash === 1).length / patients.length) * 100;
    
    // WBC variance as percentage (4500-12000 normal, wider = more variance)
    const wbcValues = patients.map(p => p.wbc_count);
    const wbcMin = Math.min(...wbcValues);
    const wbcMax = Math.max(...wbcValues);
    const wbcVariance = ((wbcMax - wbcMin) / 8000) * 100;
    
    // Age factor (20-75 typical, wider distribution = higher complexity)
    const ageValues = patients.map(p => p.age);
    const ageMin = Math.min(...ageValues);
    const ageMax = Math.max(...ageValues);
    const ageFactor = ((ageMax - ageMin) / 55) * 100;

    return [
      { metric: 'Fever', value: Math.min(feverRate, 100) },
      { metric: 'Cough', value: Math.min(coughRate, 100) },
      { metric: 'Rash', value: Math.min(rashRate, 100) },
      { metric: 'WBC Variance', value: Math.min(wbcVariance, 100) },
      { metric: 'Age Factor', value: Math.min(ageFactor, 100) }
    ];
  }, [patients]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="mb-4">
        <h3 className="text-lg font-semibold" style={{ color: medicalTheme.colors.primary }}>
          AI Triage Confidence Radar
        </h3>
        <p className="text-sm text-gray-500 mt-1">Diagnostic factor influence scores</p>
      </div>
      
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fontSize: 12, fill: medicalTheme.colors.text.secondary }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: medicalTheme.colors.text.tertiary }}
          />
          <Radar 
            name="Influence Score" 
            dataKey="value" 
            stroke={medicalTheme.colors.secondary}
            fill={medicalTheme.colors.secondary}
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: medicalTheme.colors.secondary }}></span>
          Based on current patient cohort analysis
        </div>
      </div>
    </div>
  );
}
