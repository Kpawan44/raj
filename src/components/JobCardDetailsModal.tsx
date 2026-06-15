import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Paperclip, 
  FileText, 
  Trash2, 
  Upload, 
  Check, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  Share2
} from 'lucide-react';
import { JobCard, MaterialMovement, UserProfile } from '../types';
import { getJobCardProcessMetrics } from '../lib/metrics';
import { DBService } from '../lib/firebase';
import TimelineVisual from './TimelineVisual';

interface JobCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCard: JobCard;
  movements: MaterialMovement[];
  currentUser: UserProfile;
  onUploadAttachment: (jobCardNo: string, file: { name: string; size: string; url: string; uploadedAt: string }) => void;
  onDeleteAttachment: (jobCardNo: string, index: number) => void;
}

export default function JobCardDetailsModal({
  isOpen,
  onClose,
  jobCard,
  movements,
  currentUser,
  onUploadAttachment,
  onDeleteAttachment
}: JobCardDetailsModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const trackingUrl = `${window.location.origin}?jobCardNo=${jobCard.jobCardNo}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Track Job Card ${jobCard.jobCardNo}`,
        text: `Trace process flow and status ledger for job card number ${jobCard.jobCardNo} on PRO-MFG TRACK.`,
        url: trackingUrl
      }).catch(console.error);
    } else {
      handleCopyLink();
    }
  };

  // Filter movements for this specific job card
  const filteredMovements = movements.filter(m => m.jobCardNo.toLowerCase() === jobCard.jobCardNo.toLowerCase());
  const m = getJobCardProcessMetrics(jobCard, movements);

  // File Upload Handlers (Drag & Drop + Input Click)
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processUploadedFile = (file: File) => {
    // Generate a simulated object URL for preview
    const sizeInKB = Math.round(file.size / 1024);
    const simulatedUrl = URL.createObjectURL(file);
    
    onUploadAttachment(jobCard.jobCardNo, {
      name: file.name,
      size: `${sizeInKB} KB`,
      url: simulatedUrl,
      uploadedAt: new Date().toISOString()
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30';
      case 'In Process':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30';
      case 'Pending Acceptance':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        
        {/* Modal Top Header (Non-Printable) */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 print:hidden">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase border ${getStatusBadge(jobCard.status)}`}>
              {jobCard.status}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-mono">
              Job Card No: {jobCard.jobCardNo}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 dark:text-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <Printer className="h-4 w-4" />
              Print Job Card
            </button>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Contents */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto print:p-0" id="job-card-printable-area">
          {/* Print Only Header */}
          <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-center uppercase">
              Manufacturing Job Card Summary
            </h2>
            <div className="text-center font-mono text-sm mt-1">
              Generated: {new Date().toLocaleDateString()} | Factory ID: Plant #1
            </div>
          </div>

          {/* Master Details Header block and Barcode Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <h3 className="font-sans font-bold text-xl text-slate-900 dark:text-white">
                {jobCard.partyName}
              </h3>
              
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <span className="text-slate-400 text-xs uppercase font-semibold">Item Specification</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{jobCard.itemName}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase font-semibold">Item Code</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-100">{jobCard.itemCode}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase font-semibold">Job Order No</span>
                  <p className="font-mono text-slate-800 dark:text-slate-100">{jobCard.orderNo}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs uppercase font-semibold">Created On</span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {new Date(jobCard.createdAt).toLocaleDateString([], {dateStyle: 'medium'})}
                  </p>
                </div>
              </div>
            </div>

            {/* Live QR Code & Quick Copy/Share Actions */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
              <div className="relative group p-2 bg-white rounded-lg border border-slate-200 shadow-sm print:border-none print:shadow-none mb-2">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=${encodeURIComponent(trackingUrl)}`} 
                  alt={`QR Code for Job Card ${jobCard.jobCardNo}`}
                  className="w-28 h-28 mix-blend-multiply dark:mix-blend-normal"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg print:hidden">
                  <a 
                    href={trackingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1 px-2.5 bg-[#3B82F6] text-white text-[10px] uppercase font-bold rounded flex items-center gap-1 hover:bg-blue-600 transition animate-fade-in"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Trace
                  </a>
                </div>
              </div>
              
              <span className="font-mono text-[9px] text-slate-500 uppercase font-semibold block">
                SCAN_JC_REF_{jobCard.jobCardNo}
              </span>

              {/* Quick print & share action tools */}
              <div className="flex gap-1.5 mt-3 w-full print:hidden">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10.5px] font-bold border transition duration-200 cursor-pointer ${
                    copied 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-400' 
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                  title="Copy Tracking Link to clipboard"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center p-1.5 px-2 rounded-md text-[10.5px] font-bold bg-[#3B82F6] text-white border border-[#1D4ED8] hover:bg-blue-600 transition duration-200 cursor-pointer"
                  title="Share or Quick Copy link"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="ml-1">Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Workflow parameters tracking / weight balance display */}
          <div className="bg-slate-900 text-white p-5 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-800">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Order Target</span>
              <p className="text-lg font-bold font-mono">{jobCard.orderQty} KG</p>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Current Weight In transit</span>
              <p className="text-lg font-bold font-mono text-amber-400">{jobCard.currentQty} KG</p>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Processed/Outstanding</span>
              <p className="text-lg font-bold font-mono text-indigo-400">
                {jobCard.completed ? jobCard.currentQty : 0} / {jobCard.balanceQty} KG
              </p>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Heat Treatment Req</span>
              <p className={`text-sm font-semibold rounded-full px-2 py-0.5 inline-block text-center mt-1 uppercase ${
                jobCard.heatTreatmentRequired ? 'bg-orange-850 hover:bg-orange-900 border border-orange-500 text-orange-200' : 'bg-slate-800 border border-slate-700 text-slate-300'
              }`}>
                {jobCard.heatTreatmentRequired ? 'Yes (Harden)' : 'No (Plating direct)'}
              </p>
            </div>
          </div>

          {/* Dynamic routing flow balances telemetry grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse shrink-0" />
              <span>Job Routing Flow Balances Telemetry (KG)</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
              
              {/* Card 1: Production milling */}
              <div className="p-3.5 rounded-lg border border-blue-100 dark:border-blue-950/40 bg-blue-50/20 dark:bg-blue-950/5 space-y-2">
                <div className="font-bold text-blue-700 dark:text-blue-400 uppercase text-[10px] tracking-wider">Milling (PROD)</div>
                <div className="space-y-1 font-mono text-[11px] text-slate-650 dark:text-slate-350">
                  <div className="flex justify-between"><span>Received:</span> <strong className="text-slate-850 dark:text-white">{m.qtyReceivedFromProd.toLocaleString()} KG</strong></div>
                  <div className="flex justify-between items-center gap-1.5 py-0.5">
                    <span>Routed Plating:</span> 
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        min="0"
                        title="Edit Routed Plating Quantity"
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                        value={jobCard.customRoutedToPlating !== undefined && jobCard.customRoutedToPlating !== null ? jobCard.customRoutedToPlating : m.qtyRoutedToPlating}
                        onChange={async (e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          try {
                            await DBService.updateJobCard(jobCard.jobCardNo, { 
                              customRoutedToPlating: val 
                            }, currentUser?.userId || 'u-1', currentUser?.name || 'Pawan Kumar');
                          } catch (err) {
                            console.error("Failed to update custom Routed Plating value", err);
                          }
                        }}
                      />
                      <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 font-mono">KG</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-slate-800 pt-1 flex justify-between"><span>Remaining:</span> <span className="font-bold text-amber-600">{m.qtyRemainingAtProd.toLocaleString()} KG</span></div>
                </div>
              </div>

              {/* Card 2: Surfacing & Plating */}
              <div className="p-3.5 rounded-lg border border-purple-100 dark:border-purple-950/40 bg-purple-50/20 dark:bg-purple-950/5 space-y-2">
                <div className="font-bold text-purple-700 dark:text-purple-400 uppercase text-[10px] tracking-wider">Plating (SURF)</div>
                <div className="space-y-1 font-mono text-[11px] text-slate-650 dark:text-slate-350">
                  <div className="flex justify-between"><span>Received:</span> <strong className="text-slate-850 dark:text-white">{m.qtyReceivedAtPlating.toLocaleString()} KG</strong></div>
                  <div className="flex justify-between"><span>Routed Packing:</span> <strong className="text-purple-600 dark:text-purple-400">{m.qtyRoutedToPacking.toLocaleString()} KG</strong></div>
                  <div className="border-t border-slate-200/50 dark:border-slate-800 pt-1 flex justify-between"><span>Remaining:</span> <span className="font-bold text-amber-600">{m.qtyRemainingAtPlating.toLocaleString()} KG</span></div>
                </div>
              </div>

              {/* Card 3: Packing weights */}
              <div className="p-3.5 rounded-lg border border-pink-100 dark:border-pink-950/40 bg-pink-50/20 dark:bg-pink-950/5 space-y-2">
                <div className="font-bold text-pink-700 dark:text-pink-400 uppercase text-[10px] tracking-wider">Packing (BOX)</div>
                <div className="space-y-1 font-mono text-[11px] text-slate-650 dark:text-slate-350">
                  <div className="flex justify-between"><span>Received:</span> <strong className="text-slate-850 dark:text-white">{m.qtyReceivedAtPacking.toLocaleString()} KG</strong></div>
                  <div className="flex justify-between"><span>Routed Store:</span> <strong className="text-pink-600 dark:text-pink-400">{m.qtyRoutedToStore.toLocaleString()} KG</strong></div>
                  <div className="border-t border-slate-200/50 dark:border-slate-800 pt-1 flex justify-between"><span>Remaining:</span> <span className="font-bold text-amber-600">{m.qtyRemainingAtPacking.toLocaleString()} KG</span></div>
                </div>
              </div>

              {/* Card 4: Store Stock ledger */}
              <div className="p-3.5 rounded-lg border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/20 dark:bg-emerald-950/5 space-y-2">
                <div className="font-bold text-emerald-700 dark:text-emerald-400 uppercase text-[10px] tracking-wider">Inventory Stock</div>
                <div className="space-y-1 font-mono text-[11px] text-slate-650 dark:text-slate-350">
                  <div className="flex justify-between"><span>Recv Store:</span> <strong className="text-slate-850 dark:text-white">{m.qtyReceivedAtStore.toLocaleString()} KG</strong></div>
                  <div className="flex justify-between"><span>Dispatched:</span> <strong className="text-emerald-600 dark:text-emerald-400">{m.qtyDispatched.toLocaleString()} KG</strong></div>
                  <div className="border-t border-slate-200/50 dark:border-slate-800 pt-1 flex justify-between"><span>In Stock:</span> <span className="font-bold text-emerald-650 dark:text-emerald-400">{m.qtyRemainingInStock.toLocaleString()} KG</span></div>
                </div>
              </div>

            </div>
          </div>

          {/* Core Timeline Trace Map */}
          <TimelineVisual jobCard={jobCard} movements={filteredMovements} />

          {/* Detailed processing logs gathered per department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Department process information summary */}
            <div className="space-y-4">
              <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide border-b pb-2">
                Department Signature Details
              </h4>
              
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                {/* Step 2 Production */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Production Department info</div>
                  {jobCard.operatorName ? (
                    <div className="mt-1 space-y-1 font-mono text-[11px]">
                      <p>• Operator Name: {jobCard.operatorName}</p>
                      <p>• Status: Completed Milling</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic mt-1 font-mono text-[10px]">Pending active production logging</p>
                  )}
                </div>

                {/* Step 3 Heat Treatment */}
                {jobCard.heatTreatmentRequired && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">Heat Treatment Department info</div>
                    {jobCard.heatTreatmentDetails ? (
                      <div className="mt-1 space-y-1 font-mono text-[11px]">
                        <p>• Hardness Required: {jobCard.heatTreatmentDetails.hardnessRequired || 'HRC 32-38'}</p>
                        <p>• Temp (C): {jobCard.heatTreatmentDetails.temperature || '850°C'}</p>
                        <p>• Cycle Time: {jobCard.heatTreatmentDetails.cycleTime || '4 hours'}</p>
                        {jobCard.heatTreatmentDetails.remarks && <p>• Remarks: {jobCard.heatTreatmentDetails.remarks}</p>}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic mt-1 font-mono text-[10px]">Awaiting Heat Treat processing</p>
                    )}
                  </div>
                )}

                {/* Step 4 Plating */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Plating Department info</div>
                  {jobCard.platingDetails ? (
                    <div className="mt-1 space-y-1 font-mono text-[11px]">
                      <p>• Plating Type: {jobCard.platingDetails.platingType || 'Zinc'}</p>
                      <p>• Micron Thickness: {jobCard.platingDetails.micronThickness || '8-10'}μm</p>
                      <p>• Plating Duration: {jobCard.platingDetails.durationMinutes || '45'} min</p>
                      {jobCard.platingDetails.qtyReceivedFromHt !== undefined && (
                        <p>• Qty Received from HT: {jobCard.platingDetails.qtyReceivedFromHt} KG</p>
                      )}
                      {jobCard.platingDetails.qtySentToPacking !== undefined && (
                        <p>• Qty Sent to Packing: {jobCard.platingDetails.qtySentToPacking} KG</p>
                      )}
                      {jobCard.platingDetails.qtyRemaining !== undefined && (
                        <p>• Remaining Balance: {jobCard.platingDetails.qtyRemaining} KG</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic mt-1 font-mono text-[10px]">Awaiting electroplating line</p>
                  )}
                </div>

                {/* Step 5 Packing */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                   <div className="font-semibold text-slate-800 dark:text-slate-100">Packing Department info</div>
                   {jobCard.packingDetails ? (
                     <div className="mt-1 space-y-1 font-mono text-[11px]">
                       <p>• Packed Weight: {jobCard.packingDetails.packedQty || jobCard.currentQty} KG</p>
                       <p>• Box Count: {jobCard.packingDetails.boxCount || 'N/A'}</p>
                       <p>• Style: {jobCard.packingDetails.packingType || 'Wooden Pallets'}</p>
                       {jobCard.packingDetails.qtyReceivedFromPlating !== undefined && (
                         <p>• Qty Received from Plating: {jobCard.packingDetails.qtyReceivedFromPlating} KG</p>
                       )}
                       {jobCard.packingDetails.qtySentToStore !== undefined && (
                         <p>• Qty Sent to Store: {jobCard.packingDetails.qtySentToStore} KG</p>
                       )}
                       {jobCard.packingDetails.qtyRemaining !== undefined && (
                         <p>• Remaining Balance: {jobCard.packingDetails.qtyRemaining} KG</p>
                       )}
                     </div>
                   ) : (
                     <p className="text-slate-400 italic mt-1 font-mono text-[10px]">Awaiting box packaging</p>
                   )}
                 </div>
 
                 {/* Step 6 Store */}
                 <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                   <div className="font-semibold text-slate-800 dark:text-slate-100">Store / Inventory Ingestion</div>
                   {jobCard.storeDetails ? (
                     <div className="mt-1 space-y-1 font-mono text-[11px]">
                       <p>• Verified Inventory: {jobCard.storeDetails.verifiedQty || jobCard.currentQty} KG</p>
                       <p>• Location Bin Tag: {jobCard.storeDetails.locationBin || 'BIN-A3'}</p>
                       {jobCard.storeDetails.qtyReceivedFromPacking !== undefined && (
                         <p>• Qty Received from Packing: {jobCard.storeDetails.qtyReceivedFromPacking} KG</p>
                       )}
                       {jobCard.storeDetails.qtySentToDispatch !== undefined && (
                         <p>• Qty Sent to Dispatch/Stocked: {jobCard.storeDetails.qtySentToDispatch} KG</p>
                       )}
                       {jobCard.storeDetails.qtyRemaining !== undefined && (
                         <p>• Remaining Balance (Hold/Pending): {jobCard.storeDetails.qtyRemaining} KG</p>
                       )}
                     </div>
                   ) : (
                     <p className="text-slate-400 italic mt-1 font-mono text-[10px]">Awaiting warehouse placement</p>
                    )}
                  </div>
                </div>
              </div>

            {/* Material Movement Audit trail & attachments list */}
            <div className="space-y-6">
              <div>
                <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide border-b pb-2 mb-3">
                  Transit & Acceptance Audit Trail
                </h4>
                
                {filteredMovements.length === 0 ? (
                  <p className="text-slate-400 italic text-xs font-mono">No material movements recorded yet.</p>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-slate-850 pl-4 space-y-4">
                    {filteredMovements.map((m, mIdx) => (
                      <div key={m.movementId} className="relative text-xs">
                        <div className="absolute -left-[21px] top-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-full h-3.5 w-3.5 border-2 border-slate-300 dark:border-slate-700" />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.fromDepartment} → {m.toDepartment}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Transferred: {m.quantity} KG by {m.transferBy}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(m.transferDate).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          
                          {m.accepted ? (
                            <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded w-fit">
                              <Check className="h-3 w-3" />
                              Accepted by {m.acceptedBy} on {new Date(m.acceptedDate!).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          ) : (
                            <div className="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded w-fit">
                              ⌛ Awaiting downstream operator verification
                            </div>
                          )}

                          {m.remarks && (
                            <p className="mt-1 italic p-1 bg-slate-50 dark:bg-slate-900 text-slate-500 font-sans text-[10px] rounded border border-slate-100 dark:border-slate-850">
                              Remarks: "{m.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachment Section (Fully implementing the requested Drag-and-Drop + Manual file picker pattern) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/20 print:hidden">
                <h4 className="font-sans font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4" />
                  Engineering Attachments & Images
                </h4>

                {/* Drag and Drop Zone Container */}
                <div 
                  id="attachment-drag-zone"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    isDragActive 
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500' 
                      : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <input 
                    type="file" 
                    id="attachment-file-input"
                    ref={fileInputRef}
                    onChange={handleInputChange}
                    className="hidden" 
                    accept="image/*,application/pdf,.doc,.docx"
                  />
                  <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Drag & Drop File here OR <span className="text-amber-500 hover:underline">Browse</span>
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase font-mono">
                    Accepts QA PDFs, Thickness Reports, Operator Photos
                  </p>
                </div>

                {/* Local attachments lists */}
                {!(jobCard as any).attachments || !(jobCard as any).attachments.length ? (
                  <p className="text-[10px] text-slate-400 font-mono italic mt-3 text-center">
                    No blueprints or digital certificate files uploaded yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {(((jobCard as any).attachments as any[] || [])).map((file, fIdx) => (
                      <div key={fIdx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">
                              {file.name}
                            </p>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {file.size} • {new Date(file.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-amber-500 hover:underline px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20"
                          >
                            View
                          </a>
                          <button
                            onClick={() => onDeleteAttachment(jobCard.jobCardNo, fIdx)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/15"
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
