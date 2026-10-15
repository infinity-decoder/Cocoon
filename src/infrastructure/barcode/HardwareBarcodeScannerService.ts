/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BarcodeSource = 'CAMERA' | 'HARDWARE_WEDGE';

export interface BarcodeScanResult {
  code: string;
  format?: string;
  source: BarcodeSource;
  scannedAt: string;
}

export type BarcodeListener = (result: BarcodeScanResult) => void;

/**
 * Hardware Barcode Wedge Listener Service
 * Supports physical USB and Bluetooth wireless handheld scanners
 * operating in standard HID Keyboard Emulation Mode at retail checkout counters.
 */
export class HardwareBarcodeScannerService {
  private static instance: HardwareBarcodeScannerService;
  private listeners: Set<BarcodeListener> = new Set();
  private buffer = '';
  private lastKeyTime = 0;
  private readonly maxIntervalMs = 50; // Hardware scanners type keys within 10-30ms
  private isListening = false;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public static getInstance(): HardwareBarcodeScannerService {
    if (!HardwareBarcodeScannerService.instance) {
      HardwareBarcodeScannerService.instance = new HardwareBarcodeScannerService();
    }
    return HardwareBarcodeScannerService.instance;
  }

  public start(): void {
    if (this.isListening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown, true);
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.isListening = false;
    this.buffer = '';
  }

  public subscribe(listener: BarcodeListener): () => void {
    this.listeners.add(listener);
    if (!this.isListening) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Ignore keystrokes when user is purposefully typing in a regular text input
    const target = event.target as HTMLElement | null;
    const isEditingText =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
      !target.getAttribute('data-barcode-receiver');

    const now = Date.now();
    const interval = now - this.lastKeyTime;
    this.lastKeyTime = now;

    // Fast keystroke burst detection typical of hardware optical laser/CCD engines
    if (interval > this.maxIntervalMs && this.buffer.length > 0) {
      // Keystroke was too slow; human typing reset
      this.buffer = '';
    }

    if (event.key === 'Enter') {
      if (this.buffer.length >= 3) {
        // Valid barcode received (EAN-13, EAN-8, UPC, Code 128, QR payload)
        const scannedCode = this.buffer;
        this.buffer = '';

        if (!isEditingText) {
          event.preventDefault();
          event.stopPropagation();
        }

        const scanResult: BarcodeScanResult = {
          code: scannedCode,
          source: 'HARDWARE_WEDGE',
          scannedAt: new Date().toISOString()
        };

        this.notifyListeners(scanResult);
      }
      this.buffer = '';
      return;
    }

    // Only collect printable characters
    if (event.key.length === 1) {
      this.buffer += event.key;
    }
  }

  private notifyListeners(result: BarcodeScanResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (err) {
        console.error('Barcode listener error:', err);
      }
    }
  }
}
