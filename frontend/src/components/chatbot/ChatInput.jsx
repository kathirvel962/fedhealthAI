import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiX, FiShield } from 'react-icons/fi';

/**
 * ChatInput Component
 * Supports multiline input, Enter to submit, Shift+Enter for newline, and send button validation
 */
export default function ChatInput({ onSendMessage, disabled = false, placeholder = 'Ask about outbreak risks, alerts, surveillance trends...' }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed);
    setText('');

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = text.trim().length > 0;

  return (
    <div className="border-t border-amber-100/80 bg-gradient-to-b from-white to-amber-50/40 p-3 rounded-b-2xl">
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div className="relative flex items-end gap-2 bg-white rounded-xl border border-amber-200/80 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-300/40 shadow-sm p-1.5 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full resize-none outline-none text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 bg-transparent px-2.5 py-1.5 max-h-[120px] font-normal leading-relaxed disabled:opacity-50"
          />

          {hasContent && (
            <button
              type="button"
              onClick={() => setText('')}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
              title="Clear input"
            >
              <FiX className="text-xs" />
            </button>
          )}

          <button
            type="submit"
            disabled={!hasContent || disabled}
            className={`p-2.5 rounded-lg font-bold flex items-center justify-center transition-all duration-200 shrink-0 ${
              hasContent && !disabled
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-golden-sm hover:scale-105 active:scale-95 glow-golden'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="Send inquiry"
          >
            <FiSend className="text-xs" />
          </button>
        </div>

        {/* Privacy & hint indicator */}
        <div className="flex items-center justify-between px-1 text-[10px] text-gray-400">
          <span className="flex items-center gap-1 font-medium text-amber-700/80">
            <FiShield className="text-[10px]" />
            Privacy Protected • Derived Metrics Only
          </span>
          <span className="hidden sm:inline text-gray-400">Press Enter ↵ to send</span>
        </div>
      </form>
    </div>
  );
}
