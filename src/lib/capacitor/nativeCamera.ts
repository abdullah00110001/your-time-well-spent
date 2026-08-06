// Native Camera Bridge for Capacitor
import { Camera, CameraResultType, CameraSource, GalleryPhoto } from '@capacitor/camera';
import { isNative } from './platform';

export interface CapturedImage {
  dataUrl?: string;
  webPath?: string;
  path?: string;
  format: string;
  saved: boolean;
}

// Check camera permission
export async function checkCameraPermission(): Promise<string> {
  if (!isNative) return 'granted';
  
  try {
    const status = await Camera.checkPermissions();
    return status.camera;
  } catch (error) {
    console.error('[Camera] Permission check failed:', error);
    return 'prompt';
  }
}

// Request camera permission
export async function requestCameraPermission(): Promise<boolean> {
  if (!isNative) return true;
  
  try {
    const status = await Camera.requestPermissions();
    return status.camera === 'granted';
  } catch (error) {
    console.error('[Camera] Permission request failed:', error);
    return false;
  }
}

// Take a photo with camera
export async function takePhoto(options?: {
  quality?: number;
  allowEditing?: boolean;
  width?: number;
  height?: number;
}): Promise<CapturedImage | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: options?.quality ?? 90,
      allowEditing: options?.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      width: options?.width,
      height: options?.height,
      correctOrientation: true,
      saveToGallery: false,
    });

    return {
      dataUrl: photo.dataUrl,
      webPath: photo.webPath,
      path: photo.path,
      format: photo.format,
      saved: photo.saved,
    };
  } catch (error: any) {
    if (error?.message?.includes('User cancelled')) {
      console.log('[Camera] User cancelled photo capture');
      return null;
    }
    console.error('[Camera] Photo capture failed:', error);
    throw error;
  }
}

// Pick photo from gallery
export async function pickPhoto(options?: {
  quality?: number;
  allowEditing?: boolean;
  width?: number;
  height?: number;
}): Promise<CapturedImage | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: options?.quality ?? 90,
      allowEditing: options?.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      width: options?.width,
      height: options?.height,
      correctOrientation: true,
    });

    return {
      dataUrl: photo.dataUrl,
      webPath: photo.webPath,
      path: photo.path,
      format: photo.format,
      saved: photo.saved,
    };
  } catch (error: any) {
    if (error?.message?.includes('User cancelled')) {
      console.log('[Camera] User cancelled photo selection');
      return null;
    }
    console.error('[Camera] Photo selection failed:', error);
    throw error;
  }
}

// Pick multiple photos from gallery
export async function pickMultiplePhotos(limit?: number): Promise<CapturedImage[]> {
  try {
    const result = await Camera.pickImages({
      quality: 90,
      limit: limit ?? 10,
    });

    return result.photos.map((photo: GalleryPhoto) => ({
      dataUrl: undefined,
      webPath: photo.webPath,
      path: photo.path,
      format: photo.format,
      saved: false,
    }));
  } catch (error: any) {
    if (error?.message?.includes('User cancelled')) {
      console.log('[Camera] User cancelled photo selection');
      return [];
    }
    console.error('[Camera] Multiple photo selection failed:', error);
    throw error;
  }
}

// Get photo with source prompt
export async function getPhotoWithPrompt(options?: {
  quality?: number;
  allowEditing?: boolean;
}): Promise<CapturedImage | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: options?.quality ?? 90,
      allowEditing: options?.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Choose Image Source',
      promptLabelPhoto: 'From Gallery',
      promptLabelPicture: 'Take Photo',
      correctOrientation: true,
    });

    return {
      dataUrl: photo.dataUrl,
      webPath: photo.webPath,
      path: photo.path,
      format: photo.format,
      saved: photo.saved,
    };
  } catch (error: any) {
    if (error?.message?.includes('User cancelled')) {
      return null;
    }
    console.error('[Camera] Photo capture failed:', error);
    throw error;
  }
}
