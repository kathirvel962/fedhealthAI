import React from 'react';
import { motion } from 'framer-motion';
import { FiHelpCircle, FiTrendingUp, FiAlertTriangle, FiActivity, FiCpu, FiMapPin } from 'react-icons/fi';
import { ROLE_SUGGESTED_QUESTIONS } from '../../services/mockChatbotService';

/**
 * Suggested Questions Component
 * Displays role-specific interactive prompt chips to guide user inquiries
 */
export default function SuggestedQuestions({ role = 'DISTRICT_ADMIN', onSelectQuestion, disabled = false }) {
  const questions = ROLE_SUGGESTED_QUESTIONS[role] || ROLE_SUGGESTED_QUESTIONS.DISTRICT_ADMIN;

  const getQuestionIcon = (question) => {
    const q = question.toLowerCase();
    if (q.includes('risk') || q.includes('alert')) return FiAlertTriangle;
    if (q.includes('increase') || q.includes('trend')) return FiTrendingUp;
    if (q.includes('propagation') || q.includes('phc')) return FiMapPin;
    if (q.includes('federated') || q.includes('performing') || q.includes('model')) return FiCpu;
    return FiHelpCircle;
  };

  return (
    <div className="w-full space-y-2 my-3">
      <div className="flex items-center gap-1.5 px-1">
        <FiActivity className="text-amber-500 text-xs animate-pulse" />
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Suggested Inquiries
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((question, index) => {
          const Icon = getQuestionIcon(question);
          return (
            <motion.button
              key={index}
              type="button"
              disabled={disabled}
              whileHover={{ scale: 1.01, x: 3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectQuestion(question)}
              className="text-left flex items-start gap-2.5 p-2.5 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/70 via-white/80 to-amber-50/40 hover:from-amber-100/90 hover:to-amber-50 hover:border-amber-300 shadow-sm hover:shadow-golden-sm transition-all duration-200 text-xs text-gray-800 font-medium group disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="p-1.5 rounded-lg bg-amber-100/80 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-200 mt-0.5 shrink-0">
                <Icon className="text-xs" />
              </span>
              <span className="leading-snug text-gray-700 group-hover:text-gray-900 transition-colors">
                {question}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
