import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiCpu, FiAlertTriangle, FiCopy, FiCheck, FiRefreshCw } from 'react-icons/fi';
import { getSeverityColor } from '../MedicalTheme';

/**
 * Formats structured markdown-like text into styled React elements
 */
function FormattedMessageText({ text }) {
  if (!text) return null;

  // Split into lines for paragraph, bullet, and blockquote handling
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed break-words">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Blockquote / Disclaimer line
        if (trimmed.startsWith('>')) {
          const quoteContent = trimmed.replace(/^>\s*/, '');
          return (
            <div
              key={idx}
              className="my-2 p-2 rounded-lg border-l-2 border-amber-500 bg-amber-50/80 text-[11px] text-amber-900 font-medium italic shadow-sm"
            >
              {parseInlineStyles(quoteContent)}
            </div>
          );
        }

        // Bullet line
        if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletContent = trimmed.replace(/^[•\-\*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-amber-500 font-bold select-none">•</span>
              <span className="flex-1">{parseInlineStyles(bulletContent)}</span>
            </div>
          );
        }

        // Numbered list item (e.g. "1. ", "2. ")
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-amber-600 font-bold text-[11px] select-none min-w-[14px]">
                {numberedMatch[1]}.
              </span>
              <span className="flex-1">{parseInlineStyles(numberedMatch[2])}</span>
            </div>
          );
        }

        // Regular paragraph line
        return <p key={idx}>{parseInlineStyles(trimmed)}</p>;
      })}
    </div>
  );
}

/**
 * Parses inline formatting: **bold**, `code`, [CRITICAL], [HIGH], etc.
 */
function parseInlineStyles(text) {
  // Regex to split by bold (**...**), code (`...`), or Severity tags ([CRITICAL], [HIGH], etc.)
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  // Pattern matching: **bold**, `code`, and [SEVERITY]
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[(CRITICAL|HIGH|MEDIUM|LOW)\])/g;

  let match;
  let lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      parts.push(<span key={keyIdx++}>{text.substring(lastIndex, match.index)}</span>);
    }

    const matchedStr = match[0];

    // Check bold
    if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      const boldText = matchedStr.slice(2, -2);
      parts.push(
        <strong key={keyIdx++} className="font-bold text-gray-900">
          {boldText}
        </strong>
      );
    }
    // Check code/metric
    else if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      const codeText = matchedStr.slice(1, -1);
      parts.push(
        <code
          key={keyIdx++}
          className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 font-mono text-[11px] font-semibold border border-amber-200/50"
        >
          {codeText}
        </code>
      );
    }
    // Check severity badge: [CRITICAL], [HIGH], [MEDIUM], [LOW]
    else if (matchedStr.startsWith('[') && matchedStr.endsWith(']')) {
      const severity = matchedStr.slice(1, -1);
      const sevColor = getSeverityColor(severity);
      parts.push(
        <span
          key={keyIdx++}
          className={`inline-block px-1.5 py-0.2 rounded-md text-[10px] uppercase tracking-wider mx-1 ${sevColor.badge}`}
        >
          {severity}
        </span>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    parts.push(<span key={keyIdx++}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Chat Message Component
 * Displays individual user, assistant, error, and loading messages
 */
export default function ChatMessage({ message, onRetry }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === 'user';
  const isError = message.sender === 'error';
  const isLoading = message.isLoading;

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Thinking / Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2.5 my-2.5"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-golden-sm shrink-0">
          <FiCpu className="text-sm animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white/95 border border-amber-200/80 shadow-sm max-w-[85%]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Thinking</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Analyzing network intelligence...</p>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-start gap-2.5 my-2.5"
      >
        <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-md shrink-0">
          <FiAlertTriangle className="text-sm" />
        </div>
        <div className="p-3 rounded-2xl rounded-tl-sm bg-red-50 border border-red-200 text-red-800 shadow-sm max-w-[85%] text-xs">
          <p className="font-semibold">{message.text || 'Unable to process your request right now. Please try again.'}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-sm transition"
            >
              <FiRefreshCw className="text-[10px]" />
              Try Again
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // User Message
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-end gap-2 my-2.5 group"
      >
        <div className="flex flex-col items-end max-w-[82%] sm:max-w-[75%]">
          <div className="p-3 rounded-2xl rounded-br-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md text-xs sm:text-[13px] leading-relaxed break-words border border-slate-700">
            <p className="font-normal">{message.text}</p>
          </div>
          {message.timestamp && (
            <span className="text-[10px] text-gray-400 mt-1 px-1 font-medium">
              {formatTimestamp(message.timestamp)}
            </span>
          )}
        </div>
        <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0 shadow-sm mb-4">
          <FiUser />
        </div>
      </motion.div>
    );
  }

  // Assistant Message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 my-2.5 group"
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-golden-sm shrink-0 mt-0.5">
        <FiCpu className="text-sm" />
      </div>

      <div className="flex flex-col items-start max-w-[85%] sm:max-w-[80%]">
        <div className="relative p-3.5 rounded-2xl rounded-tl-sm bg-white/95 border border-amber-200/70 shadow-sm text-gray-800 backdrop-blur-sm">
          {/* Header Tag */}
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-gray-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              FedHealth AI Assistant
            </span>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy message"
              className="text-gray-400 hover:text-gray-600 transition p-0.5 rounded"
            >
              {copied ? <FiCheck className="text-green-600 text-xs" /> : <FiCopy className="text-xs" />}
            </button>
          </div>

          {/* Formatted Content */}
          <FormattedMessageText text={message.text} />
        </div>

        {message.timestamp && (
          <span className="text-[10px] text-gray-400 mt-1 px-1 font-medium">
            {formatTimestamp(message.timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
