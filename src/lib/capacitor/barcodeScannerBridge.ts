import { Capacitor, registerPlugin } from '@capacitor/core';

// ============================================================
// PLUGIN INTERFACE
// ============================================================
export interface NativeBarcodeScannerPlugin {
  scan(options?: {
    targetBarcode?: string;
    anyBarcode?: boolean;
  }): Promise<{
    success: boolean;
    value: string | null;
    error: string | null;
  }>;
}

const NativeBarcodeScanner =
  registerPlugin<NativeBarcodeScannerPlugin>('NativeBarcodeScanner');

const isNative = Capacitor.isNativePlatform();

// ============================================================
// SCAN — main function
// ============================================================

/**
 * Barcode scan করো।
 *
 * @param targetBarcode — match করার barcode (optional)
 *   দিলে: exact match হলেই success
 *   না দিলে: যেকোনো barcode scan হলেই success
 *
 * @returns { success, value, error }
 */
export const scanBarcode = async (
  targetBarcode?: string
): Promise<{ success: boolean; value: string | null; error: string | null }> => {

  // Web fallback — development এ prompt দিয়ে simulate করো
  if (!isNative) {
    const simulated = window.prompt(
      targetBarcode
        ? `Barcode Scanner (Web Simulation)\nTarget: "${targetBarcode}"\nEnter barcode value:`
        : 'Barcode Scanner (Web Simulation)\nEnter any barcode value:'
    );

    if (simulated === null) {
      return { success: false, value: null, error: 'cancelled' };
    }

    if (targetBarcode) {
      const match = simulated.trim().toLowerCase() === targetBarcode.trim().toLowerCase();
      return match
        ? { success: true,  value: simulated, error: null }
        : { success: false, value: null, error: 'barcode_mismatch' };
    }

    return simulated.trim()
      ? { success: true,  value: simulated, error: null }
      : { success: false, value: null, error: 'empty_scan' };
  }

  // Native
  try {
    const result = await NativeBarcodeScanner.scan({
      targetBarcode: targetBarcode ?? undefined,
      anyBarcode:    !targetBarcode,
    });
    return result;
  } catch (e: any) {
    console.error('[BarcodeScanner] scan failed', e);
    return {
      success: false,
      value:   null,
      error:   e?.message ?? 'scan_failed',
    };
  }
};

// ============================================================
// HELPERS
// ============================================================

/** Barcode mismatch কিনা check করো */
export const isBarcodeMismatch = (error: string | null): boolean =>
  error === 'barcode_mismatch';

/** User cancel করেছে কিনা */
export const isScanCancelled = (error: string | null): boolean =>
  error === 'cancelled';
