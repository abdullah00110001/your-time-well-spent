/** Human label for an alarm's wake-up mission, e.g. "Math ×3". */
const MISSION_NAMES: Record<string, string> = {
  photo: 'Photo',
  math: 'Math',
  shake: 'Shake',
  qr: 'QR Code',
  barcode: 'Barcode',
  typing: 'Typing',
  memory: 'Memory',
  none: 'Tap to dismiss',
};

export function missionLabel(alarm: any): string | null {
  const type = alarm?.verification_type;
  if (!type) return null;
  const name = MISSION_NAMES[type] || 'Mission';
  if (type === 'none') return name;
  const count = Number(alarm?.mission_config?.count ?? alarm?.mission_count ?? 1);
  return count > 1 ? `${name} ×${count}` : name;
}
