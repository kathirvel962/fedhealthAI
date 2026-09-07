import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCpu, FiRotateCcw, FiShield, FiMinus } from 'react-icons/fi';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SuggestedQuestions from './SuggestedQuestions';
import { ROLE_WELCOME_MESSAGES } from '../../services/mockChatbotService';

/**
 * Chatbot Window Panel Component
 * Displays the complete assistant chat drawer with header, message area, suggested questions, and input
 */
export default function ChatbotWindow({
  isOpen,
  onClose,
  messages,
  isLoading,
  error,
  role = 'DISTRICT_ADMIN',
  onSendMessage,
  onClearChat,
  onRetry
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, error, isOpen]);

  const roleTitle = role === 'SURVEILLANCE_OFFICER' ? 'Surveillance Officer' : 'District Admin';
  const welcomeText = ROLE_WELCOME_MESSAGES[role] || ROLE_WELCOME_MESSAGES.DISTRICT_ADMIN;

  const showEmptyState = messages.length === 0 || (messages.length === 1 && messages[0].sender === 'assistant');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[430px] h-[580px] sm:h-[620px] max-h-[calc(100vh-100px)] flex flex-col rounded-3xl bg-white/95 backdrop-blur-2xl border border-amber-200/90 shadow-2xl shadow-amber-900/15 overflow-hidden"
          style={{
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15), 0 0 35px rgba(255, 215, 0, 0.2)'
          }}
        >
          {/* ================= HEADER ================= */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-between shadow-sm relative shrink-0">
            {/* Ambient subtle glow background */}
            <div className="absolute inset-0 bg-white/10 pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md shrink-0">
                <FiCpu className="text-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-sm sm:text-base text-slate-950 tracking-tight leading-tight">
                    FedHealth AI Assistant
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-950/15 text-slate-950 border border-slate-950/20">
                    {roleTitle}
                  </span>
                </div>
                <p className="text-[11px] text-slate-900/80 font-semibold leading-tight">
                  Health Intelligence Assistant
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 relative z-10">
              <button
                type="button"
                onClick={onClearChat}
                title="Reset conversation"
                className="p-2 rounded-xl text-slate-900 hover:bg-slate-950/15 transition duration-150"
              >
                <FiRotateCcw className="text-xs sm:text-sm" />
              </button>

              <button
                type="button"
                onClick={onClose}
                title="Minimize / Close"
                className="p-2 rounded-xl text-slate-900 hover:bg-slate-950/15 transition duration-150"
              >
                <FiX className="text-base" />
              </button>
            </div>
          </div>

          {/* ================= MESSAGE BODY ================= */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-gradient-to-b from-[#FFFEF5] via-white to-[#FFFBF0]">
            {/* Welcome banner if in initial/empty state */}
            {showEmptyState && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-amber-100/40 border border-amber-200/80 shadow-sm space-y-2.5 my-2"
              >
                <div className="flex items-center gap-2 text-amber-800">
                  <div className="p-1.5 rounded-lg bg-amber-200/70 text-amber-900">
                    <FiShield className="text-xs" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Role-Based Health Intelligence
                  </h3>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-normal">
                  {welcomeText}
                </p>

                {/* Suggested question pills */}
                <SuggestedQuestions
                  role={role}
                  onSelectQuestion={onSendMessage}
                  disabled={isLoading}
                />
              </motion.div>
            )}

            {/* Conversation History */}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onRetry={onRetry} />
            ))}

            {/* Thinking / Loading State */}
            {isLoading && (
              <ChatMessage
                message={{
                  id: 'loading_indicator',
                  sender: 'assistant',
                  isLoading: true
                }}
              />
            )}

            {/* Error State */}
            {error && (
              <ChatMessage
                message={{
                  id: 'error_indicator',
                  sender: 'error',
                  text: error
                }}
                onRetry={onRetry}
              />
            )}

            {/* Bottom scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* ================= FOOTER / INPUT ================= */}
          <ChatInput
            onSendMessage={onSendMessage}
            disabled={isLoading}
            placeholder={
              role === 'SURVEILLANCE_OFFICER'
                ? 'Ask about outbreak alerts, high-risk PHCs, spatial propagation...'
                : 'Ask about district risk, federated learning rounds, model drift...'
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
