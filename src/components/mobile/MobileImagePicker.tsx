import { useState } from 'react';
import { Camera, Image, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { cn } from '@/lib/utils';
import { isNative } from '@/lib/capacitor/platform';

interface MobileImagePickerProps {
  onImageSelect: (dataUrl: string) => void;
  className?: string;
  placeholder?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
  maxWidth?: number;
  quality?: number;
}

export function MobileImagePicker({
  onImageSelect,
  className,
  placeholder = 'Add Photo',
  aspectRatio = 'square',
  maxWidth = 1024,
  quality = 85,
}: MobileImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { capturePhoto, selectPhoto, isLoading } = useNativeCamera();
  const { tap } = useNativeHaptics();

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
  };

  const handleCameraCapture = async () => {
    tap();
    setShowDialog(false);
    const image = await capturePhoto({ quality, width: maxWidth });
    if (image?.dataUrl) {
      setPreview(image.dataUrl);
      onImageSelect(image.dataUrl);
    }
  };

  const handleGallerySelect = async () => {
    tap();
    setShowDialog(false);
    const image = await selectPhoto({ quality, width: maxWidth });
    if (image?.dataUrl) {
      setPreview(image.dataUrl);
      onImageSelect(image.dataUrl);
    }
  };

  const handleWebSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreview(dataUrl);
      onImageSelect(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    tap();
    setPreview(null);
  };

  const openPicker = () => {
    tap();
    if (isNative) {
      setShowDialog(true);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-dashed border-border',
          'bg-muted/30 flex items-center justify-center',
          'transition-all hover:border-primary/50',
          aspectClasses[aspectRatio],
          !preview && 'cursor-pointer'
        )}
        onClick={preview ? undefined : openPicker}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Selected"
              className="w-full h-full object-cover"
            />
            <button
              onClick={clearImage}
              className={cn(
                'absolute top-2 right-2 p-2 rounded-full',
                'bg-black/50 text-white',
                'hover:bg-black/70 transition-colors'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="text-center p-4">
            {isNative ? (
              <>
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{placeholder}</p>
              </>
            ) : (
              <label className="cursor-pointer">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{placeholder}</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleWebSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Native picker dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Photo Source</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleCameraCapture}
              className="justify-start h-14"
            >
              <Camera className="h-5 w-5 mr-3" />
              Take Photo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleGallerySelect}
              className="justify-start h-14"
            >
              <Image className="h-5 w-5 mr-3" />
              Choose from Gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MobileAvatarPickerProps {
  currentImage?: string;
  onImageSelect: (dataUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MobileAvatarPicker({
  currentImage,
  onImageSelect,
  size = 'md',
  className,
}: MobileAvatarPickerProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [showDialog, setShowDialog] = useState(false);
  const { capturePhoto, selectPhoto, isLoading } = useNativeCamera();
  const { tap } = useNativeHaptics();

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const handleSelect = async (source: 'camera' | 'gallery') => {
    tap();
    setShowDialog(false);
    
    const image = source === 'camera'
      ? await capturePhoto({ quality: 90, width: 512, allowEditing: true })
      : await selectPhoto({ quality: 90, width: 512, allowEditing: true });
    
    if (image?.dataUrl) {
      setPreview(image.dataUrl);
      onImageSelect(image.dataUrl);
    }
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden border-2 border-border',
          'bg-muted flex items-center justify-center cursor-pointer',
          'hover:border-primary/50 transition-all',
          sizeClasses[size]
        )}
        onClick={() => {
          tap();
          setShowDialog(true);
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className={cn(
        'absolute -bottom-1 -right-1 p-1.5 rounded-full',
        'bg-primary text-primary-foreground border-2 border-background'
      )}>
        <Camera className="h-3 w-3" />
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSelect('camera')}
              className="justify-start h-14"
            >
              <Camera className="h-5 w-5 mr-3" />
              Take Photo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSelect('gallery')}
              className="justify-start h-14"
            >
              <Image className="h-5 w-5 mr-3" />
              Choose from Gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
