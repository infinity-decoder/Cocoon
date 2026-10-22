/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Flashlight, SwitchCamera, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface BarcodeCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export function BarcodeCameraScannerModal({
  isOpen,
  onClose,
  onBarcodeDetected
}: BarcodeCameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  // Initialize camera stream
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let active = true;
    setErrorMsg(null);
    setIsScanning(true);

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported in this browser environment.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!active) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setErrorMsg(err.message || 'Unable to access device camera. Please enter barcode manually.');
      }
    }

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Barcode Detection loop using BarcodeDetector API if available
  useEffect(() => {
    if (!isOpen || !stream || !isScanning) return;

    let scanInterval: any;

    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || !isScanning) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0 && isScanning) {
              const detected = barcodes[0].rawValue;
              if (detected) {
                setIsScanning(false);
                triggerHapticFeedback();
                onBarcodeDetected(detected.trim());
                onClose();
              }
            }
          } catch {
            // Ignore frame detection errors
          }
        }, 200);
      } catch {
        // BarcodeDetector failed to initialize
      }
    }

    return () => {
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [isOpen, stream, isScanning, onBarcodeDetected, onClose]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && typeof (track as any).applyConstraints === 'function') {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
      } catch {
        // Torch not supported on device
      }
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    triggerHapticFeedback();
    onBarcodeDetected(manualCode.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Camera size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Barcode Scanner</h3>
                <p className="text-[11px] text-neutral-400">Scan product barcode or enter code</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Camera Viewfinder */}
          <div className="relative aspect-square sm:aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
            {errorMsg ? (
              <div className="p-6 text-center flex flex-col items-center gap-2">
                <AlertCircle className="text-amber-400" size={32} />
                <p className="text-xs text-neutral-300 font-medium">{errorMsg}</p>
                <p className="text-[11px] text-neutral-500">You can still enter the code manually below.</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Laser scan animation & reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-4/5 h-1/2 border-2 border-blue-400/60 rounded-2xl relative overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" style={{
                      animation: 'scanLine 2s ease-in-out infinite'
                    }} />
                    <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-blue-400" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-blue-400" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-blue-400" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-blue-400" />
                  </div>
                </div>

                {/* Floating camera controls */}
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-full backdrop-blur-md border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                      torchOn ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/50 text-white border-white/20 hover:bg-black/70'
                    }`}
                  >
                    <Flashlight size={16} />
                  </button>

                  <button
                    onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
                    className="p-2.5 rounded-full bg-black/50 text-white border border-white/20 backdrop-blur-md hover:bg-black/70 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <SwitchCamera size={16} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="p-4 bg-neutral-950/60 border-t border-white/10">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Type barcode or SKU manually..."
                  autoFocus={Boolean(errorMsg)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Find
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
