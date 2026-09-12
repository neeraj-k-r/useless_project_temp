import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BackgroundTorchPlugin {
  start(options: { communityId: string }): Promise<void>;
  stop(): Promise<void>;
  setForeground(options: { foreground: boolean }): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
}

const webImpl: BackgroundTorchPlugin = {
  start: async () => undefined,
  stop: async () => undefined,
  setForeground: async () => undefined,
  isRunning: async () => ({ running: false }),
};

export const BackgroundTorchNative =
  registerPlugin<BackgroundTorchPlugin>('BackgroundTorch', { web: webImpl });

export const isNativePlatform = () => Capacitor.isNativePlatform();