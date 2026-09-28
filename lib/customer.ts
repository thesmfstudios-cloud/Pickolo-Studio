export const DURATIONS = [60, 120, 180, 240, 300];
export const LEVELS = ['Basic', 'Standard', 'Professional'];
export const PHOTO_PRICES = [
  [600, 1000, 1400, 1800, 2200],
  [1000, 1500, 2000, 2500, 3000],
  [1500, 2500, 3500, 4500, 5500],
];
export const RAW_POLICY =
  'Your booking includes shoot coverage and original, unedited files. Editing, retouching and edited videos are not included. Keep a backup after delivery.';
export const RAW_POLICY_VERSION = 'raw-v1';
export function rupees(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
export function elapsedSeconds(start: string, end?: string | null, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000),
  );
}
export function timerText(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}
