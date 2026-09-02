import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiLogOut, FiHome } from 'react-icons/fi';
import { medicalTheme } from './MedicalTheme';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleHomeClick = () => {
    if (user.role === 'PHC_USER') {
      navigate('/phc');
    } else if (user.role === 'DISTRICT_ADMIN') {
      navigate('/admin');
    } else if (user.role === 'SURVEILLANCE_OFFICER') {
      navigate('/surveillance');
    }
  };

  const navLinkClass = (path) =>
    `px-4 py-2 rounded-lg font-semibold transition duration-300 relative group ${
      location.pathname === path
        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-golden-lg glow-golden'
        : 'text-gray-700 hover:text-gray-900'
    }`;

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-2xl border-b shadow-sm transition-all duration-300"
      style={{
        background: 'linear-gradient(180deg, rgba(255, 254, 245, 0.98) 0%, rgba(255, 251, 240, 0.95) 100%)',
        borderColor: '#E2E8F0',
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
        {/* Logo Section */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center cursor-pointer"
          onClick={handleHomeClick}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mr-3 shadow-sm bg-amber-500"
          >
            <span className="text-white font-bold text-base">FH</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Fedhealth AI</h1>
            <p className="text-[10px] text-gray-500 -mt-1 font-semibold">Surveillance Platform</p>
          </div>
        </motion.div>

        {/* Navigation Links */}
        {user && (
          <div className="flex items-center gap-2">
            {user.role === 'PHC_USER' && (
              <motion.button
                whileHover={{ y: -1 }}
                onClick={() => navigate('/phc')}
                className={navLinkClass('/phc')}
              >
                Dashboard
              </motion.button>
            )}
            {user.role === 'DISTRICT_ADMIN' && (
              <motion.button
                whileHover={{ y: -1 }}
                onClick={() => navigate('/admin')}
                className={navLinkClass('/admin')}
              >
                Dashboard
              </motion.button>
            )}
            {user.role === 'SURVEILLANCE_OFFICER' && (
              <motion.button
                whileHover={{ y: -1 }}
                onClick={() => navigate('/surveillance')}
                className={navLinkClass('/surveillance')}
              >
                Surveillance
              </motion.button>
            )}
          </div>
        )}

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.username || user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <div
              className="w-1 h-8 rounded-full"
              style={{
                background: medicalTheme.colors.gradients.primary_gradient
              }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-lg font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition duration-300"
            >
              <FiLogOut className="mr-2" />
              Logout
            </motion.button>
          </div>
        )}
      </div>
    </nav>
  );
}
