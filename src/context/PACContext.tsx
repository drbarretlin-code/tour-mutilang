import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { PACEngine, PACState } from '../services/pac';
import { useTheme } from './ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface PACContextType {
  pacState: PACState;
}

const PACContext = createContext<PACContextType | undefined>(undefined);

export function PACProvider({ children }: { children: ReactNode }) {
  const [pacState, setPacState] = useState<PACState>(PACEngine.getState());

  useEffect(() => {
    const unsubscribe = PACEngine.subscribe((state) => {
      setPacState(state);
    });
    return unsubscribe;
  }, []);

  return (
    <PACContext.Provider value={{ pacState }}>
      {children}
      <PACStatusBar state={pacState} />
    </PACContext.Provider>
  );
}

export function usePAC() {
  const context = useContext(PACContext);
  if (!context) {
    throw new Error('usePAC must be used within a PACProvider');
  }
  return context;
}

// Highly aesthetic, micro-animated PAC status indicator
function PACStatusBar({ state }: { state: PACState }) {
  const { colors, spacing, borderRadius } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Compute visibility
  const showBanner =
    state.network !== 'online' ||
    state.healing !== 'stable' ||
    state.pendingTasksCount > 0 ||
    state.cpuMode === 'power-saving';

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showBanner ? 0 : -120,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web', // Native Driver is safe for iOS/Android
    }).start();
  }, [showBanner]);

  // Determine banner styles based on PAC Engine State
  const getBannerConfig = () => {
    if (state.network === 'offline') {
      return {
        bg: colors.error50,
        border: colors.error200,
        text: colors.error700,
        icon: 'cloud-offline-outline',
        msg: `離線模式：操作已排入緩衝佇列（${state.pendingTasksCount} 筆待同步）`,
      };
    }
    if (state.healing === 'degraded') {
      return {
        bg: colors.warning50,
        border: colors.warning300,
        text: colors.warning800,
        icon: 'warning-outline',
        msg: '連線降級：正以本地離線服務接管運作',
      };
    }
    if (state.healing === 'healing') {
      return {
        bg: colors.primary50,
        border: colors.primary200,
        text: colors.primary700,
        icon: 'sync-outline',
        msg: '自主修復：正在嘗試重新建立安全網路連線...',
      };
    }
    if (state.cpuMode === 'power-saving') {
      return {
        bg: colors.backgroundSecondary,
        border: colors.border,
        text: colors.textSecondary,
        icon: 'options-outline',
        msg: '效能最佳化：資料寫入非同步防抖緩衝中...',
      };
    }
    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: config.bg,
          borderColor: config.border,
          borderRadius: borderRadius.md,
          margin: spacing.md,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={config.icon as any} size={18} color={config.text} style={styles.icon} />
        <Text style={[styles.text, { color: config.text }]} numberOfLines={2}>
          {config.msg}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 12,
    left: 8,
    right: 8,
    zIndex: 9999,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
