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
      if (distKm > 0) distToNext = `${distKm.toFixed(1)} km`;
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

  const routeGeometryData = dayData?.routeGeometry ? dayData.routeGeometry : 'null';

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
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #0B0F19;
      overflow: hidden;
    }
    #map-container {
      width: 100%;
      height: 100%;
      perspective: 1000px;
      overflow: hidden;
      background: #0B0F19;
    }
    #map {
      width: 100%;
      height: 100%;
      background: #0B0F19;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }
    #map.tilt-active {
      transform: rotateX(50deg) scale(1.3) translateY(-6%);
    }
    
    /* Custom Pin style - transparent wrapper to keep leaflet positioning intact */
    .custom-marker {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .marker-inner {
      width: 24px;
      height: 24px;
      background: #4F46E5;
      border: 2px solid #FFF;
      border-radius: 50%;
      color: #FFF;
      font-weight: bold;
      text-align: center;
      line-height: 20px;
      font-size: 11px;
      box-shadow: 0 0 12px rgba(79, 70, 229, 0.8);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .custom-marker.hotel .marker-inner {
      background: #10B981;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
    }
    .custom-marker.airport .marker-inner {
      background: #8B5CF6;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.8);
    }
    
    /* Stand markers upright when map is tilted */
    #map.tilt-active .marker-inner {
      transform: rotateX(-50deg) translateZ(12px);
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
      box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 8px rgba(0, 216, 161, 0.4);
      display: inline-block;
      transform: translate(-50%, -50%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }
    
    #map.tilt-active .distance-label {
      transform: rotateX(-50deg) translate(-50%, -50%) translateZ(10px);
    }
    
    /* Leaflet popup styling customization to fit dark theme */
    .leaflet-popup-content-wrapper {
      background: #1E293B !important;
      color: #FFF !important;
      border-radius: 12px;
      font-size: 13px;
      border: 1px solid rgba(0, 216, 161, 0.3);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(0, 216, 161, 0.2) !important;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }
    .leaflet-popup-tip {
      background: #1E293B !important;
      border: 1px solid rgba(0, 216, 161, 0.3);
    }
    
    #map.tilt-active .leaflet-popup-content-wrapper,
    #map.tilt-active .leaflet-popup-tip-container {
      transform: rotateX(-50deg);
    }

    /* SVG filters for neon route line glows */
    .neon-line {
      filter: url(#neon-glow-cyan);
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .neon-line-fallback {
      filter: url(#neon-glow-pink);
      stroke-linejoin: round;
      stroke-linecap: round;
    }
  </style>
</head>
<body>
  <!-- SVG filters definition -->
  <svg style="position: absolute; width: 0; height: 0;" width="0" height="0">
    <defs>
      <filter id="neon-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
        <feMerge>
          <feMergeNode in="blur2" />
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="neon-glow-pink" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
        <feMerge>
          <feMergeNode in="blur2" />
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>

  <div id="map-container">
    <div id="map"></div>
  </div>
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

    // 2D / 3D Mode Toggle Control
    var TiltControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function(map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-tilt-control');
        container.style.backgroundColor = '#1E293B';
        container.style.border = '1px solid #00D8A1';
        container.style.borderRadius = '8px';
        container.style.cursor = 'pointer';
        container.style.width = '36px';
        container.style.height = '36px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.boxShadow = '0 0 10px rgba(0, 216, 161, 0.3)';
        container.style.transition = 'all 0.3s ease';
        
        container.innerHTML = '<span style="color: #00D8A1; font-weight: 800; font-size: 11px; font-family: sans-serif;">3D</span>';
        
        var active = false;
        L.DomEvent.on(container, 'click', function(e) {
          L.DomEvent.stopPropagation(e);
          active = !active;
          var mapDiv = document.getElementById('map');
          if (active) {
            mapDiv.classList.add('tilt-active');
            container.style.borderColor = '#FF007F';
            container.style.boxShadow = '0 0 10px rgba(255, 0, 127, 0.5)';
            container.innerHTML = '<span style="color: #FF007F; font-weight: 800; font-size: 11px; font-family: sans-serif;">2D</span>';
          } else {
            mapDiv.classList.remove('tilt-active');
            container.style.borderColor = '#00D8A1';
            container.style.boxShadow = '0 0 10px rgba(0, 216, 161, 0.3)';
            container.innerHTML = '<span style="color: #00D8A1; font-weight: 800; font-size: 11px; font-family: sans-serif;">3D</span>';
          }
        });
        return container;
      }
    });
    map.addControl(new TiltControl());

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
        html: '<div class="marker-inner">' + pt.label + '</div>',
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
      // Automatically adjust camera zoom boundary to cover all points
      var group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.15));

      var distanceLabelLayer = L.layerGroup().addTo(map);

      // 在指定線段中點放置一個距離標籤（沿線顯示真實道路里程，無資料時退回直線估算值）。
      function addDistanceLabel(fromLL, toLL, text) {
        if (!text) return;
        var midLat = (fromLL[0] + toLL[0]) / 2;
        var midLng = (fromLL[1] + toLL[1]) / 2;
        L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'distance-label-container',
            html: '<div class="distance-label">' + text + '</div>',
            iconSize: [0, 0]
          })
        }).addTo(distanceLabelLayer);
      }

      // 退回方案：直線連接 + 直線距離標籤（OSRM 取得失敗時使用）。
      function drawStraightFallback() {
        L.polyline(latlngs, {
          color: '#FF007F', // Neon Pink
          weight: 3.5,
          dashArray: '6, 6',
          opacity: 0.85,
          className: 'neon-line-fallback'
        }).addTo(map);
        for (var i = 0; i < latlngs.length - 1; i++) {
          var pt = points[i];
          if (pt.distToNext && pt.lat !== 0 && points[i+1].lat !== 0) {
            addDistanceLabel(latlngs[i], latlngs[i+1], pt.distToNext);
          }
        }
      }

      // 優先：載入快取的 OSRM 貼地幾何（100% 離線）；若無快取才發起網路請求。
      function drawRoute(route) {
        // GeoJSON 為 [lng, lat]，Leaflet 需要 [lat, lng]
        var routeLatLngs = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        L.polyline(routeLatLngs, {
          color: '#00E5FF', // Neon Cyan
          weight: 4,
          opacity: 0.9,
          className: 'neon-line'
        }).addTo(map);

        // 各段（leg）真實道路里程標於兩節點中點
        var legs = route.legs || [];
        for (var i = 0; i < latlngs.length - 1; i++) {
          var text = '';
          if (legs[i] && typeof legs[i].distance === 'number') {
            text = (legs[i].distance / 1000).toFixed(1) + ' km';
          } else {
            text = points[i].distToNext;
          }
          if (latlngs[i][0] !== 0 && latlngs[i+1][0] !== 0) {
            addDistanceLabel(latlngs[i], latlngs[i+1], text);
          }
        }
      }

      var cachedRoute = ${routeGeometryData};

      if (cachedRoute && cachedRoute.geometry && cachedRoute.geometry.coordinates) {
        // 載入已快取的 OSRM 離線 GeoJSON
        drawRoute(cachedRoute);
      } else if (latlngs.length >= 2) {
        // 退回即時查詢 (若無快取)
        var coordStr = latlngs.map(function(ll) { return ll[1] + ',' + ll[0]; }).join(';');
        var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + coordStr +
          '?overview=full&geometries=geojson&steps=false';

        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 7000);

        fetch(osrmUrl, { signal: controller.signal })
          .then(function(res) { return res.ok ? res.json() : null; })
          .then(function(data) {
            clearTimeout(timer);
            var route = data && data.routes && data.routes[0];
            if (!route || !route.geometry || !route.geometry.coordinates) {
              drawStraightFallback();
              return;
            }
            drawRoute(route);
          })
          .catch(function() {
            clearTimeout(timer);
            drawStraightFallback();
          });
      } else {
        drawStraightFallback();
      }
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
