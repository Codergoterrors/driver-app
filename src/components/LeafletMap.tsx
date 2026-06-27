/**
 * LeafletMap — Loads OpenStreetMap directly via URI in WebView.
 * Most reliable approach: no CDN, no HTML injection, no baseUrl issues.
 * Loads https://www.openstreetmap.org/export/embed.html directly.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import WebView from 'react-native-webview';

export interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  icon?: 'driver' | 'restaurant' | 'customer' | 'default';
}

export interface LeafletMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  markers?: MarkerData[];
  routeCoordinates?: Array<[number, number]>;
  style?: ViewStyle;
  onMapReady?: () => void;
  onLocationPress?: (lat: number, lng: number) => void;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
  latitude = 18.5204,
  longitude = 73.8567,
  zoom = 14,
  markers = [],
  style,
  onMapReady,
}) => {
  // Build OSM embed URL — officially supported, no API key, works everywhere
  const delta = 0.015;
  const bbox = [
    (longitude - delta).toFixed(6),
    (latitude - delta).toFixed(6),
    (longitude + delta).toFixed(6),
    (latitude + delta).toFixed(6),
  ].join('%2C');

  const osmUrl =
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ uri: osmUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        onLoad={() => onMapReady?.()}
        androidLayerType="hardware"
        mixedContentMode="always"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5e3df',
  },
  webview: {
    flex: 1,
  },
});

export default LeafletMap;
