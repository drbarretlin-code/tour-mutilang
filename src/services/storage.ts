import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const storageService = {
  /**
   * Uploads a file from a local URI to Firebase Storage
   * @param localUri Local file URI (from image picker or document picker)
   * @param path Remote path in Storage bucket (e.g. 'users/uid/surveys/surveyId/image.jpg')
   * @param mimeType Optional MIME type for content-type metadata
   * @returns Promise resolving to the download URL
   */
  async uploadFile(localUri: string, path: string, mimeType?: string): Promise<string> {
    try {
      // Convert local URI to Blob (React Native standard method)
      const response = await fetch(localUri);
      const blob = await response.blob();

      const storageRef = ref(storage, path);
      const metadata = mimeType ? { contentType: mimeType } : undefined;

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Can calculate progress here if needed
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress}% done`);
          },
          (error) => {
            console.warn('Firebase Storage upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (urlError) {
              reject(urlError);
            }
          }
        );
      });
    } catch (error) {
      console.warn('storageService uploadFile error:', error);
      throw error;
    }
  },

  /**
   * Deletes a file from Firebase Storage
   * @param downloadUrl The full download URL of the file to delete
   */
  async deleteFile(downloadUrl: string): Promise<void> {
    try {
      const fileRef = ref(storage, downloadUrl);
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Firebase Storage deleteFile error:', error);
      throw error;
    }
  }
};
export default storageService;
