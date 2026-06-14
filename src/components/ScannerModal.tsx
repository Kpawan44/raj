import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  QrCode, 
  Scan, 
  ChevronRight, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { JobCard } from '../types';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCards: JobCard[];
  onSelectJobCard: (jobCardNo: string) => void;
}

export default function ScannerModal({ isOpen, onClose, jobCards, onSelectJobCard }: ScannerModalProps) {
  const [selectedJobNo, setSelectedJobNo] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  
  if (!isOpen) return null;

  // Synthesize a clean electronic beep on scan success
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime); // high-pitch beep
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); // rapid decay
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context blocked by browser permission policy", e);
    }
  };

  const handleSimulateScan = (jobNo: string) => {
    if (!jobNo) return;
    setIsScanning(true);
    setScannedResult(null);

    // Run custom scanning screen animation
    setTimeout(() => {
      setIsScanning(false);
      setScannedResult(jobNo);
      playBeep();
      
      // Delay auto-transition slightly to let user appreciate the scanning outcome
      setTimeout(() => {
        onSelectJobCard(jobNo);
        onClose();
        setScannedResult(null);
        setSelectedJobNo('');
      }, 700);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-[#3B82F6]" />
            <h3 className="font-sans font-bold text-base text-white">
              Simulated Barcode / QR Scanner
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Laser Sight Scanning Viewport */}
        <div className="relative aspect-video bg-black flex flex-col items-center justify-center overflow-hidden border-b border-slate-800 p-4 bg-slate-950">
          
          {/* Mock Camera Guide brackets */}
          <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-slate-600 rounded-tl-md" />
          <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-slate-600 rounded-tr-md" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-slate-600 rounded-bl-md" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-slate-600 rounded-br-md" />

          {/* Sizzling Red Laser scan line */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10 animate-[bounce_1.5s_infinite]" />
          )}

          {isScanning ? (
            <div className="text-center animate-pulse">
              <QrCode className="h-16 w-16 text-slate-400 mx-auto" />
              <p className="text-xs text-red-400 font-mono mt-3 uppercase tracking-widest font-bold">
                Analyzing matrix...
              </p>
            </div>
          ) : scannedResult ? (
            <div className="text-center text-emerald-400 animate-bounce">
              <QrCode className="h-16 w-16 mx-auto" />
              <p className="text-xs font-mono font-bold mt-2 uppercase tracking-wide text-emerald-500">
                ✔️ SCAN CODE SUCCESS: {scannedResult}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <QrCode className="h-14 w-14 text-slate-700 mx-auto" />
              <p className="text-xs text-slate-500 font-sans mt-3">
                Select a physical job card below to align to scanner
              </p>
            </div>
          )}
        </div>

        {/* Input Selector & Stimulation Controller */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">
              Select Job Card to Align
            </label>
            <div className="flex gap-2">
              <select
                value={selectedJobNo}
                onChange={(e) => setSelectedJobNo(e.target.value)}
                disabled={isScanning}
                className="flex-1 bg-slate-850 text-slate-100 text-xs py-2.5 px-3 rounded-lg border border-slate-750 font-mono cursor-pointer focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="">-- Choose Job Card (Qty) --</option>
                {jobCards.map(c => (
                  <option key={c.jobCardNo} value={c.jobCardNo}>
                    [{c.jobCardNo}] - {c.itemName} ({c.currentQty} KG)
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => handleSimulateScan(selectedJobNo)}
                disabled={!selectedJobNo || isScanning}
                className="px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-600 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-lg text-xs font-bold font-sans flex items-center gap-1.5 transition-all border border-[#1D4ED8] cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Scan
              </button>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg flex items-start gap-2.5 border border-slate-800">
            <AlertTriangle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-normal">
              In actual deployment, this operates via web camera hooks to scan PDF/Printed Job sheet matrix symbols. For this evaluation, select an active tag above to simulate a scanner pass.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
