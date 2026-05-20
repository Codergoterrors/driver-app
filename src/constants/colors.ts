// Uber Driver App — Design System Colors

export const lightColors = {
  // Primary
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#FAFAFA',

  // Text
  textPrimary: '#000000',
  textSecondary: '#545454',
  textDisabled: '#9E9E9E',
  textInverse: '#FFFFFF',

  // Brand
  primary: '#000000',
  goBlue: '#276EF1',
  onlineGreen: '#06C167',
  onlineGreenDark: '#05A558',
  offlineGray: '#E0E0E0',
  errorRed: '#D32F2F',
  warningOrange: '#F5A623',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  divider: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.5)',
  ripple: 'rgba(0,0,0,0.08)',
  shadowColor: '#000000',
  
  // Specific markers
  riderPin: '#276EF1',
};

export const darkColors = {
  // Primary
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2A2A2A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textDisabled: '#6E6E6E',
  textInverse: '#000000',

  // Brand
  primary: '#FFFFFF',
  goBlue: '#4B8BFF',
  onlineGreen: '#06C167',
  onlineGreenDark: '#05A558',
  offlineGray: '#333333',
  errorRed: '#E57373',
  warningOrange: '#FFB74D',

  // Misc
  white: '#FFFFFF', // Actually keep white as white for some inverse elements
  black: '#000000', // Keep black for some inverse elements
  border: '#333333',
  borderLight: '#2A2A2A',
  divider: '#333333',
  overlay: 'rgba(0,0,0,0.7)',
  ripple: 'rgba(255,255,255,0.08)',
  shadowColor: '#000000',
  
  // Specific markers
  riderPin: '#4B8BFF',
};

// Fallback for non-themed components temporarily
export const Colors = lightColors;
