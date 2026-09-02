import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import PHCDashboard from './pages/PHCDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SurveillanceOfficerView from './pages/SurveillanceOfficerView';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/phc"
          element={
            <ProtectedRoute requiredRole="PHC_USER">
              <>
                <Navbar />
                <PHCDashboard />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="DISTRICT_ADMIN">
              <>
                <Navbar />
                <AdminDashboard />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/surveillance"
          element={
            <ProtectedRoute requiredRole="SURVEILLANCE_OFFICER">
              <>
                <Navbar />
                <SurveillanceOfficerView />
              </>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
