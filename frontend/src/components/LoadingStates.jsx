import React from 'react';
import { motion } from 'framer-motion';
import { FiInbox, FiLoader } from 'react-icons/fi';
import { medicalTheme } from './MedicalTheme';

/**
 * Loading Skeleton Component
 * Shows animated skeleton loaders while data is being fetched
 */
export function LoadingSkeleton({ count = 4, height = '200px' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="animate-shimmer rounded-2xl"
          style={{ height, borderRadius: '1.5rem' }}
        />
      ))}
    </div>
  );
}

/**
 * Empty State Component
 * Shows when no data is available
 */
export function EmptyState({
  title = 'No Data Available',
  description = 'Data will appear here once it becomes available.',
  icon: Icon = FiInbox
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-12 text-center"
      style={{
        background: `linear-gradient(135deg, ${medicalTheme.colors.primary}08 0%, ${medicalTheme.colors.secondary}08 100%)`,
        border: `1px solid ${medicalTheme.colors.primary}20`
      }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mb-4"
      >
        <Icon
          size={48}
          className="mx-auto"
          style={{ color: medicalTheme.colors.primary + '60' }}
        />
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </motion.div>
  );
}

/**
 * Loading Overlay Component
 * Shows when main content is loading
 */
export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="p-8 rounded-2xl shadow-xl"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <FiLoader size={48} className="mb-4" style={{ color: medicalTheme.colors.primary }} />
        <p className="text-center font-semibold text-gray-700">{message}</p>
      </motion.div>
    </motion.div>
  );
}
