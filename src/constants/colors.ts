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

  // Earnings Pill
  earningsPillBg: '#000000',
  earningsPillText: '#FFFFFF',

  // Bottom Bar
  bottomBarBg: '#FFFFFF',
  bottomBarBorder: '#E0E0E0',

  // Map
  routeColor: '#1A1A1A',
  routeUpcoming: '#F5A623',
  pickupPin: '#06C167',
  dropoffPin: '#D32F2F',
  riderPin: '#276EF1',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  divider: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.5)',
  ripple: 'rgba(0,0,0,0.08)',
  shadowColor: '#000000',

  // Status
  statusOnline: '#06C167',
  statusOffline: '#9E9E9E',
  statusBusy: '#F5A623',
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

  // Earnings Pill — keep always visible with high contrast
  earningsPillBg: '#FFFFFF',
  earningsPillText: '#000000',

  // Bottom Bar
  bottomBarBg: '#1E1E1E',
  bottomBarBorder: '#333333',

  // Map
  routeColor: '#FFFFFF',
  routeUpcoming: '#FFB74D',
  pickupPin: '#06C167',
  dropoffPin: '#E57373',
  riderPin: '#4B8BFF',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  border: '#333333',
  borderLight: '#2A2A2A',
  divider: '#333333',
  overlay: 'rgba(0,0,0,0.7)',
  ripple: 'rgba(255,255,255,0.08)',
  shadowColor: '#000000',

  // Status
  statusOnline: '#06C167',
  statusOffline: '#6E6E6E',
  statusBusy: '#FFB74D',
};

// Fallback for non-themed components
export const Colors = lightColors;

export const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#181818"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1b1b1b"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];
