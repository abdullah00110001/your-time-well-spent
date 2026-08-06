import { useState, useCallback } from 'react';
import {
  checkCameraPermission,
  requestCameraPermission,
  takePhoto,
  pickPhoto,
  pickMultiplePhotos,
  getPhotoWithPrompt,
  CapturedImage
} from '@/lib/capacitor/nativeCamera';
import { Feedback } from '@/lib/capacitor/nativeHaptics';
import { showPermissionDeniedToast } from '@/lib/capacitor/openAppSettings';
import { toast } from 'sonner';

export function useNativeCamera() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastImage, setLastImage] = useState<CapturedImage | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Check permission
  const checkPermission = useCallback(async () => {
    const status = await checkCameraPermission();
    const granted = status === 'granted' || status === 'limited';
    setHasPermission(granted);
    return granted;
  }, []);

  // Request permission. MUST be called from a user gesture (button tap).
  const requestPermission = useCallback(async () => {
    try {
      const granted = await requestCameraPermission();
      setHasPermission(granted);
      if (!granted) {
        showPermissionDeniedToast({
          feature: 'Camera',
          reason: 'Camera access is needed to capture photos for your journal and wake-up proofs.',
        });
      }
      return granted;
    } catch (e) {
      console.error('[useNativeCamera] requestPermission error:', e);
      showPermissionDeniedToast({
        feature: 'Camera',
        reason: 'We could not request camera permission. Enable it manually in Settings.',
      });
      return false;
    }
  }, []);

  // Take photo with camera
  const capturePhoto = useCallback(async (options?: {
    quality?: number;
    allowEditing?: boolean;
    width?: number;
    height?: number;
  }) => {
    setIsLoading(true);
    try {
      const hasAccess = await checkPermission();
      if (!hasAccess) {
        const granted = await requestPermission();
        if (!granted) return null;
      }

      const image = await takePhoto(options);
      if (image) {
        setLastImage(image);
        Feedback.success();
      }
      return image;
    } catch (error) {
      console.error('[Camera] Capture failed:', error);
      Feedback.error();
      toast.error('Failed to capture photo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission, requestPermission]);

  // Pick from gallery
  const selectPhoto = useCallback(async (options?: {
    quality?: number;
    allowEditing?: boolean;
    width?: number;
    height?: number;
  }) => {
    setIsLoading(true);
    try {
      const hasAccess = await checkPermission();
      if (!hasAccess) {
        const granted = await requestPermission();
        if (!granted) return null;
      }

      const image = await pickPhoto(options);
      if (image) {
        setLastImage(image);
        Feedback.success();
      }
      return image;
    } catch (error) {
      console.error('[Camera] Selection failed:', error);
      Feedback.error();
      toast.error('Failed to select photo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission, requestPermission]);

  // Pick multiple from gallery
  const selectMultiplePhotos = useCallback(async (limit?: number) => {
    setIsLoading(true);
    try {
      const hasAccess = await checkPermission();
      if (!hasAccess) {
        const granted = await requestPermission();
        if (!granted) return [];
      }

      const images = await pickMultiplePhotos(limit);
      if (images.length > 0) {
        setLastImage(images[0]);
        Feedback.success();
      }
      return images;
    } catch (error) {
      console.error('[Camera] Multiple selection failed:', error);
      Feedback.error();
      toast.error('Failed to select photos');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission, requestPermission]);

  // Show prompt for camera or gallery
  const getPhoto = useCallback(async (options?: {
    quality?: number;
    allowEditing?: boolean;
    width?: number;
    height?: number;
  }) => {
    setIsLoading(true);
    try {
      const hasAccess = await checkPermission();
      if (!hasAccess) {
        const granted = await requestPermission();
        if (!granted) return null;
      }

      const image = await getPhotoWithPrompt(options);
      if (image) {
        setLastImage(image);
        Feedback.success();
      }
      return image;
    } catch (error) {
      console.error('[Camera] Get photo failed:', error);
      Feedback.error();
      toast.error('Failed to get photo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission, requestPermission]);

  // Clear last image
  const clearImage = useCallback(() => {
    setLastImage(null);
  }, []);

  return {
    isLoading,
    lastImage,
    hasPermission,
    checkPermission,
    requestPermission,
    capturePhoto,
    selectPhoto,
    selectMultiplePhotos,
    getPhoto,
    clearImage,
  };
}
