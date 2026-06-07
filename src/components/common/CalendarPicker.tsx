import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../i18n';

interface CalendarPickerProps {
  startDate: string;
  endDate: string;
  onSelectDates: (start: string, end: string) => void;
}

export function CalendarPicker({
  startDate,
  endDate,
  onSelectDates
}: CalendarPickerProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  
  // Current month being viewed
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDayPress = (day: number) => {
    const clickedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (!startDate || (startDate && endDate)) {
      onSelectDates(clickedDateStr, '');
    } else {
      const start = new Date(startDate);
      const clicked = new Date(clickedDateStr);
      
      if (clicked < start) {
        onSelectDates(clickedDateStr, '');
      } else {
        onSelectDates(startDate, clickedDateStr);
      }
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    daysGrid.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysGrid.push(i);
  }

  const isSelected = (day: number) => {
    if (!day) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === startDate || dateStr === endDate;
  };

  const isInRange = (day: number) => {
    if (!day || !startDate || !endDate) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(dateStr);
    return current > start && current < end;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  };

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.lg, padding: spacing.md }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
          {months[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdaysRow}>
        {weekdays.map((day, idx) => (
          <Text key={idx} style={[styles.weekdayText, typography.labelSmall, { color: colors.textTertiary }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {daysGrid.map((day, idx) => {
          if (day === null) {
            return <View key={idx} style={styles.dayCell} />;
          }

          const selected = isSelected(day);
          const inRange = isInRange(day);
          const today = isToday(day);

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleDayPress(day)}
              style={[
                styles.dayCell,
                selected && { backgroundColor: colors.primary500, borderRadius: borderRadius.sm },
                inRange && { backgroundColor: colors.primary100, opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color: selected
                      ? colors.neutral0
                      : inRange
                      ? colors.primary700
                      : colors.text,
                    fontWeight: selected || today ? '600' : '400',
                  },
                ]}
              >
                {day}
              </Text>
              {today && !selected && (
                <View style={[styles.todayDot, { backgroundColor: colors.primary500 }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: 36,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
});
