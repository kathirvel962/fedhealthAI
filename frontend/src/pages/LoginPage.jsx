import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { FiMail, FiLock, FiUser } from 'react-icons/fi';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'PHC_USER',
    phc_id: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validation for registration
      if (!isLogin) {
        if (!formData.name.trim()) {
          setError('Full name is required');
          setLoading(false);
          return;
        }
        if (!formData.username.trim()) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        if (!formData.password.trim()) {
          setError('Password is required');
          setLoading(false);
          return;
        }
        if (formData.role === 'PHC_USER' && !formData.phc_id) {
          setError('Please select a PHC');
          setLoading(false);
          return;
        }
      }

      let response;
      if (isLogin) {
        response = await authAPI.login({ username: formData.username, password: formData.password });
      } else {
        // Only send phc_id if role is PHC_USER
        const registrationData = {
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.role,
        };
        if (formData.role === 'PHC_USER') {
          registrationData.phc_id = formData.phc_id;
        }
        response = await authAPI.register(registrationData);
      }

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      console.log('Login successful, user role:', response.data.user.role);

      if (response.data.user.role === 'DISTRICT_ADMIN') {
        navigate('/admin');
      } else if (response.data.user.role === 'PHC_USER') {
        navigate('/phc');
      } else if (response.data.user.role === 'SURVEILLANCE_OFFICER') {
        navigate('/surveillance');
      } else {
        console.error('Unknown role:', response.data.user.role);
        setError('Unknown user role. Please contact administrator.');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Authentication failed';
      setError(errorMsg);
      console.error('Registration error:', error.response?.data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-yellow-25 to-orange-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glow elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-yellow-300 rounded-full opacity-20 blur-3xl animate-float"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-300 rounded-full opacity-15 blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
      
      <div className="bg-gradient-to-br from-white via-yellow-50/50 to-white rounded-3xl shadow-xl p-10 w-full max-w-md border border-yellow-200/50 backdrop-blur-sm z-10 relative">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-2xl">FH</span>
          </div>
        </div>
        <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-yellow-600 via-orange-500 to-yellow-600 bg-clip-text text-transparent">Fedhealth</h1>
        <p className="text-center text-gray-600 mb-10 font-semibold text-sm">Federated Learning for Healthcare</p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="relative">
              <FiUser className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-yellow-200 rounded-xl bg-gradient-to-r from-yellow-50 to-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition shadow-golden-sm hover:shadow-golden-md"
                required={!isLogin}
              />
            </div>
          )}

          <div className="relative">
            <FiUser className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-yellow-200 rounded-xl bg-gradient-to-r from-yellow-50 to-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition shadow-golden-sm hover:shadow-golden-md"
              required
            />
          </div>

          <div className="relative">
            <FiLock className="absolute left-3 top-3 text-gray-400" />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-yellow-200 rounded-xl bg-gradient-to-r from-yellow-50 to-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition shadow-golden-sm hover:shadow-golden-md"
              required
            />
          </div>

          {!isLogin && (
            <>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-yellow-200 rounded-xl bg-gradient-to-r from-yellow-50 to-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition shadow-golden-sm hover:shadow-golden-md font-semibold text-gray-700"
              >
                <option value="PHC_USER">PHC User</option>
                <option value="DISTRICT_ADMIN">District Admin</option>
                <option value="SURVEILLANCE_OFFICER">Surveillance Officer</option>
              </select>

              {formData.role === 'PHC_USER' && (
                <select
                  name="phc_id"
                  value={formData.phc_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-yellow-200 rounded-xl bg-gradient-to-r from-yellow-50 to-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition shadow-golden-sm hover:shadow-golden-md font-semibold text-gray-700"
                  required
                >
                  <option value="">Select PHC</option>
                  <option value="PHC_1">Thondamuthur (Narasipuram) - PHC_1</option>
                  <option value="PHC_2">Annur (S.M.C. Palayam) - PHC_2</option>
                  <option value="PHC_3">Pollachi North (Z. Puravipalayam) - PHC_3</option>
                  <option value="PHC_4">Madukkarai (Vellalore) - PHC_4</option>
                  <option value="PHC_5">Coimbatore South (Kuniamuthur) - PHC_5</option>
                </select>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-orange-400 text-slate-900 py-3 px-4 rounded-xl font-bold text-lg hover:shadow-glow-golden-bright hover:scale-105 transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed transform active:scale-95"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent font-semibold hover:underline"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>

        
      </div>
    </div>
  );
}
