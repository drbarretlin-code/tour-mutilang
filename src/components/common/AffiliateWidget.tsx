import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { t } from '../../i18n';

interface AffiliateWidgetProps {
  region: string;
  style?: object;
}

export const AffiliateWidget: React.FC<AffiliateWidgetProps> = ({ region, style }) => {
  const { colors, typography, borderRadius } = useTheme();

  // In a real application, you would map the region to a specific Klook/KKday Widget ID.
  // Example: 'Tokyo' -> Klook Widget ID 12345
  
  // Since we are mocking the implementation until keys are provided:
  const isWeb = Platform.OS === 'web';

  const mockHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 16px; font-family: -apple-system, system-ui, sans-serif; background-color: ${colors.surface}; border-radius: ${borderRadius.lg}px; border: 1px solid ${colors.border}; }
        .ad-container { display: flex; align-items: center; gap: 12px; }
        .ad-badge { background-color: #FF5B00; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .ad-title { font-size: 14px; font-weight: 700; color: ${colors.text}; margin: 0 0 4px 0; }
        .ad-desc { font-size: 12px; color: ${colors.textSecondary}; margin: 0; }
        .ad-btn { margin-left: auto; background-color: #FF5B00; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="ad-container">
        <div>
          <span class="ad-badge">KLOOK 獨家推薦</span>
          <p class="ad-title">探索 ${region} 熱門行程與交通</p>
          <p class="ad-desc">預訂熱門景點門票、JR Pass，享受專屬優惠！</p>
        </div>
        <a href="https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(region)}" target="_blank" class="ad-btn">立即查看</a>
      </div>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={colors.primary500} />
        <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6 }]}>
          {t('affiliate.sponsored', { defaultValue: '推薦行程與票券' })}
        </Text>
      </View>
      
      <View style={[styles.widgetWrapper, { borderRadius: borderRadius.lg, backgroundColor: colors.surface }]}>
        {isWeb ? (
          <iframe 
            srcDoc={mockHtmlContent}
            style={{ width: '100%', height: 100, border: 'none', borderRadius: borderRadius.lg }}
            sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
          />
        ) : (
          <WebView
            source={{ html: mockHtmlContent }}
            style={{ width: '100%', height: 100, backgroundColor: 'transparent' }}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  widgetWrapper: {
    overflow: 'hidden',
    height: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  }
});
