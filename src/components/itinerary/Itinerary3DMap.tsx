import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import Svg, { Line, Circle, G, Text as SvgText, Defs, Marker, Polygon } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary } from '../../types/itinerary';

function getRouteDistance(transport: any): number {
  const t = transport || { mode: 'drive', duration: 10 };
  if (t.distance > 0) {
    return t.distance / 1000;
  }
  
  // Route distance estimation based on travel duration and transport mode
  const duration = t.duration || 10; // default 10 mins
  const mode = t.mode || 'drive';
  
  let speedKmh = 40; // Default drive speed
  if (mode === 'walk') {
    speedKmh = 4.5;
  } else if (mode === 'public') {
    speedKmh = 20;
  } else if (mode === 'taxi' || mode === 'charter' || mode === 'drive') {
    speedKmh = 40;
  }
  
  return (duration / 60) * speedKmh; // distance in km
}

interface Itinerary3DMapProps {
  itinerary: Itinerary;
  activeDay: number;
  height?: number;
}

export function Itinerary3DMap({ itinerary, activeDay, height = 300 }: Itinerary3DMapProps) {
  const { colors } = useTheme();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [mapError, setMapError] = useState(false);
  const [mapSourceIndex, setMapSourceIndex] = useState(0);

  useEffect(() => {
    setMapSourceIndex(0);
    setMapError(false);
  }, [activeDay, itinerary.id]);

  const dayData = itinerary.days.find(d => d.dayNumber === activeDay);
  const dayActivities = dayData?.activities || [];
  const hotel = dayData?.hotel;

  // Simulated anchor points for an isometric perspective map
  const ANCHOR_POINTS = [
    { x: 15, y: 70 }, // Start / Hotel
    { x: 30, y: 50 }, // Point 1
    { x: 50, y: 35 }, // Point 2
    { x: 70, y: 40 }, // Point 3
    { x: 85, y: 60 }, // Point 4
    { x: 65, y: 80 }, // Point 5
    { x: 40, y: 85 }, // Point 6
    { x: 20, y: 80 }, // Point 7
  ];

  const basePoints = dayActivities.map((act, index) => {
    // Determine node label and icon color representation
    let label = String(index + 1);
    let isHotel = act.type === 'hotel';
    
    if (act.type === 'hotel') {
      label = 'H';
    } else if (act.type === 'transport' && (index === 0 || index === dayActivities.length - 1)) {
      label = 'A'; // Airport or station
    }

    return {
      ...act,
      id: act.id,
      isHotel,
      title: act.title,
      label,
      latitude: act.location?.latitude || 0,
      longitude: act.location?.longitude || 0,
      order: index,
    };
  });

  const validPts = basePoints.filter(p => p.latitude !== 0 && p.longitude !== 0);
  const hasValidCoords = validPts.length > 0;

  let routePoints = [];
  let mapImageUrls: string[] = [];

  const viewWidth = layout.width || 500;
  const viewHeight = layout.height || height;

  if (hasValidCoords) {
    let minLat = Math.min(...validPts.map(p => p.latitude));
    let maxLat = Math.max(...validPts.map(p => p.latitude));
    let minLng = Math.min(...validPts.map(p => p.longitude));
    let maxLng = Math.max(...validPts.map(p => p.longitude));

    if (maxLat - minLat < 0.005) {
      maxLat += 0.0025;
      minLat -= 0.0025;
    }
    if (maxLng - minLng < 0.005) {
      maxLng += 0.0025;
      minLng -= 0.0025;
    }

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    
    // Add 15% margin padding
    const marginLatMax = maxLat + latSpan * 0.15;
    const marginLatMin = minLat - latSpan * 0.15;
    const marginLngMax = maxLng + lngSpan * 0.15;
    const marginLngMin = minLng - lngSpan * 0.15;

    // Source 1: OpenStreetMap Static Map (de)
    const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?bbox=${marginLngMin},${marginLatMin},${marginLngMax},${marginLatMax}&size=650x450&maptype=mapnik`;
    
    // Source 2: Yandex Static Map
    const yandexUrl = `https://static-maps.yandex.ru/1.x/?l=map&size=650,450&bbox=${marginLngMin},${marginLatMin}~${marginLngMax},${marginLatMax}`;

    mapImageUrls = [osmUrl, yandexUrl];

    routePoints = basePoints.map((pt) => {
      const lat = pt.latitude || (maxLat + minLat) / 2;
      const lng = pt.longitude || (maxLng + minLng) / 2;
      
      const x = ((lng - marginLngMin) / (marginLngMax - marginLngMin)) * viewWidth;
      const y = viewHeight - ((lat - marginLatMin) / (marginLatMax - marginLatMin)) * viewHeight;

      return {
        ...pt,
        x,
        y,
      };
    });
  } else {
    // Fallback to isometric ANCHOR_POINTS mapping
    routePoints = basePoints.map((pt, index) => {
      const base = ANCHOR_POINTS[index % ANCHOR_POINTS.length];
      return {
        ...pt,
        x: (base.x / 100) * viewWidth,
        y: (base.y / 100) * viewHeight,
      };
    });
  }

  const currentMapUrl = mapImageUrls[mapSourceIndex] || itinerary.mapImageUrl;

  return (
    <View 
      style={[styles.container, { height, backgroundColor: colors.backgroundSecondary }]}
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
    >
      <Image
        source={(currentMapUrl && !mapError) ? { uri: currentMapUrl } : require('../../../assets/images/isometric_map_pattaya.png')}
        style={styles.mapImage}
        resizeMode="cover"
        onError={() => {
          if (mapSourceIndex < mapImageUrls.length - 1) {
            console.warn(`[Itinerary3DMap] Failed to load map source ${mapSourceIndex}, trying next source...`);
            setMapSourceIndex(prev => prev + 1);
          } else {
            console.warn('[Itinerary3DMap] All static map sources failed, falling back to isometric map.');
            setMapError(true);
          }
        }}
      />
      
      {/* Decorative gradient overlay */}
      <View style={styles.gradient} />

      {/* Dynamic SVG Route Layer */}
      {routePoints.length > 0 && (
        <Svg 
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          width="100%" 
          height="100%" 
          style={[StyleSheet.absoluteFill, { zIndex: 10, pointerEvents: 'none' }]}
        >
          <Defs>
            <Marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <Polygon points="0,0 10,5 0,10" fill={colors.primary500} />
            </Marker>
            <Marker id="arrow-green" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <Polygon points="0,0 10,5 0,10" fill="#10B981" />
            </Marker>
          </Defs>

          {/* Draw connecting lines with dashed style and arrows */}
          {routePoints.map((p, i) => {
            if (i === routePoints.length - 1) return null;
            const nextP = routePoints[i + 1];
            const markerId = p.isHotel || nextP.isHotel ? 'url(#arrow-green)' : 'url(#arrow)';
            return (
              <Line
                key={`line-${p.id}-${nextP.id}`}
                x1={p.x} y1={p.y}
                x2={nextP.x} y2={nextP.y}
                stroke={p.isHotel || nextP.isHotel ? '#10B981' : colors.primary500}
                strokeWidth="2.5"
                strokeDasharray="6, 4"
                markerEnd={markerId}
              />
            );
          })}

          {/* Draw distance badges exactly at the midpoint of each connecting line */}
          {routePoints.map((p, i) => {
            if (i === routePoints.length - 1) return null;
            const nextP = routePoints[i + 1];
            const midX = (p.x + nextP.x) / 2;
            const midY = (p.y + nextP.y) / 2;

            // Get route distance using AI suggested distance or road duration-based route estimation
            const distKm = getRouteDistance(nextP.transport);
            const distStr = `${distKm.toFixed(1)} km`;

            return (
              <G key={`dist-${p.id}-${nextP.id}`}>
                <rect
                  x={midX - 25}
                  y={midY - 9}
                  width="50"
                  height="18"
                  rx="9"
                  fill="#1E293B"
                  stroke={p.isHotel || nextP.isHotel ? '#10B981' : '#4F46E5'}
                  strokeWidth="1"
                />
                <SvgText
                  x={midX}
                  y={midY + 4}
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {distStr}
                </SvgText>
              </G>
            );
          })}

          {/* Draw pins, glowing rings, and sequence numbers */}
          {routePoints.map((p, i) => (
            <G key={`node-${p.id}`} x={p.x} y={p.y}>
              <Circle cx="0" cy="0" r="14" fill={p.isHotel ? '#10B981' : colors.primary500} opacity="0.2" />
              <Circle cx="0" cy="0" r="9" fill={colors.backgroundSecondary} stroke={p.isHotel ? '#10B981' : colors.primary500} strokeWidth="2" />
              <SvgText
                x="0" y="3.5"
                fill={p.isHotel ? '#10B981' : colors.primary500}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.label}
              </SvgText>
            </G>
          ))}
        </Svg>
      )}


      <View style={[styles.hud, { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: 'rgba(255,255,255,0.1)' }]}>
        <Text style={styles.hudText}>
          Day {activeDay} - {itinerary.days.find(d => d.dayNumber === activeDay)?.title || 'Exploring Thailand'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }], // Slight zoom for depth effect
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(15, 23, 42, 0.2)', // Simple fallback for gradient
  },
  hud: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  hudText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Itinerary3DMap;
