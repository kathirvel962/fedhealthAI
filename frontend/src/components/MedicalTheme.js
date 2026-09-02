// Golden Intelligence Health - Premium Medical Design System
// Hackathon-level, exquisite SaaS design with luminous golden accents
export const medicalTheme = {
  colors: {
    // ENHANCED: Brighter, more vibrant golden palette
    primary: '#FFD700',      // Bright gold - Premium & Luminous
    secondary: '#FFA500',    // Vibrant orange - Energy
    accent: '#FFED4E',       // Bright yellow - Highlight glow
    success: '#10B981',      // Emerald - Healthy
    warning: '#FF6B6B',      // Vibrant red - Alert
    danger: '#FF4444',       // Bright red - Critical
    
    // Backgrounds
    bg: {
      light: '#FFFEF5',      // Extremely bright off-white with golden tint
      white: '#FFFFFF',
      card: '#FFFBF0',       // Bright card background
      hover: '#FFF9F0',      // Hover state - slightly darker
      dark: '#0F172A'        // Deep slate for text
    },
    
    // Text
    text: {
      primary: '#0F172A',    // Deep slate
      secondary: '#475569',  // Gray
      tertiary: '#78909C',   // Light gray
      light: '#CBD5E1'       // Very light gray
    },
    
    // ENHANCED: Premium, multidirectional, luminous gradients
    gradients: {
      primary_gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
      primary_subtle: 'linear-gradient(180deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.08) 100%)',
      accent_gradient: 'linear-gradient(135deg, #FFED4E 0%, #FFD700 100%)',
      success_gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      warning_gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF4444 100%)',
      federation_gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
      neutral_gradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
      // ENHANCED: Page backgrounds with multiple light layers
      page_gradient: 'linear-gradient(135deg, #FFFEF5 0%, #FFFBF0 25%, #FFFEF5 50%, #FFFBF0 75%, #FFFEF5 100%)',
      // ENHANCED: Bright luminous glow with golden tint
      radial_glow: 'radial-gradient(ellipse at 30% 40%, rgba(255, 215, 0, 0.25) 0%, rgba(255, 165, 0, 0.1) 35%, transparent 70%)',
      // NEW: Additional premium gradients for depth
      card_glow: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.08) 0%, rgba(255, 237, 78, 0.04) 50%, transparent 100%)',
      luminous: 'linear-gradient(180deg, rgba(255, 237, 78, 0.2) 0%, rgba(255, 215, 0, 0.1) 100%)'
    },
    
    // Gradient text classes
    gradient_text: {
      primary: 'bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent',
      golden: 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-400 bg-clip-text text-transparent',
      accent: 'bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent',
      success: 'bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent'
    }
  },
  
  // ENHANCED: Premium layered shadows with golden tints for depth
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 12px -2px rgba(0, 0, 0, 0.08)',
    lg: '0 10px 25px -3px rgba(0, 0, 0, 0.12)',
    xl: '0 20px 35px -5px rgba(0, 0, 0, 0.15)',
    // ENHANCED: Luminous golden glows
    glow: '0 0 30px rgba(255, 215, 0, 0.3)',
    glow_hover: '0 0 40px rgba(255, 165, 0, 0.4), 0 0 60px rgba(255, 215, 0, 0.2)',
    glow_strong: '0 0 50px rgba(255, 215, 0, 0.35)',
    card: '0 8px 32px rgba(0, 0, 0, 0.08)',
    elevation: '0 15px 40px rgba(0, 0, 0, 0.1)',
    // NEW: Multiple layer shadows for depth
    inner_glow: 'inset 0 1px 3px rgba(255, 215, 0, 0.15)',
    floating: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 0 20px rgba(255, 215, 0, 0.15)',
    premium: '0 20px 50px rgba(0, 0, 0, 0.12), 0 0 30px rgba(255, 215, 0, 0.2)',
    // NEW: Bright card shadows
    card_bright: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 15px rgba(255, 215, 0, 0.12)'
  },
  
  // Animation durations (in ms)
  animations: {
    fast: 150,
    normal: 300,
    slow: 500,
    very_slow: 1000
  },
  
  // Border radius (premium rounded)
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.875rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '2rem',
    full: '9999px'
  },
  
  // Glass morphism properties
  glass: {
    light: 'backdrop-blur-md bg-white/50 border border-golden-100/20',
    card: 'backdrop-blur-xl bg-white/60 border border-golden-200/30',
    dark: 'backdrop-blur-md bg-slate-900/40 border border-slate-700/30'
  }
};

// Utility function to get severity color with enhanced visuals
export const getSeverityColor = (severity) => {
  const map = {
    'CRITICAL': { 
      bg: '#FF4444', 
      text: '#FF4444', 
      light: '#FFF0F0',
      gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF4444 100%)',
      glow: 'rgba(255, 68, 68, 0.25)',
      badge: 'bg-red-100 text-red-700 font-bold',
      shadow: '0 0 20px rgba(255, 68, 68, 0.3)'
    },
    'HIGH': { 
      bg: '#FFA500', 
      text: '#FF8C00', 
      light: '#FFECCC',
      gradient: 'linear-gradient(135deg, #FFB700 0%, #FFA500 100%)',
      glow: 'rgba(255, 165, 0, 0.25)',
      badge: 'bg-orange-100 text-orange-700 font-bold',
      shadow: '0 0 20px rgba(255, 165, 0, 0.25)'
    },
    'MEDIUM': { 
      bg: '#FFD700', 
      text: '#CC9A00', 
      light: '#FFF8E1',
      gradient: 'linear-gradient(135deg, #FFED4E 0%, #FFD700 100%)',
      glow: 'rgba(255, 215, 0, 0.25)',
      badge: 'bg-yellow-100 text-yellow-700 font-bold',
      shadow: '0 0 20px rgba(255, 215, 0, 0.25)'
    },
    'LOW': { 
      bg: '#10B981', 
      text: '#047857', 
      light: '#ECFDF5',
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
      glow: 'rgba(16, 185, 129, 0.25)',
      badge: 'bg-emerald-100 text-emerald-700 font-bold',
      shadow: '0 0 20px rgba(16, 185, 129, 0.25)'
    },
    'UNKNOWN': { 
      bg: '#9CA3AF', 
      text: '#6B7280', 
      light: '#F3F4F6',
      gradient: 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)',
      glow: 'rgba(156, 163, 175, 0.15)',
      badge: 'bg-gray-100 text-gray-700 font-bold',
      shadow: '0 0 15px rgba(156, 163, 175, 0.15)'
    }
  };
  return map[severity] || map['UNKNOWN'];
};

// Utility to get drift status with enhanced visuals
export const getDriftStatus = (driftPercentage) => {
  if (!driftPercentage) {
    return { 
      status: 'stable', 
      color: medicalTheme.colors.success, 
      label: 'Stable',
      gradient: medicalTheme.colors.gradients.success_gradient,
      pulse: false
    };
  }
  if (driftPercentage > 20) {
    return { 
      status: 'critical', 
      color: medicalTheme.colors.danger, 
      label: 'Critical Drift',
      gradient: medicalTheme.colors.gradients.danger_gradient,
      pulse: true
    };
  }
  if (driftPercentage > 10) {
    return { 
      status: 'warning', 
      color: medicalTheme.colors.accent, 
      label: 'High Drift',
      gradient: medicalTheme.colors.gradients.alert_gradient,
      pulse: true
    };
  }
  return { 
    status: 'watch', 
    color: medicalTheme.colors.warning, 
    label: 'Monitor',
    gradient: medicalTheme.colors.gradients.warning_gradient,
    pulse: false
  };
};
