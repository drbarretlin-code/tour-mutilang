import React, { useState } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import Svg, { Line, Circle, G, Text as SvgText, Defs, Marker, Polygon } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { Itinerary } from '../../types/itinerary';

interface Itinerary3DMapProps {
  itinerary: Itinerary;
  activeDay: number;
  height?: number;
}

export function Itinerary3DMap({ itinerary, activeDay, height = 300 }: Itinerary3DMapProps) {
  const { colors } = useTheme();
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const dayActivities = itinerary.days.find(d => d.dayNumber === activeDay)?.activities || [];

  // Simulated anchor points for an isometric perspective map
  const ANCHOR_POINTS = [
    { x: 30, y: 60 },
    { x: 50, y: 40 },
    { x: 70, y: 45 },
    { x: 80, y: 70 },
    { x: 50, y: 85 },
    { x: 20, y: 80 },
  ];

  const routePoints = dayActivities.map((act, index) => {
    const base = ANCHOR_POINTS[index % ANCHOR_POINTS.length];
    return {
      x: (base.x / 100) * layout.width,
      y: (base.y / 100) * layout.height,
      order: index + 1,
      title: act.title,
    };
  });

  return (
    <View 
      style={[styles.container, { height, backgroundColor: colors.backgroundSecondary }]}
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
    >
      <Image
        source={itinerary.mapImageUrl ? { uri: itinerary.mapImageUrl } : require('../../../assets/images/isometric_map_pattaya.png')}
        style={styles.mapImage}
        resizeMode="cover"
      />
      
      {/* Decorative gradient overlay */}
      <View style={styles.gradient} />

      {/* Dynamic SVG Route Layer */}
      {layout.width > 0 && routePoints.length > 0 && (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <Polygon points="0,0 10,5 0,10" fill={colors.primary500} />
            </Marker>
          </Defs>

          {/* Draw connecting lines with dashed style and arrows */}
          {routePoints.map((p, i) => {
            if (i === routePoints.length - 1) return null;
            const nextP = routePoints[i + 1];
            return (
              <Line
                key={`line-${i}`}
                x1={p.x} y1={p.y}
                x2={nextP.x} y2={nextP.y}
                stroke={colors.primary500}
                strokeWidth="2.5"
                strokeDasharray="6, 4"
                markerEnd="url(#arrow)"
              />
            );
          })}

          {/* Draw pins, glowing rings, and sequence numbers */}
          {routePoints.map((p, i) => (
            <G key={`node-${i}`} x={p.x} y={p.y}>
              <Circle cx="0" cy="0" r="14" fill={colors.primary500} opacity="0.2" />
              <Circle cx="0" cy="0" r="9" fill={colors.backgroundSecondary} stroke={colors.primary500} strokeWidth="2" />
              <SvgText
                x="0" y="3.5"
                fill={colors.primary500}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.order}
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
