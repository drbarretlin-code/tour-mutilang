import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCount: number;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorCount: 0
  };

  // Only return the partial state needed to trigger the fallback UI.
  // Do not override errorCount here, as it is managed in componentDidCatch.
  public static getDerivedStateFromError(_: Error): Partial<State> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SafeErrorBoundary caught a rendering error:', error, errorInfo);
    
    if (Platform.OS === 'web') {
      const nextErrorCount = this.state.errorCount + 1;
      this.setState({ errorCount: nextErrorCount });

      if (nextErrorCount < 3) {
        // Wait 100ms and reset error state to force a clean client-side re-mount
        setTimeout(() => {
          this.setState({ hasError: false });
        }, 100);
      } else {
        // If it fails repeatedly, trigger a hard page reload once as a last resort
        const reloadCountKey = 'app_crash_reload_count';
        const reloadCount = parseInt(sessionStorage.getItem(reloadCountKey) || '0', 10);
        if (reloadCount < 1) {
          sessionStorage.setItem(reloadCountKey, (reloadCount + 1).toString());
          window.location.reload();
        }
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#3366FF" />
          <Text style={styles.text}>Loading...</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    ...Platform.select({
      web: {
        minHeight: '100vh',
        width: '100%'
      } as any,
      default: {}
    })
  },
  text: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
