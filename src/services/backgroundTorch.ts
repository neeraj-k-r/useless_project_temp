import { BackgroundTorchNative, isNativePlatform, BackgroundTorchStatus } from '../capacitor/backgroundTorch';

/**
 * Controls the native Android foreground torch service.
 * On browsers (non-native) every call is a safe no-op.
 */
export async function enableBackgroundTorch(communityId: string): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    await BackgroundTorchNative.start({ communityId });
    return true;
  } catch (e) {
    return false;
  }
}

export async function disableBackgroundTorch(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await BackgroundTorchNative.stop();
  } catch (e) {}
}

export async function isBackgroundTorchRunning(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const r = await BackgroundTorchNative.isRunning();
    return !!r.running;
  } catch (e) {
    return false;
  }
}

export async function getBackgroundTorchStatus(): Promise<BackgroundTorchStatus> {
  if (!isNativePlatform()) return { running: false, lastAction: '', lastError: '', torchOn: false };
  try {
    return await BackgroundTorchNative.getStatus();
  } catch (e) {
    return { running: false, lastAction: '', lastError: '', torchOn: false };
  }
}

/**
 * Tells the native service whether the app's WebView is visible.
 * While foregrounded, the web layer handles flashing itself; the service
 * skips hardware effects to avoid double-driving the same LED.
 */
export async function syncForegroundState(foreground: boolean): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await BackgroundTorchNative.setForeground({ foreground });
  } catch (e) {}
}