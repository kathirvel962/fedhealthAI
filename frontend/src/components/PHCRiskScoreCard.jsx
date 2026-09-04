import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiActivity, 
  FiAlertTriangle, 
  FiCheckCircle, 
  FiHeart, 
  FiDroplet, 
  FiThermometer, 
  FiInfo, 
  FiChevronDown, 
  FiChevronUp,
  FiClock,
  FiMapPin
} from 'react-icons/fi';

/**
 * Severity configuration for 0-100 Composite Risk
 * LOW: < 25
 * MEDIUM: 25 - 49.99
 * HIGH: 50 - 74.99
 * CRITICAL: >= 75
 */
const SEVERITY_CONFIG = {
  LOW: {
    label: 'LOW RISK',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ringColor: '#10B981',
    gradientFrom: '#34D399',
    gradientTo: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    cardBg: 'bg-emerald-50/30',
    cardBorder: 'border-emerald-200/60',
    icon: FiCheckCircle,
    iconColor: 'text-emerald-600',
    interpretation: 'All surveillance parameters within baseline limits. No active outbreak pattern detected.'
  },
  MEDIUM: {
    label: 'MODERATE RISK',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    ringColor: '#F59E0B',
    gradientFrom: '#FBBF24',
    gradientTo: '#D97706',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    cardBg: 'bg-amber-50/30',
    cardBorder: 'border-amber-200/60',
    icon: FiActivity,
    iconColor: 'text-amber-600',
    interpretation: 'Mild elevation in clinical surveillance indicators. Routine monitoring recommended.'
  },
  HIGH: {
    label: 'HIGH RISK',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    ringColor: '#F97316',
    gradientFrom: '#FB923C',
    gradientTo: '#EA580C',
    glowColor: 'rgba(249, 115, 22, 0.28)',
    cardBg: 'bg-orange-50/30',
    cardBorder: 'border-orange-200/60',
    icon: FiAlertTriangle,
    iconColor: 'text-orange-600',
    interpretation: 'Substantial elevation in infectious symptoms and diagnosis clusters. Precautionary review advised.'
  },
  CRITICAL: {
    label: 'CRITICAL RISK',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
    ringColor: '#EF4444',
    gradientFrom: '#F87171',
    gradientTo: '#DC2626',
    glowColor: 'rgba(239, 68, 68, 0.35)',
    cardBg: 'bg-rose-50/30',
    cardBorder: 'border-rose-200/70',
    icon: FiAlertTriangle,
    iconColor: 'text-rose-600',
    interpretation: 'Critical clinical threshold exceeded across multiple indicators. Immediate epidemiological response required.'
  }
};

const FACTOR_METADATA = {
  fever: {
    title: 'Fever Rate',
    icon: FiThermometer,
    color: 'amber',
    barFill: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    borderLight: 'border-amber-100',
    textColor: 'text-amber-700',
    description: 'Percentage of registered patients presenting with active fever'
  },
  positive_diagnoses: {
    title: 'Positive Diagnoses',
    icon: FiActivity,
    color: 'indigo',
    barFill: 'bg-indigo-500',
    bgLight: 'bg-indigo-50',
    borderLight: 'border-indigo-100',
    textColor: 'text-indigo-700',
    description: 'Patients matching infectious disease diagnosis profiles (Dengue, Malaria, Typhoid, etc.)'
  },
  abnormal_wbc: {
    title: 'Abnormal WBC',
    icon: FiDroplet,
    color: 'sky',
    barFill: 'bg-sky-500',
    bgLight: 'bg-sky-50',
    borderLight: 'border-sky-100',
    textColor: 'text-sky-700',
    description: 'Patients with leukocyte counts outside normal range (<4,500 or >11,000 cells/μL)'
  },
  severity: {
    title: 'High Clinical Severity',
    icon: FiHeart,
    color: 'rose',
    barFill: 'bg-rose-500',
    bgLight: 'bg-rose-50',
    borderLight: 'border-rose-100',
    textColor: 'text-rose-700',
    description: 'Patients evaluated at High clinical severity level (Baseline Surveillance Factor)'
  }
};

export default function PHCRiskScoreCard({ risk, loading = false, phcIdFormatted = 'PHC' }) {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Extract score and severity safely
  const score = useMemo(() => {
    if (!risk || risk.latest_score === undefined || risk.latest_score === null) return 0.0;
    const num = parseFloat(risk.latest_score);
    return isNaN(num) ? 0.0 : Math.max(0, Math.min(100, num));
  }, [risk]);

  const severity = useMemo(() => {
    if (risk?.severity && SEVERITY_CONFIG[risk.severity.toUpperCase()]) {
      return risk.severity.toUpperCase();
    }
    if (score < 25.0) return 'LOW';
    if (score < 50.0) return 'MEDIUM';
    if (score < 75.0) return 'HIGH';
    return 'CRITICAL';
  }, [risk, score]);

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.LOW;
  const SeverityIcon = config.icon;

  // PHC display name
  const phcDisplayName = risk?.phc_name || `${phcIdFormatted} Primary Health Center`;

  // Last updated timestamp
  const formattedTimestamp = useMemo(() => {
    if (!risk?.last_updated) return 'Just now';
    try {
      const date = new Date(risk.last_updated);
      if (isNaN(date.getTime())) return 'Recently updated';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Recently updated';
    }
  }, [risk?.last_updated]);

  // Extract factors
  const factorsList = useMemo(() => {
    const rawFactors = risk?.factors || {};
    const rawBreakdown = risk?.breakdown || {};
    const rawWeights = risk?.weights || {};

    const factorKeys = ['fever', 'positive_diagnoses', 'abnormal_wbc', 'severity'];

    return factorKeys.map((key) => {
      const meta = FACTOR_METADATA[key];
      const factorData = rawFactors[key] || {};

      // Percentage value
      let pct = factorData.percentage;
      if (pct === undefined) {
        if (key === 'fever') pct = rawBreakdown.fever_percentage;
        else if (key === 'positive_diagnoses') pct = rawBreakdown.positive_predictions_percentage;
        else if (key === 'abnormal_wbc') pct = rawBreakdown.abnormal_wbc_ratio;
        else if (key === 'severity') pct = rawBreakdown.high_severity_percentage;
      }
      pct = typeof pct === 'number' && !isNaN(pct) ? Math.max(0, Math.min(100, pct)) : 0.0;

      // Weight
      let weight = factorData.weight;
      if (weight === undefined) {
        weight = rawWeights[key];
        if (weight === undefined) {
          if (key === 'fever') weight = 0.40;
          else if (key === 'positive_diagnoses') weight = 0.30;
          else if (key === 'abnormal_wbc') weight = 0.30;
          else if (key === 'severity') weight = 0.00;
        }
      }
      weight = typeof weight === 'number' ? weight : 0.0;
      const weightPct = Math.round(weight * 100);

      // Contribution
      let contribution = factorData.contribution;
      if (contribution === undefined) {
        if (key === 'fever') contribution = rawBreakdown.fever_component;
        else if (key === 'positive_diagnoses') contribution = rawBreakdown.predictions_component;
        else if (key === 'abnormal_wbc') contribution = rawBreakdown.wbc_component;
        else if (key === 'severity') contribution = rawBreakdown.severity_component;
      }
      if (contribution === undefined) {
        contribution = roundToTwo((pct / 100) * weight * 100);
      }
      contribution = typeof contribution === 'number' ? contribution : 0.0;

      return {
        key,
        title: factorData.label || meta.title,
        description: meta.description,
        icon: meta.icon,
        color: meta.color,
        barFill: meta.barFill,
        bgLight: meta.bgLight,
        borderLight: meta.borderLight,
        textColor: meta.textColor,
        percentage: pct,
        weight,
        weightPercentage: weightPct,
        contribution: contribution
      };
    });
  }, [risk]);

  // Find primary contributing risk driver
  const primaryDriver = useMemo(() => {
    const activeContributors = factorsList.filter(f => f.contribution > 0);
    if (activeContributors.length === 0) return null;
    return activeContributors.reduce((prev, current) => (prev.contribution > current.contribution) ? prev : current);
  }, [factorsList]);

  // Circular gauge calculations
  const radius = 56;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  if (loading && !risk) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded-md mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 h-48 bg-gray-100 rounded-2xl"></div>
          <div className="md:col-span-8 h-48 bg-gray-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-3xl border ${config.cardBorder} ${config.cardBg} bg-white shadow-sm overflow-hidden`}
    >
      {/* Top Banner Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
              PHC Composite Clinical Risk Assessment
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-medium mt-1">
            <span className="flex items-center gap-1 text-slate-700 font-semibold">
              <FiMapPin className="text-sky-600" size={13} />
              {phcDisplayName}
            </span>
            <span className="text-gray-300">•</span>
            <span className="flex items-center gap-1 text-gray-400">
              <FiClock size={13} />
              Last evaluated: {formattedTimestamp}
            </span>
          </div>
        </div>

        {/* Severity Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider shadow-xs ${config.badgeClass}`}>
            <SeverityIcon size={14} className={config.iconColor} />
            {config.label}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left Column: Radial Score Meter */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Composite Outbreak Index
          </p>

          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* SVG Radial Meter */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
              <defs>
                <linearGradient id={`riskGrad-${severity}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={config.gradientFrom} />
                  <stop offset="100%" stopColor={config.gradientTo} />
                </linearGradient>
                <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={config.ringColor} floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Background Track Ring */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="stroke-slate-100"
                strokeWidth={strokeWidth}
                fill="transparent"
              />

              {/* Animated Progress Ring */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={`url(#riskGrad-${severity})`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                filter="url(#gaugeGlow)"
                style={{
                  transition: 'stroke-dashoffset 1s ease-in-out'
                }}
              />
            </svg>

            {/* Centered Numerical Score */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-slate-800 leading-none tracking-tight">
                {score.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                out of 100
              </span>
            </div>
          </div>

          {/* Risk Level Segment Scale */}
          <div className="w-full max-w-[210px] mt-4">
            <div className="grid grid-cols-4 gap-1 h-2 rounded-full overflow-hidden bg-slate-100 p-0.5">
              <div className={`rounded-l-full ${score < 25 ? 'bg-emerald-500 shadow-xs' : 'bg-emerald-200'}`} title="Low (0-25)"></div>
              <div className={`${score >= 25 && score < 50 ? 'bg-amber-500 shadow-xs' : 'bg-amber-200'}`} title="Medium (25-50)"></div>
              <div className={`${score >= 50 && score < 75 ? 'bg-orange-500 shadow-xs' : 'bg-orange-200'}`} title="High (50-75)"></div>
              <div className={`rounded-r-full ${score >= 75 ? 'bg-rose-500 shadow-xs' : 'bg-rose-200'}`} title="Critical (75-100)"></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1 px-0.5">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>

          {/* Interpretation description */}
          <p className="text-[11px] text-gray-600 font-medium text-center mt-3 leading-relaxed px-2">
            {config.interpretation}
          </p>
        </div>

        {/* Right Column: 4 Clinical Risk Factor Breakdown Cards */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Surveillance Factor Breakdown & Score Contribution
            </h3>
            <button
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 transition"
            >
              <FiInfo size={12} />
              {showFormulaDetails ? 'Hide Formula' : 'Calculation Formula'}
              {showFormulaDetails ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            </button>
          </div>

          {/* Factor Cards List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {factorsList.map((factor) => {
              const FactorIcon = factor.icon;
              return (
                <div 
                  key={factor.key}
                  className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs hover:border-gray-200 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top: Icon, Title, and Percentage Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${factor.bgLight} border ${factor.borderLight} flex items-center justify-center ${factor.textColor}`}>
                          <FactorIcon size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-800 leading-tight">
                            {factor.title}
                          </h4>
                          <span className="text-[9px] font-bold text-gray-400">
                            {factor.weightPercentage > 0 ? `Weight: ${factor.weightPercentage}% (w = ${factor.weight})` : 'Clinical Baseline (w = 0.0)'}
                          </span>
                        </div>
                      </div>

                      <span className="text-sm font-black text-slate-800">
                        {factor.percentage.toFixed(1)}%
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mb-2.5" title={factor.description}>
                      {factor.description}
                    </p>
                  </div>

                  {/* Card Bottom: Progress Bar & Contribution Badge */}
                  <div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.percentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full ${factor.barFill} rounded-full`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 font-medium">Composite share:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md ${
                        factor.contribution > 0 
                          ? 'bg-slate-100 text-slate-700 font-extrabold' 
                          : 'bg-gray-50 text-gray-400'
                      }`}>
                        +{factor.contribution.toFixed(2)} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Driver Banner */}
          {primaryDriver && (
            <div className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-gray-600 font-semibold text-[11px]">
                  Primary Outbreak Driver:
                </span>
                <span className="font-extrabold text-slate-800 text-[11px]">
                  {primaryDriver.title} (+{primaryDriver.contribution.toFixed(2)} pts)
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline-block">
                {((primaryDriver.contribution / (score || 1)) * 100).toFixed(0)}% of total risk
              </span>
            </div>
          )}

        </div>

      </div>

      {/* Expandable Mathematical Formula Details */}
      <AnimatePresence>
        {showFormulaDetails && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 bg-slate-50/70 p-5 text-xs text-gray-600"
          >
            <h4 className="font-bold text-slate-800 text-xs mb-1.5 uppercase tracking-wider">
              Mathematical Risk Formulation & Weights
            </h4>
            <div className="p-3 bg-white rounded-xl border border-gray-200 font-mono text-[11px] text-slate-700 leading-relaxed overflow-x-auto">
              <code>
                Composite Risk Score = (Fever % × 0.40) + (Positive Diagnoses % × 0.30) + (Abnormal WBC % × 0.30) + (High Severity % × 0.00)
              </code>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
              <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                <span className="font-bold text-amber-700 block">Fever Factor (40%)</span>
                <span>{factorsList[0]?.percentage.toFixed(1)}% × 0.40 = <strong className="text-slate-800">{factorsList[0]?.contribution.toFixed(2)} pts</strong></span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                <span className="font-bold text-indigo-700 block">Diagnoses Factor (30%)</span>
                <span>{factorsList[1]?.percentage.toFixed(1)}% × 0.30 = <strong className="text-slate-800">{factorsList[1]?.contribution.toFixed(2)} pts</strong></span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                <span className="font-bold text-sky-700 block">Abnormal WBC (30%)</span>
                <span>{factorsList[2]?.percentage.toFixed(1)}% × 0.30 = <strong className="text-slate-800">{factorsList[2]?.contribution.toFixed(2)} pts</strong></span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                <span className="font-bold text-rose-700 block">Clinical Severity (0%)</span>
                <span>{factorsList[3]?.percentage.toFixed(1)}% × 0.00 = <strong className="text-slate-800">{factorsList[3]?.contribution.toFixed(2)} pts</strong></span>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
              <span>Severity Thresholds: Low (&lt;25) • Moderate (25-49.9) • High (50-74.9) • Critical (≥75)</span>
              <span className="text-slate-700 font-bold">Sum of active contributions = {score.toFixed(2)} / 100</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function roundToTwo(num) {
  return +(Math.round(num + "e+2") + "e-2");
}
