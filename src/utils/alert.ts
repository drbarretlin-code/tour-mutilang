import { Platform, Alert } from 'react-native';

export const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message);
  }
};
export const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const result = window.confirm(`${title}\n\n${message}`);
      if (result) {
        onConfirm();
      } else if (onCancel) {
        onCancel();
      }
    }
  } else {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: onCancel },
      { text: '確定', style: 'destructive', onPress: onConfirm }
    ]);
  }
};

export default showAlert;
