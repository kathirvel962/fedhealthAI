import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ChatbotLauncher from './ChatbotLauncher';
import ChatbotWindow from './ChatbotWindow';
import { sendMockChatMessage, ROLE_WELCOME_MESSAGES } from '../../services/mockChatbotService';

/**
 * ChatbotContainer Component
 * Main controller for role validation, state management, and mock intelligence messaging
 */
export default function ChatbotContainer() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSentText, setLastSentText] = useState(null);

  // Retrieve authenticated user
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  const allowedRoles = ['DISTRICT_ADMIN', 'SURVEILLANCE_OFFICER'];
  const isAuthorized = Boolean(token && user && allowedRoles.includes(user.role));

  // Auto-initialize role-specific welcome message when opened if empty
  useEffect(() => {
    if (isAuthorized && user?.role && messages.length === 0) {
      const welcomeText = ROLE_WELCOME_MESSAGES[user.role] || ROLE_WELCOME_MESSAGES.DISTRICT_ADMIN;
      setMessages([
        {
          id: `welcome_${Date.now()}`,
          sender: 'assistant',
          text: welcomeText,
          timestamp: new Date().toISOString(),
          isWelcome: true
        }
      ]);
    }
  }, [isAuthorized, user?.role, messages.length]);

  // Reset chat if user role changes
  useEffect(() => {
    if (user?.role) {
      const welcomeText = ROLE_WELCOME_MESSAGES[user.role] || ROLE_WELCOME_MESSAGES.DISTRICT_ADMIN;
      setMessages([
        {
          id: `welcome_${Date.now()}`,
          sender: 'assistant',
          text: welcomeText,
          timestamp: new Date().toISOString(),
          isWelcome: true
        }
      ]);
      setError(null);
    }
  }, [user?.role]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (text) => {
      const queryText = text.trim();
      if (!queryText || isLoading || !isAuthorized) return;

      const userMsgId = `user_${Date.now()}`;
      const newUserMsg = {
        id: userMsgId,
        sender: 'user',
        text: queryText,
        timestamp: new Date().toISOString()
      };

      // Add user message immediately
      setMessages((prev) => [...prev, newUserMsg]);
      setIsLoading(true);
      setError(null);
      setLastSentText(queryText);

      try {
        const response = await sendMockChatMessage({
          message: queryText,
          role: user.role,
          conversationId: `conv_${user.username || 'user'}`
        });

        const assistantMsg = {
          id: `assistant_${Date.now()}`,
          sender: 'assistant',
          text: response.response,
          timestamp: response.timestamp || new Date().toISOString(),
          isMock: true
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error('Chatbot message error:', err);
        setError(err.message || 'Unable to process your request right now. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isAuthorized, user]
  );

  // Retry handler for failed messages
  const handleRetry = useCallback(() => {
    if (lastSentText) {
      setError(null);
      handleSendMessage(lastSentText);
    }
  }, [lastSentText, handleSendMessage]);

  // Clear / Reset conversation handler
  const handleClearChat = useCallback(() => {
    if (!user?.role) return;
    const welcomeText = ROLE_WELCOME_MESSAGES[user.role] || ROLE_WELCOME_MESSAGES.DISTRICT_ADMIN;
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        text: welcomeText,
        timestamp: new Date().toISOString(),
        isWelcome: true
      }
    ]);
    setError(null);
  }, [user?.role]);

  // STRICT ROLE RESTRICTION:
  // Chatbot must NOT be rendered for PHC_USER, unauthenticated users, or on /login
  if (!isAuthorized || location.pathname === '/login') {
    return null;
  }

  return (
    <>
      <ChatbotLauncher
        isOpen={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        role={user.role}
      />

      <ChatbotWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isLoading={isLoading}
        error={error}
        role={user.role}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        onRetry={handleRetry}
      />
    </>
  );
}
