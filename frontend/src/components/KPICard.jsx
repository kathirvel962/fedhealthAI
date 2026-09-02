import React from 'react';
import { motion } from 'framer-motion';
import { medicalTheme } from './MedicalTheme';

/**
 * Premium KPI Card Component
 * Displays key performance indicators with gradient backgrounds and animations
 */
export default function KPICard({
  title,
  value,
  subtitle = '',
  icon: Icon,
  gradient = medicalTheme.colors.gradients.primary_gradient,
  isAlert = false,
  isPulsing = false,
  className = ''
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={`premium-card overflow-hidden relative group ${className}`}
      style={{
        background: isAlert ? 'linear-gradient(135deg, #FFF0F0 0%, #FFEBEB 100%)' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 254, 245, 0.85) 100%)',
        backdropFilter: 'blur(12px)',
        borderRadius: '1.5rem',
        boxShadow: isAlert 
          ? '0 10px 30px rgba(0, 0, 0, 0.1), 0 0 30px rgba(255, 68, 68, 0.15)' 
          : '0 10px 30px rgba(0, 0, 0, 0.08), 0 0 25px rgba(255, 215, 0, 0.12)',
        border: isAlert ? '1px solid rgba(255, 68, 68, 0.2)' : '1px solid rgba(255, 215, 0, 0.15)'
      }}
    >
      {/* Gradient background glow */}
      <div
        className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300"
        style={{ background: gradient }}
      />

      {/* Radial glow for premium effect */}
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{
          background: isAlert 
            ? 'radial-gradient(circle at 50% 50%, rgba(255, 68, 68, 0.15), transparent)'
            : 'radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.15), transparent)',
          zIndex: -1
        }}
      />

      {/* Pulsing glow for alerts */}
      {isPulsing && (
        <div
          className="absolute inset-0 animate-glow-pulse rounded-2xl"
          style={{
            background: isAlert ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 215, 0, 0.08)'
          }}
        />
      )}

      {/* Content */}
      <div className="relative p-6 md:p-8 flex flex-col h-full">
        {/* Header with icon */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm md:text-base font-bold text-gray-700 tracking-wide">
            {title}
          </h3>
          {Icon && (
            <motion.div
              whileHover={{ scale: 1.15, rotate: 5 }}
              className="p-3 rounded-xl transition-all duration-300"
              style={{
                background: isAlert
                  ? 'linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 100, 100, 0.1))'
                  : 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1))',
                boxShadow: isAlert
                  ? '0 0 15px rgba(255, 68, 68, 0.2)'
                  : '0 0 15px rgba(255, 215, 0, 0.2)'
              }}
            >
              <Icon
                className="text-2xl"
                style={{
                  color: isAlert ? '#FF4444' : '#FFD700'
                }}
              />
            </motion.div>
          )}
        </div>

        {/* Main value - ENHANCED SIZE AND GLOW */}
        <div className="mb-4 flex-grow">
          <p
            className="text-5xl md:text-6xl font-black tracking-tight"
            style={{
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: isPulsing ? 'drop-shadow(0 0 12px rgba(255, 215, 0, 0.4))' : 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.15))'
            }}
          >
            {value}
          </p>
        </div>

        {/* Subtitle/additional info */}
        {subtitle && (
          <p className="text-xs md:text-sm text-gray-600 font-medium">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}
