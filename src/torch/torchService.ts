/**
 * Hardware Torch / Flashlight Service
 * Uses Web MediaStream ImageCapture / Track constraints for rear camera torch.
 * Designed modularly so it can be swapped with Android native CameraManager if needed.
 */

type TorchStateListener = (isOn: boolean, isBlinking: boolean, isHardware: boolean) => void;

class TorchService {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private isTorchOnState: boolean = false;
  private isBlinkingState: boolean = false;
  private isHardwareSupported: boolean | null = null;
  private permissionGranted: boolean = false;
  private activeSequenceId: number = 0;
  private listeners: Set<TorchStateListener> = new Set();

  /**
   * Subscribe to torch state changes (useful for UI feedback and screen flash fallback)
   */
  public subscribe(listener: TorchStateListener): () => void {
    this.listeners.add(listener);
    listener(this.isTorchOnState, this.isBlinkingState, this.isHardwareSupported ?? false);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.isTorchOnState, this.isBlinkingState, this.isHardwareSupported ?? false));
  }

  /**
   * Check if web torch API is theoretically supported in current browser
   */
  public isTorchSupported(): boolean {
    if (this.isHardwareSupported !== null) {
      return this.isHardwareSupported;
    }
    return Boolean(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Request user permission and initialize rear camera video track
   */
  public async requestTorchAccess(): Promise<{ supported: boolean; error?: string }> {
    try {
      if (!this.isTorchSupported()) {
        this.isHardwareSupported = false;
        this.notify();
        return { supported: false, error: 'Web media devices not supported in this browser' };
      }

      // If already initialized and track is active
      if (this.videoTrack && this.videoTrack.readyState === 'live') {
        this.permissionGranted = true;
        return { supported: this.isHardwareSupported ?? true };
      }

      // Request rear camera stream (environment facing mode)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' }
        }
      });

      this.mediaStream = stream;
      const track = stream.getVideoTracks()[0];

      if (!track) {
        this.isHardwareSupported = false;
        this.notify();
        return { supported: false, error: 'No video track found' };
      }

      this.videoTrack = track;
      this.permissionGranted = true;

      // Check capabilities for 'torch'
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      
      // Some browsers have torch in capabilities or allow applying it
      const hasTorch = Boolean(capabilities.torch || 'torch' in capabilities);
      
      this.isHardwareSupported = hasTorch;
      this.notify();

      return { supported: hasTorch };
    } catch (err: any) {
      this.isHardwareSupported = false;
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission was denied' 
        : err.message || 'Camera access error';
      return { supported: false, error: errorMsg };
    }
  }

  /**
   * Turn physical torch ON
   */
  public async turnTorchOn(): Promise<boolean> {
    this.activeSequenceId++;
    const currentSeq = this.activeSequenceId;
    this.isBlinkingState = false;
    this.isTorchOnState = true;
    this.notify();

    if (this.videoTrack && this.videoTrack.readyState === 'live') {
      try {
        await (this.videoTrack as any).applyConstraints({
          advanced: [{ torch: true }]
        });
        return true;
      } catch (e) {}
    } else {
      try {
        await this.requestTorchAccess();
        if (this.videoTrack && this.videoTrack.readyState === 'live') {
          await (this.videoTrack as any).applyConstraints({
            advanced: [{ torch: true }]
          });
        }
      } catch (e) {}
    }

    return true;
  }

  /**
   * Turn physical torch OFF
   */
  public async turnTorchOff(): Promise<boolean> {
    this.activeSequenceId++; // cancel any ongoing blink loop
    this.isBlinkingState = false;
    this.isTorchOnState = false;
    this.notify();

    try {
      if (this.videoTrack && this.videoTrack.readyState === 'live') {
        await (this.videoTrack as any).applyConstraints({
          advanced: [{ torch: false }]
        });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Blink pattern helper
   */
  private async setTrackTorch(on: boolean): Promise<void> {
    if (this.videoTrack && this.videoTrack.readyState === 'live') {
      try {
        await (this.videoTrack as any).applyConstraints({
          advanced: [{ torch: on }]
        });
      } catch (e) {}
    }
  }

  /**
   * Execute Blink x 3 -> Solid ON signal for verified outage
   */
  public async blinkThenSolidOn(blinks: number = 3, intervalMs: number = 400): Promise<void> {
    this.activeSequenceId++;
    const seq = this.activeSequenceId;
    this.isBlinkingState = true;
    this.isTorchOnState = true;
    this.notify();

    // Attempt physical camera access silently if possible
    if (!this.videoTrack || this.videoTrack.readyState !== 'live') {
      try {
        await this.requestTorchAccess();
      } catch (e) {}
    }

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < blinks; i++) {
      if (this.activeSequenceId !== seq) return; // aborted

      // Turn ON
      this.isBlinkingState = true;
      this.isTorchOnState = true;
      this.notify();
      await this.setTrackTorch(true);
      await sleep(intervalMs);

      if (this.activeSequenceId !== seq) return;

      // Turn OFF
      this.isBlinkingState = true;
      this.isTorchOnState = false;
      this.notify();
      await this.setTrackTorch(false);
      await sleep(intervalMs);
    }

    if (this.activeSequenceId === seq) {
      // Final state: SOLID ON
      this.isBlinkingState = false;
      this.isTorchOnState = true;
      this.notify();
      await this.setTrackTorch(true);
    }
  }

  /**
   * Release camera stream & resources completely
   */
  public releaseTorch(): void {
    this.activeSequenceId++;
    this.turnTorchOff();
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.isTorchOnState = false;
    this.isBlinkingState = false;
    this.notify();
  }

  public getStatus() {
    return {
      isOn: this.isTorchOnState,
      isBlinking: this.isBlinkingState,
      isSupported: this.isHardwareSupported,
      hasPermission: this.permissionGranted
    };
  }
}

export const torchService = new TorchService();
