import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary } from '../../types/itinerary';
import { getRouteDistanceKm } from '../../utils/distance';

interface Itinerary3DMapProps {
  itinerary: Itinerary;
  activeDay: number;
  height?: number;
}

export function Itinerary3DMap({ itinerary, activeDay, height = 300 }: Itinerary3DMapProps) {
  const { colors } = useTheme();

  const dayData = itinerary.days.find(d => d.dayNumber === activeDay);
  const dayActivities = dayData?.activities || [];

  // 1. Prepare points data for Leaflet injection
  const pointsData = dayActivities.map((act, index) => {
    let label = String(index + 1);
    let isHotel = act.type === 'hotel';
    
    if (act.type === 'hotel') {
      label = 'H';
    } else if (act.type === 'transport' && (index === 0 || index === dayActivities.length - 1)) {
      label = 'A';
    }

    let distToNext = '';
    if (index < dayActivities.length - 1) {
      const nextAct = dayActivities[index + 1];
      const distKm = getRouteDistanceKm(nextAct.transport, act.location, nextAct.location);
      distToNext = `${distKm.toFixed(1)} km`;
    }

    return {
      lat: act.location?.latitude || 0,
      lng: act.location?.longitude || 0,
      label,
      title: act.title,
      time: act.startTime,
      isHotel,
      distToNext
    };
  });

  // 2. Leaflet HTML Template String
  const leafletTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #0B0F19;
    }
    /* Custom Pin style */
    .custom-marker {
      background: #4F46E5;
      border: 2px solid #FFF;
      border-radius: 50%;
      color: #FFF;
      font-weight: bold;
      text-align: center;
      line-height: 20px;
      font-size: 11px;
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-marker.hotel {
      background: #10B981;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
    }
    .custom-marker.airport {
      background: #8B5CF6;
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
    }
    /* Floating Distance Label */
    .distance-label {
      background: #1E293B;
      border: 1px solid #00D8A1;
      border-radius: 20px;
      color: #00D8A1;
      padding: 2px 8px;
      font-size: 9px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: inline-block;
      transform: translate(-50%, -50%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    /* Leaflet popup styling customization to fit dark theme */
    .leaflet-popup-content-wrapper {
      background: #1E293B !important;
      color: #FFF !important;
      border-radius: 8px;
      font-size: 13px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .leaflet-popup-tip {
      background: #1E293B !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { 
      zoomControl: false,
      attributionControl: false
    });
    
    // CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var points = __POINTS_DATA__;
    var markers = [];
    var latlngs = [];

    points.forEach(function(pt) {
      if (pt.lat === 0 && pt.lng === 0) return;
      
      var className = 'custom-marker';
      if (pt.isHotel) className += ' hotel';
      if (pt.label === 'A') className += ' airport';

      var icon = L.divIcon({
        className: className,
        html: pt.label,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      var popupHtml = '<div style="padding: 4px;">' +
        '<strong style="color: #00D8A1; font-size: 14px;">' + pt.title + '</strong>' +
        '<div style="margin-top: 6px; color: #94A3B8;">抵達時間：' + pt.time + '</div>' +
        '</div>';

      var marker = L.marker([pt.lat, pt.lng], { icon: icon })
        .bindPopup(popupHtml)
        .addTo(map);
        
      markers.push(marker);
      latlngs.push([pt.lat, pt.lng]);
    });

    if (latlngs.length > 0) {
      // Connect points with neon green dashed lines
      L.polyline(latlngs, {
        color: '#00D8A1',
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.85
      }).addTo(map);

      // Render distance labels at path midpoints
      for (var i = 0; i < latlngs.length - 1; i++) {
        var pt = points[i];
        if (pt.distToNext && pt.lat !== 0 && points[i+1].lat !== 0) {
          var midLat = (latlngs[i][0] + latlngs[i+1][0]) / 2;
          var midLng = (latlngs[i][1] + latlngs[i+1][1]) / 2;
          
          L.marker([midLat, midLng], {
            icon: L.divIcon({
              className: 'distance-label-container',
              html: '<div class="distance-label">' + pt.distToNext + '</div>',
              iconSize: [0, 0]
            })
          }).addTo(map);
        }
      }

      // Automatically adjust camera zoom boundary to cover all points
      var group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.15));
    } else {
      // Fallback center if no valid points
      map.setView([13.7563, 100.5018], 10);
    }
  </script>
</body>
</html>
  `.replace('__POINTS_DATA__', JSON.stringify(pointsData));

  // 3. Platform split rendering
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          key={`map_iframe_day_${activeDay}`}
          srcDoc={leafletTemplate}
          style={styles.webFrame}
          title="Itinerary Map"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        key={`map_webview_day_${activeDay}`}
        originWhitelist={['*']}
        source={{ html: leafletTemplate }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0B0F19',
    position: 'relative',
  },
  webFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#0B0F19',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B0F19',
  }
});

export default Itinerary3DMap;
