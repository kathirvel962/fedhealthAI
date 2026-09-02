import React from 'react';
import { motion } from 'framer-motion';

/**
 * Premium Card Wrapper
 * Provides consistent glassmorphism styling for all dashboard cards
 */
export default function PremiumCard({
  children,
  title,
  subtitle = '',
  className = '',
  showBorder = true,
  variant = 'light' // 'light', 'dark', 'gradient'
}) {
  const baseClasses = 'rounded-2xl transition-all duration-350 overflow-hidden relative group';

  const variantClasses = {
    light: 'backdrop-blur-xl bg-gradient-to-br from-white/85 to-yellow-50/70 border border-yellow-200/40 shadow-golden-lg hover:shadow-glow-golden-hover hover:scale-105',
    dark: 'backdrop-blur-xl bg-slate-900/40 border border-slate-700/30 shadow-lg text-white hover:shadow-xl',
    gradient:
      'backdrop-blur-xl bg-gradient-to-br from-white/40 to-yellow-100/30 border border-yellow-300/30 shadow-golden-lg hover:shadow-glow-golden-hover'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {/* Radial glow background on hover */}
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-2xl -z-10"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.2), transparent)',
        }}
      />

      {/* Header if title provided */}
      {title && (
        <div className="border-b border-yellow-200/30 px-6 py-5 bg-gradient-to-r from-yellow-50/50 to-transparent">
          <h3 className="text-lg font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-6">{children}</div>
    </motion.div>
  );
}
