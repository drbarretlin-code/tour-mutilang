import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const MAX_TEXT_LENGTH = 10000;

export const isTextFile = (mimeType?: string, fileName?: string): boolean => {
  if (mimeType && mimeType.startsWith('text/')) return true;
  if (mimeType === 'application/json' || mimeType === 'application/xml') return true;
  
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const textExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'log', 'rtf'];
    if (ext && textExtensions.includes(ext)) return true;
  }
  return false;
};

export const readFileContent = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
  const { uri, mimeType, name, file } = asset;
  
  if (!isTextFile(mimeType, name)) {
    return `[System Note: User uploaded a binary file. File name is "${name}". Please consider this file name as a reference for the trip.]`;
  }

  try {
    let content = '';
    
    if (Platform.OS === 'web' && file) {
      // On Web, asset.file is a native HTML File object
      content = await file.text();
    } else {
      // On Native, use expo-file-system
      content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    }
    
    // Truncate if too long to save AI tokens
    if (content.length > MAX_TEXT_LENGTH) {
      return content.substring(0, MAX_TEXT_LENGTH) + '\n\n[System Note: Text truncated due to length limits]';
    }
    return content;
  } catch (error) {
    console.warn('Failed to read file text', error);
    return `[System Note: Failed to read file content. File name is "${name}"]`;
  }
};
