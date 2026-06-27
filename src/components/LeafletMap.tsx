/**
 * LeafletMap — WebView-based OpenStreetMap component using Leaflet.js
 * Works 100% reliably on all Android versions, old & new arch.
 * No native compilation needed beyond react-native-webview.
 */
import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import WebView from 'react-native-webview';

export interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  color?: string; // hex color e.g. '#FF5733'
  icon?: 'driver' | 'restaurant' | 'customer' | 'default';
}

export interface LeafletMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  markers?: MarkerData[];
  routeCoordinates?: Array<[number, number]>; // [lat, lng] pairs
  style?: ViewStyle;
  onMapReady?: () => void;
  onLocationPress?: (lat: number, lng: number) => void;
}

const buildMapHtml = (
  lat: number,
  lng: number,
  zoom: number,
  markers: MarkerData[],
  route: Array<[number, number]>,
): string => {
  const markersJs = markers
    .map(m => {
      const color = m.color || (
        m.icon === 'driver' ? '#1976D2' :
        m.icon === 'restaurant' ? '#E53935' :
        m.icon === 'customer' ? '#43A047' : '#FF5722'
      );
      return `
        L.circleMarker([${m.latitude}, ${m.longitude}], {
          radius: 12,
          fillColor: '${color}',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map);
      `;
    })
    .join('\n');

  const routeJs = route.length > 1
    ? `L.polyline(${JSON.stringify(route)}, {color:'#1976D2',weight:4,opacity:0.8}).addTo(map);`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#e8e0d8}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {
    center: [${lat}, ${lng}],
    zoom: ${zoom},
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    subdomains: ['a','b','c']
  }).addTo(map);

  ${markersJs}
  ${routeJs}

  map.on('click', function(e){
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type:'press', lat:e.latlng.lat, lng:e.latlng.lng
    }));
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
</script>
</body>
</html>`;
};

const LeafletMap: React.FC<LeafletMapProps> = ({
  latitude = 18.5204,
  longitude = 73.8567,
  zoom = 14,
  markers = [],
  routeCoordinates = [],
  style,
  onMapReady,
  onLocationPress,
}) => {
  const webViewRef = useRef<WebView>(null);

  const html = buildMapHtml(latitude, longitude, zoom, markers, routeCoordinates);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') onMapReady?.();
      if (data.type === 'press') onLocationPress?.(data.lat, data.lng);
    } catch {}
  }, [onMapReady, onLocationPress]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        androidLayerType="hardware"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e8e0d8',
  },
});

export default LeafletMap;
