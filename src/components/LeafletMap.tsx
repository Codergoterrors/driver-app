/**
 * LeafletMap — WebView-based OpenStreetMap using Leaflet.js
 * Key fix: baseUrl: 'https://localhost' allows HTTPS CDN/tile requests from the WebView
 */
import React, { useRef, useCallback } from 'react';
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

const buildMapHtml = (
  lat: number,
  lng: number,
  zoom: number,
  markers: MarkerData[],
  route: Array<[number, number]>,
): string => {
  const markersJs = markers
    .map(m => {
      const color =
        m.color ||
        (m.icon === 'driver'
          ? '#1976D2'
          : m.icon === 'restaurant'
          ? '#E53935'
          : m.icon === 'customer'
          ? '#43A047'
          : '#FF5722');
      return `
        L.circleMarker([${m.latitude}, ${m.longitude}], {
          radius: 14, fillColor: '${color}', color: '#fff',
          weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);`;
    })
    .join('\n');

  const routeJs =
    route.length > 1
      ? `L.polyline(${JSON.stringify(route)}, {color:'#1976D2',weight:5,opacity:0.8}).addTo(map);`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden}
  #map{width:100%;height:100%;background:#ddd}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
<script>
(function() {
  try {
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: ${zoom},
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    ${markersJs}
    ${routeJs}

    map.on('click', function(e) {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'press', lat: e.latlng.lat, lng: e.latlng.lng })
        );
      } catch(err) {}
    });

    setTimeout(function() {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'ready' })
        );
      } catch(err) {}
    }, 500);

  } catch(err) {
    document.getElementById('map').innerHTML =
      '<div style="padding:20px;color:red">Map error: ' + err.message + '</div>';
  }
})();
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

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready') onMapReady?.();
        if (data.type === 'press') onLocationPress?.(data.lat, data.lng);
      } catch {}
    },
    [onMapReady, onLocationPress],
  );

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        // baseUrl is CRITICAL — without it HTTPS CDN requests are blocked (null origin)
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        cacheEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#dddddd',
  },
});

export default LeafletMap;
