import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { t } from '../../i18n';

interface LocationResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (location: { name: string; lat: number; lng: number; placeId: string; address: string }) => void;
  placeholder?: string;
  containerStyle?: any;
}

export function AttractionAutocomplete({ value, onChangeText, onSelect, placeholder, containerStyle }: Props) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sync internal query with external value if it changes
  useEffect(() => {
    if (value !== query && !showDropdown) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2 && showDropdown) {
        searchNominatim(query);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchNominatim = async (searchText: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'zh-TW,en-US;q=0.9',
          'User-Agent': 'TourMultiLangApp/1.0'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else if (response.status === 429) {
        setErrorMsg('搜尋請求過於頻繁（每秒最多 1 次），請稍候 3 秒後再試');
        setResults([]);
      } else {
        setErrorMsg('無法連接地圖服務，請稍後再試');
      }
    } catch (e) {
      console.warn('Nominatim search failed', e);
      setErrorMsg('網路連線異常，請檢查網路或稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: LocationResult) => {
    const mainName = item.display_name.split(',')[0];
    setQuery(mainName);
    onChangeText(mainName);
    setShowDropdown(false);
    onSelect({
      name: mainName,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      placeId: item.place_id,
    });
  };

  return (
    <View style={[{ zIndex: 10 }, containerStyle]}>
      <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
        <TextInput
          style={[styles.input, typography.bodyMedium, { color: colors.text }]}
          placeholder={placeholder || t('survey.attractions.searchPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            onChangeText(text);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary500} style={{ marginRight: spacing.sm }} />}
      </View>

      {showDropdown && (results.length > 0 || errorMsg) && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.md }]}>
          {errorMsg ? (
            <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning-outline" size={20} color={colors.error500} style={{ marginRight: 8 }} />
              <Text style={[typography.bodyMedium, { color: colors.error500, flex: 1 }]}>{errorMsg}</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.place_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.resultItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                >
                  <Ionicons name="location-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                      {item.display_name.split(',')[0]}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    height: '100%',
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  }
});
