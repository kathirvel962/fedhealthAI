import React from 'react';
import { motion } from 'framer-motion';
import { FiCpu, FiX, FiMessageSquare } from 'react-icons/fi';

/**
 * Floating Chatbot Launcher Button
 * Renders in the bottom right corner with animated luminous golden accents
 */
export default function ChatbotLauncher({ isOpen, onClick, role }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* Optional subtle teaser badge when closed */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-amber-400 border border-amber-400/30 text-xs font-semibold shadow-lg backdrop-blur-md cursor-pointer hover:bg-slate-900 transition"
          onClick={onClick}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Ask FedHealth AI</span>
        </motion.div>
      )}

      {/* Main Floating Button */}
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? 'Close FedHealth AI Assistant' : 'Open FedHealth AI Assistant'}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-slate-950 shadow-golden-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-300/50"
        style={{
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
          boxShadow: '0 8px 30px rgba(255, 165, 0, 0.4), 0 0 20px rgba(255, 215, 0, 0.3)'
        }}
      >
        {/* Pulsing ring animation when closed */}
        {!isOpen && (
          <span className="absolute -inset-1 rounded-2xl bg-amber-400 opacity-40 animate-ping -z-10" />
        )}

        {/* Animated Icon Toggle */}
        <motion.div
          key={isOpen ? 'open' : 'closed'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <FiX className="text-2xl font-bold" />
          ) : (
            <FiCpu className="text-2xl font-bold" />
          )}
        </motion.div>

        {/* Online status indicator dot */}
        {!isOpen && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
        )}
      </motion.button>
    </div>
  );
}
