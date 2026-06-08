import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

export function AuthForm() {
  const { login, register, loginAnonymously } = useAuth();
  const { colors, spacing, borderRadius, typography } = useTheme();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validate = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Email validation
    if (!email) {
      setEmailError(t('errors.required'));
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t('errors.invalidEmail'));
      isValid = false;
    }

    // Password validation
    if (!password) {
      setPasswordError(t('errors.required'));
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError(t('errors.passwordMinLength'));
      isValid = false;
    }

    // Confirm password validation
    if (!isLogin) {
      if (!confirmPassword) {
        setConfirmPasswordError(t('errors.required'));
        isValid = false;
      } else if (password !== confirmPassword) {
        setConfirmPasswordError(t('errors.passwordMismatch'));
        isValid = false;
      }
    }

    return isValid;
  };

  const handleAuth = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
        Alert.alert(t('common.success'), t('auth.registerSuccess'));
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      let errMsg = t('errors.serverError');
      if (error.code === 'auth/email-already-in-use') {
        errMsg = t('errors.emailInUse');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errMsg = t('errors.invalidCredential');
      } else if (error.code === 'auth/invalid-email') {
        errMsg = t('errors.invalidEmailFormat');
      }
      Alert.alert(t('common.error'), errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setLoading(true);
    try {
      await loginAnonymously();
    } catch (error) {
      console.error('Anonymous auth error:', error);
      Alert.alert(t('common.error'), t('errors.guestLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.brandContainer}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary500 }]}>
            <Ionicons name="airplane" size={32} color={colors.neutral0} />
          </View>
          <Text style={[typography.headlineLarge, { color: colors.text, fontWeight: '800', marginTop: spacing.md }]}>
            Tour Plan
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {t('app.tagline')}
          </Text>
        </View>

        <Card style={styles.authCard} variant="elevated">
          <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '700', marginBottom: spacing.md }]}>
            {isLogin ? t('auth.login') : t('auth.createAccount')}
          </Text>

          <Input
            label={t('auth.email')}
            placeholder="example@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={emailError}
            leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textTertiary} />}
          />

          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            error={passwordError}
            containerStyle={{ marginTop: spacing.md }}
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
          />

          {!isLogin && (
            <Input
              label={t('auth.confirmPassword')}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              error={confirmPasswordError}
              containerStyle={{ marginTop: spacing.md }}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
            />
          )}

          <Button
            title={isLogin ? t('auth.login') : t('auth.register')}
            onPress={handleAuth}
            loading={loading}
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.toggleContainer}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            </Text>
            <TouchableOpacity onPress={() => {
              setIsLogin(!isLogin);
              setEmailError('');
              setPasswordError('');
              setConfirmPasswordError('');
            }}>
              <Text style={[typography.labelLarge, { color: colors.primary500, fontWeight: '600', marginLeft: spacing.xs }]}>
                {isLogin ? t('auth.register') : t('auth.login')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[typography.bodySmall, { color: colors.textTertiary, paddingHorizontal: spacing.sm }]}>
            {t('auth.or')}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Button
          title={t('auth.guestLogin')}
          variant="outlined"
          onPress={handleGuestAccess}
          loading={loading}
          style={styles.guestButton}
          leftIcon={<Ionicons name="person-outline" size={18} color={colors.primary500} />}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    minHeight: height * 0.9,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3366FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  authCard: {
    padding: 20,
    width: '100%',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  guestButton: {
    width: '100%',
  },
});
