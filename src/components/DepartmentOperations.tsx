import React, { useState } from 'react';
import { getJobCardProcessMetrics } from '../lib/metrics';
import { 
  ArrowRight, 
  Plus, 
  Play, 
  Check, 
  X, 
  Trash2, 
  Sliders, 
  HelpCircle, 
  TrendingUp, 
  Wrench, 
  Flame, 
  Sparkles, 
  PackageCheck, 
  Warehouse, 
  Truck,
  CheckCircle2
} from 'lucide-react';
import { JobCard, MaterialMovement, Department, UserProfile } from '../types';

interface DepartmentOperationsProps {
  currentUser: UserProfile;
  jobCards: JobCard[];
  movements: MaterialMovement[];
  onCreateJobCard: (job: {
    partyName: string;
    itemName: string;
    itemCode: string;
    orderQty: number;
    heatTreatmentRequired: boolean;
    currentQty: number;
    currentDepartment: Department;
    status: 'Pending';
  }) => void;
  onUpdateJobCard: (jobCardNo: string, updates: Partial<JobCard>) => void;
  onCreateMovement: (mov: {
    jobCardNo: string;
    fromDepartment: Department;
    toDepartment: Department | 'Completed';
    quantity: number;
    remarks?: string;
  }) => void;
  onAcceptMovement: (movementId: string, remarks?: string) => void;
  onRejectMovement: (movementId: string, remarks: string) => void;
  onSelectJobCard: (jobCard: JobCard) => void;
}

export default function DepartmentOperations({
  currentUser,
  jobCards,
  movements,
  onCreateJobCard,
  onUpdateJobCard,
  onCreateMovement,
  onAcceptMovement,
  onRejectMovement,
  onSelectJobCard
}: DepartmentOperationsProps) {
  // Determine relevant department
  const activeDept = currentUser.department === 'Admin' ? 'Dispatch' : currentUser.department as Department;

  const [activeSubView, setActiveSubView] = useState<'incoming' | 'operations' | 'completed'>('operations');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [activeRejectionId, setActiveRejectionId] = useState<string | null>(null);

  // --- FORM STATES ---
  // Create Order (Dispatch)
  const [partyName, setPartyName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [orderQty, setOrderQty] = useState<number>(1000);
  const [htRequired, setHtRequired] = useState(false);
  const [dispatchRemarks, setDispatchRemarks] = useState('');

  // Production Inputs
  const [prodOpName, setProdOpName] = useState('');
  const [prodQty, setProdQty] = useState<number>(0);
  const [activeProdJob, setActiveProdJob] = useState<string | null>(null);

  // Heat Treatment Inputs
  const [htHardness, setHtHardness] = useState('HRC 32-38');
  const [htTemp, setHtTemp] = useState('850°C');
  const [htDuration, setHtDuration] = useState('4 hours');
  const [htRejectionQty, setHtRejectionQty] = useState<number>(0);
  const [htQtyReceived, setHtQtyReceived] = useState<number>(0);
  const [htQtySentToPlating, setHtQtySentToPlating] = useState<number>(0);
  const [activeHtJob, setActiveHtJob] = useState<string | null>(null);

  // Plating Inputs
  const [platingType, setPlatingType] = useState('Acid Zinc Plating (Yellow)');
  const [platingThick, setPlatingThick] = useState('8-12μm');
  const [platingDur, setPlatingDur] = useState('45 min');
  const [platingRejectionQty, setPlatingRejectionQty] = useState<number>(0);
  const [platingQtyReceived, setPlatingQtyReceived] = useState<number>(0);
  const [platingQtySentToPacking, setPlatingQtySentToPacking] = useState<number>(0);
  const [activePlatingJob, setActivePlatingJob] = useState<string | null>(null);

  // Packing Inputs
  const [packQty, setPackQty] = useState<number>(0);
  const [packBoxCount, setPackBoxCount] = useState<number>(5);
  const [packStyle, setPackStyle] = useState('Corrugated Boxes with wooden pallet support');
  const [packRejectionQty, setPackRejectionQty] = useState<number>(0);
  const [packQtyReceived, setPackQtyReceived] = useState<number>(0);
  const [packQtySentToStore, setPackQtySentToStore] = useState<number>(0);
  const [activePackingJob, setActivePackingJob] = useState<string | null>(null);

  // Store Inputs
  const [storeVerifiedQty, setStoreVerifiedQty] = useState<number>(0);
  const [storeBinLoc, setStoreBinLoc] = useState('BIN-A1');
  const [storeQtyReceived, setStoreQtyReceived] = useState<number>(0);
  const [storeQtySentToDispatch, setStoreQtySentToDispatch] = useState<number>(0);
  const [storeRejectionQty, setStoreRejectionQty] = useState<number>(0);
  const [activeStoreJob, setActiveStoreJob] = useState<string | null>(null);

  // Outbound Dispatch Inputs
  const [dispInvoice, setDispInvoice] = useState('INV-2026-');
  const [dispVehicle, setDispVehicle] = useState('MH-12-');
  const [dispQty, setDispQty] = useState<number>(0);
  const [activeDispJob, setActiveDispJob] = useState<string | null>(null);

  // --- ACTIONS ---
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName || !itemName || !itemCode || orderQty <= 0) return;

    onCreateJobCard({
      partyName,
      itemName,
      itemCode,
      orderQty,
      heatTreatmentRequired: htRequired,
      currentQty: orderQty,
      currentDepartment: 'Production', // immediately routed to first node
      status: 'Pending'
    });

    // Reset Form
    setPartyName('');
    setItemName('');
    setItemCode('');
    setOrderQty(1000);
    setHtRequired(false);
    setDispatchRemarks('');
  };

  // Switch status for production start
  const handleStartProduction = (jCard: JobCard) => {
    onUpdateJobCard(jCard.jobCardNo, { status: 'In Process' });
  };

  const handleCompleteProduction = (jCard: JobCard) => {
    if (!prodOpName || prodQty <= 0) return;

    // Update job card specs
    onUpdateJobCard(jCard.jobCardNo, {
      operatorName: prodOpName,
      currentQty: prodQty,
      // Formula: Balance = Order Qty - Processed Qty
      balanceQty: Math.max(0, jCard.orderQty - prodQty)
    });

    // Determine target department
    const targetDept: Department = jCard.heatTreatmentRequired ? 'Heat Treatment' : 'Plating';

    // Spawn material movement
    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Production',
      toDepartment: targetDept,
      quantity: prodQty,
      remarks: `Produced by ${prodOpName}. Sent to ${targetDept}.`
    });

    // Clear state
    setProdOpName('');
    setProdQty(0);
    setActiveProdJob(null);
  };

  const handleCompleteHeatTreatment = (jCard: JobCard) => {
    const receivedFromProd = htQtyReceived;
    const sentToPlating = htQtySentToPlating;
    const remainingQty = Math.max(0, receivedFromProd - sentToPlating - htRejectionQty);

    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToPlating: sentToPlating,
      heatTreatmentDetails: {
        hardnessRequired: htHardness,
        temperature: htTemp,
        cycleTime: htDuration,
        rejectionQty: htRejectionQty,
        qtyReceivedFromProd: receivedFromProd,
        qtySentToPlating: sentToPlating,
        qtyRemaining: remainingQty
      }
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Heat Treatment',
      toDepartment: 'Plating',
      quantity: sentToPlating,
      remarks: `Completed furnace cycle. Hardness: ${htHardness}. Recv: ${receivedFromProd} KG, Sent to Plating: ${sentToPlating} KG, Rejections: ${htRejectionQty} KG, Remaining: ${remainingQty} KG.`
    });

    setHtRejectionQty(0);
    setHtQtyReceived(0);
    setHtQtySentToPlating(0);
    setActiveHtJob(null);
  };

  const handleCompletePlating = (jCard: JobCard) => {
    const receivedFromHt = platingQtyReceived;
    const sentToPacking = platingQtySentToPacking;
    const remainingQty = Math.max(0, receivedFromHt - sentToPacking - platingRejectionQty);

    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToPacking: sentToPacking,
      platingDetails: {
        platingType,
        micronThickness: platingThick,
        durationMinutes: platingDur,
        rejectionQty: platingRejectionQty,
        qtyReceivedFromHt: receivedFromHt,
        qtySentToPacking: sentToPacking,
        qtyRemaining: remainingQty
      }
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Plating',
      toDepartment: 'Packing',
      quantity: sentToPacking,
      remarks: `Coating thickness ${platingThick} verified. Zinc plating cycle complete. Recv from HT: ${receivedFromHt} KG, Sent for Packing: ${sentToPacking} KG, Rejections: ${platingRejectionQty} KG, Remaining Balance: ${remainingQty} KG.`
    });

    setPlatingRejectionQty(0);
    setPlatingQtyReceived(0);
    setPlatingQtySentToPacking(0);
    setActivePlatingJob(null);
  };

  const handleCompletePacking = (jCard: JobCard) => {
    const receivedFromPlating = packQtyReceived;
    const sentToStore = packQtySentToStore;
    const remainingQty = Math.max(0, receivedFromPlating - sentToStore - packRejectionQty);

    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToStore: sentToStore,
      packingDetails: {
        packedQty: sentToStore,
        boxCount: packBoxCount,
        packingType: packStyle,
        rejectionQty: packRejectionQty,
        qtyReceivedFromPlating: receivedFromPlating,
        qtySentToStore: sentToStore,
        qtyRemaining: remainingQty
      },
      currentQty: sentToStore,
      balanceQty: Math.max(0, jCard.orderQty - sentToStore)
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Packing',
      toDepartment: 'Store',
      quantity: sentToStore,
      remarks: `Packed in ${packBoxCount} boxes. Quality verified. Recv from Plating: ${receivedFromPlating} KG, Sent to Store: ${sentToStore} KG, Rejections: ${packRejectionQty} KG, Remaining: ${remainingQty} KG. Style: ${packStyle}.`
    });

    setPackRejectionQty(0);
    setPackQtyReceived(0);
    setPackQtySentToStore(0);
    setActivePackingJob(null);
  };

  const handleCompleteStore = (jCard: JobCard) => {
    const receivedFromPacking = storeQtyReceived;
    const sentToDispatch = storeQtySentToDispatch;
    const remainingQty = Math.max(0, receivedFromPacking - sentToDispatch - storeRejectionQty);

    onUpdateJobCard(jCard.jobCardNo, {
      storeDetails: {
        verifiedQty: sentToDispatch,
        locationBin: storeBinLoc,
        rejectionQty: storeRejectionQty,
        qtyReceivedFromPacking: receivedFromPacking,
        qtySentToDispatch: sentToDispatch,
        qtyRemaining: remainingQty
      },
      currentQty: sentToDispatch,
      balanceQty: Math.max(0, jCard.orderQty - sentToDispatch)
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Store',
      toDepartment: 'Dispatch', // Completed transit route
      quantity: sentToDispatch,
      remarks: `Stored in bin location: ${storeBinLoc}. Ingested into active system ledger. Recv from Packing: ${receivedFromPacking} KG, Sent to Dispatch: ${sentToDispatch} KG, Rejections: ${storeRejectionQty} KG, Remaining Qty: ${remainingQty} KG.`
    });

    setStoreRejectionQty(0);
    setStoreQtyReceived(0);
    setStoreQtySentToDispatch(0);
    setActiveStoreJob(null);
  };

  const handleFinalizeDispatch = (jCard: JobCard) => {
    if (dispQty <= 0 || !dispInvoice || !dispVehicle) return;

    // Update job card dispatch log and close order
    onUpdateJobCard(jCard.jobCardNo, {
      completed: true,
      status: 'Completed',
      currentQty: dispQty,
      balanceQty: Math.max(0, jCard.orderQty - dispQty),
      dispatchDetails: {
        invoiceNo: dispInvoice,
        vehicleNo: dispVehicle,
        dispatchQty: dispQty,
        dispatchDate: new Date().toISOString(),
        remarks: `Outbound loaded onto ${dispVehicle}. Bill of lading issued.`
      }
    });

    // Mark corresponding last movement targeting Dispatch as accepted
    const transitMov = movements.find(m => m.jobCardNo === jCard.jobCardNo && m.toDepartment === 'Dispatch' && !m.accepted);
    if (transitMov) {
      onAcceptMovement(transitMov.movementId, `Dispatched via Invoice ${dispInvoice}`);
    }

    setActiveDispJob(null);
  };

  // --- FILTERED LISTS ---
  // A. Incoming Transfers waiting for acceptance inside this active department
  const incomingTransfers = movements.filter(m => {
    return m.toDepartment === activeDept && !m.accepted;
  });

  // B. Job cards currently assigned to this department
  const activeDepartmentJobs = jobCards.filter(c => {
    // Dispatch owns tracking when completed or creating, otherwise matches exactly
    if (activeDept === 'Dispatch') {
      return !c.completed;
    }
    const match = c.currentDepartment === activeDept && !c.completed;
    if (activeDept === 'Production') {
      console.log(`Checking Production for ${c.jobCardNo}: currentDept=${c.currentDepartment}, completed=${c.completed}, match=${match}`);
    }
    return match;
  });

  // C. Archived Outbound transfers from this department
  const completedDepartmentLogs = movements.filter(m => {
    return m.fromDepartment === activeDept && m.accepted;
  });

  // Status Colors Helper
  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40 border border-amber-200';
      case 'In Process': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40 border border-blue-200';
      case 'Completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40 border border-emerald-200';
      case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 border border-red-200';
      case 'Pending Acceptance': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/40 border border-purple-200';
      default: return 'bg-slate-105';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Department Context Top bar */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[#3B82F6] text-[10px] uppercase font-bold tracking-widest font-mono">
            Active Control Module
          </span>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            {activeDept} Department Workbench
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeDept === 'Dispatch' ? 'Initiate customer bookings & execute shipping schedules.' : 'Monitor local queue, accept incoming batches, and record processing metadata.'}
          </p>
        </div>

        {/* Local operation tabs switcher */}
        {activeDept !== 'Dispatch' && (
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs text-slate-400 self-start md:self-auto shrink-0">
            <button
              onClick={() => setActiveSubView('incoming')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all relative ${
                activeSubView === 'incoming' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              Incoming Ingress
              {incomingTransfers.length > 0 && (
                <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
                  {incomingTransfers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubView('operations')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                activeSubView === 'operations' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              Active Floor Jobs
            </button>
            <button
              onClick={() => setActiveSubView('completed')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                activeSubView === 'completed' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              Completed / Shipped Logs
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* DISPATCH SPECIFIC MODULE: BOOK ORDER (STEP 1) */}
      {/* ======================================================== */}
      {activeDept === 'Dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Create Order Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 mb-2">
              <Plus className="h-5 w-5 text-[#3B82F6]" />
              <h3 className="font-sans font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">
                Create Raw Job Card
              </h3>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Customer / Party Name</label>
                <input
                  type="text"
                  placeholder="Apex Engineering Solutions"
                  required
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="M12 High-Tensile Bolt"
                    required
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Item Code</label>
                  <input
                    type="text"
                    placeholder="BOLT-M12-G8"
                    required
                    value={itemCode}
                    onChange={e => setItemCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-450 font-semibold mb-1">Quantity (KG)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderQty}
                    onChange={e => setOrderQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-450 font-semibold mb-1">Heat Treatment Required</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHtRequired(true)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition cursor-pointer ${
                        htRequired 
                          ? 'bg-[#3B82F6] border-[#1D4ED8] text-white shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-855 dark:hover:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-755'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setHtRequired(false)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition cursor-pointer ${
                        !htRequired 
                          ? 'bg-[#3B82F6] border-[#1D4ED8] text-white shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-855 dark:hover:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-755'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Remarks / Quality Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter raw wire material batch codes..."
                  value={dispatchRemarks}
                  onChange={e => setDispatchRemarks(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg p-2.5 text-slate-850 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#3B82F6] text-white hover:bg-blue-600 font-semibold py-3 rounded-lg shadow-md transition-all uppercase tracking-wide font-mono text-sm border border-[#1D4ED8] cursor-pointer"
              >
                Register Order Sequence
              </button>
            </form>
          </div>

          {/* ACTIVE DISPATCH QUEUE & INVOICING / SHIPMENTS */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                Verify & Ingest Inbound Packed Stocks to Dispatched
              </h3>

              {activeDepartmentJobs.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-2xl">📦</span>
                  <p className="text-slate-400 text-xs font-mono font-medium">No outstanding dispatch shipping queues</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeDepartmentJobs.map(job => {
                    const isClosing = activeDispJob === job.jobCardNo;
                    return (
                      <div 
                        key={job.jobCardNo}
                        className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 transition-all hover:border-slate-350"
                      >
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                          <div onClick={() => onSelectJobCard(job)} className="cursor-pointer hover:underline min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                {job.jobCardNo}
                              </span>
                              <span className="font-sans font-extrabold text-slate-900 dark:text-white truncate">
                                {job.partyName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                              <strong>{job.itemName}</strong> | target: {job.orderQty} KG, cur: {job.currentQty} KG (Bal: {job.balanceQty} KG)
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                            {/* If item waiting at Dispatch Department, allow shipping invocation */}
                            {job.currentDepartment === 'Store' || job.currentDepartment === 'Completed' ? (
                              <button
                                onClick={() => {
                                  setActiveDispJob(isClosing ? null : job.jobCardNo);
                                  setDispQty(job.currentQty);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-md transition-all flex items-center gap-1"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                Invoice & Ship
                              </button>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-850 px-2.5 py-1.5 rounded-full font-mono">
                                Floor: {job.currentDepartment} ({job.status})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Invoice & Ship execution panel */}
                        {isClosing && (
                          <div className="mt-4 pt-4 border-t border-slate-201 text-xs space-y-3 font-sans">
                            <div className="flex items-center justify-between font-semibold mb-1">
                              <span>Outbound Logistics Sign-off</span>
                              <button onClick={() => setActiveDispJob(null)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-slate-400 mb-1">Invoice Number</label>
                                <input
                                  type="text"
                                  value={dispInvoice}
                                  onChange={e => setDispInvoice(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Vehicle / Carrier Registrations</label>
                                <input
                                  type="text"
                                  value={dispVehicle}
                                  onChange={e => setDispVehicle(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Final Dispatch quantity (KG)</label>
                                <input
                                  type="number"
                                  value={dispQty}
                                  onChange={e => setDispQty(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono"
                                />
                              </div>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 font-sans italic">
                              *Completing this action closes the Job Card order chain and flags all movements Completed.
                            </p>

                            <button
                              onClick={() => handleFinalizeDispatch(job)}
                              className="w-full bg-emerald-600 text-white hover:bg-emerald-500 py-2 rounded font-bold uppercase tracking-wider text-xs shadow-sm mt-1"
                            >
                              Finalize Outbound Handover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* OTHER DEPARTMENTS ACTIONS PANEL */}
      {/* ======================================================== */}
      {activeDept !== 'Dispatch' && (
        <div className="space-y-4">
          
          {/* A. INCOMING SUBVIEW (ACCEPTANCE AND REJECTIONS FLOW) */}
          {activeSubView === 'incoming' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                📥 Pending Custody Receipts 
              </h3>

              {incomingTransfers.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-2xl">📦</span>
                  <p className="text-slate-400 text-xs font-mono font-medium">Floor queue clean. No pending inbound shipments found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingTransfers.map(mov => {
                    const isRejecting = activeRejectionId === mov.movementId;
                    return (
                      <div 
                        key={mov.movementId}
                        className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-201 dark:border-slate-850 flex flex-col gap-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded">{mov.jobCardNo}</span>
                              <span className="text-slate-400 font-bold">Transfer Ref: {mov.movementId}</span>
                            </div>
                            <p className="font-semibold text-slate-850 dark:text-white mt-1.5 font-sans">
                              Sender: {mov.fromDepartment} department ({mov.transferBy})
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              Quantity Transferred: <strong className="text-indigo-600 dark:text-indigo-400">{mov.quantity} KG</strong> | Date: {new Date(mov.transferDate).toLocaleDateString([], {hour:'2-digit', minute:'2-digit'})}
                            </p>
                            {mov.remarks && (
                              <p className="mt-1 text-[10px] text-slate-400 bg-white dark:bg-slate-900 p-1.5 rounded italic">
                                "{mov.remarks}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                            <button
                              onClick={() => onAcceptMovement(mov.movementId)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition duration-200 flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Accept Cargo
                            </button>
                            <button
                              onClick={() => {
                                setActiveRejectionId(isRejecting ? null : mov.movementId);
                                setRejectionNotes('');
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition duration-200"
                            >
                              Reject Cargo
                            </button>
                          </div>
                        </div>

                        {/* Rejection Remarks Form */}
                        {isRejecting && (
                          <div className="mt-2 pt-3 border-t border-slate-200 text-xs space-y-2 bg-rose-50/20 dark:bg-rose-950/20 p-3 rounded-lg">
                            <label className="block text-rose-500 font-bold uppercase tracking-wider text-[9px]">
                              Provide Declinature / Rejection reason remarks
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Describe exact inspection failures (e.g. Dimensions incorrect, surface flaws, oxidation)..."
                              value={rejectionNotes}
                              onChange={e => setRejectionNotes(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-2 focus:outline-none focus:border-rose-500"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setActiveRejectionId(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (!rejectionNotes) return;
                                  onRejectMovement(mov.movementId, rejectionNotes);
                                  setActiveRejectionId(null);
                                }}
                                disabled={!rejectionNotes}
                                className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded text-[10px] font-bold disabled:opacity-40"
                              >
                                Finalize Rejection Back to Sender
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* B. OPERATIONS PANEL SUBVIEW (ACTIVE PRODUCTION STEPS AND FIELDS UPDATES) */}
          {activeSubView === 'operations' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                ⚙️ In-Process Shop Floor Queue
              </h3>

              {activeDepartmentJobs.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-2xl">⚡</span>
                  <p className="text-slate-400 text-xs font-mono font-medium">Floor queue clear. Await material ingestion or dispatch approvals.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeDepartmentJobs.map(job => {
                    const isProcessing = 
                      (activeDept === 'Production' && activeProdJob === job.jobCardNo) ||
                      (activeDept === 'Heat Treatment' && activeHtJob === job.jobCardNo) ||
                      (activeDept === 'Plating' && activePlatingJob === job.jobCardNo) ||
                      (activeDept === 'Packing' && activePackingJob === job.jobCardNo) ||
                      (activeDept === 'Store' && activeStoreJob === job.jobCardNo);

                    const m = getJobCardProcessMetrics(job, movements);

                    return (
                      <div 
                        key={job.jobCardNo}
                        className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5 hover:border-slate-350"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div onClick={() => onSelectJobCard(job)} className="cursor-pointer hover:underline min-w-0 flex-1">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">{job.jobCardNo}</span>
                              <span className={`px-2 py-0.2 rounded font-bold ${getBadgeColor(job.status)}`}>{job.status}</span>
                            </div>
                            <p className="font-extrabold text-slate-900 dark:text-white mt-1.5 font-sans text-sm">
                              {job.partyName}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {job.itemName} • Order Qty: {job.orderQty} KG | <strong>Custody Weight: {job.currentQty} KG</strong> (Outstanding Balance: {job.balanceQty} KG)
                            </p>


                          </div>

                          {/* ACTION SWITCH GATE FOR PRODUCTION WORKFLOWS */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                            {job.status === 'Pending' || job.status === 'Rejected' ? (
                              <button
                                onClick={() => handleStartProduction(job)}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11.5px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                Start Production Processing
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  // Set appropriate form parameters before launching sub-form
                                  if (activeDept === 'Production') {
                                    setActiveProdJob(isProcessing ? null : job.jobCardNo);
                                    setProdQty(job.currentQty);
                                  } else if (activeDept === 'Heat Treatment') {
                                    setActiveHtJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      const m = getJobCardProcessMetrics(job, movements);
                                      setHtQtyReceived(m.qtyReceivedFromProd);
                                      const defaultSent = job.customRoutedToPlating !== undefined && job.customRoutedToPlating !== null
                                        ? job.customRoutedToPlating
                                        : Math.max(0, m.qtyReceivedFromProd - htRejectionQty);
                                      setHtQtySentToPlating(defaultSent);
                                    }
                                  } else if (activeDept === 'Plating') {
                                    setActivePlatingJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      const met = getJobCardProcessMetrics(job, movements);
                                      setPlatingQtyReceived(met.qtyReceivedAtPlating);
                                      const defaultSent = job.customRoutedToPacking !== undefined && job.customRoutedToPacking !== null
                                        ? job.customRoutedToPacking
                                        : Math.max(0, met.qtyReceivedAtPlating - platingRejectionQty);
                                      setPlatingQtySentToPacking(defaultSent);
                                    }
                                  } else if (activeDept === 'Packing') {
                                    setActivePackingJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      const met = getJobCardProcessMetrics(job, movements);
                                      setPackQtyReceived(met.qtyReceivedAtPacking);
                                      const defaultSent = job.customRoutedToStore !== undefined && job.customRoutedToStore !== null
                                        ? job.customRoutedToStore
                                        : Math.max(0, met.qtyReceivedAtPacking - packRejectionQty);
                                      setPackQtySentToStore(defaultSent);
                                      setPackQty(defaultSent);
                                    }
                                  } else if (activeDept === 'Store') {
                                    setActiveStoreJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      const met = getJobCardProcessMetrics(job, movements);
                                      setStoreQtyReceived(met.qtyReceivedAtStore);
                                      const defaultSent = met.qtyDispatched > 0 ? met.qtyDispatched : met.qtyReceivedAtStore;
                                      setStoreQtySentToDispatch(defaultSent);
                                      setStoreVerifiedQty(defaultSent);
                                    }
                                  }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Record Process Metrics
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ============================================== */}
                        {/* 1. PRODUCTION FIELDS SUBFORM */}
                        {/* ============================================== */}
                        {isProcessing && activeDept === 'Production' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-3 font-sans">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record Milling completion & Route Downstream</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-slate-400 mb-1">Milling Lead Operator Name</label>
                                <input
                                  type="text"
                                  placeholder="E.g. Ramesh Patil"
                                  value={prodOpName}
                                  onChange={e => setProdOpName(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Produced Quantity In KG</label>
                                <input
                                  type="number"
                                  value={prodQty}
                                  onChange={e => setProdQty(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none font-mono font-bold"
                                />
                              </div>
                            </div>
                            
                            <div className="p-2.5 bg-indigo-50 dark:bg-slate-900 rounded font-sans text-[10px] text-slate-500">
                              <strong>Business Routing Rule:</strong> {job.heatTreatmentRequired 
                                ? '⚠️ Heat Treatment is Required. Completing this step immediately transfers this job to the Furnace line queue.' 
                                : '✔️ Heat Treatment Skipped. Completing this step transfers cargo directly to Electroplating.'}
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleCompleteProduction(job)}
                                disabled={!prodOpName || prodQty <= 0}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm disabled:opacity-40"
                              >
                                Save Production Specs & Route Direct
                              </button>
                              <button
                                onClick={() => setActiveProdJob(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ============================================== */}
                        {/* 2. HEAT TREATMENT METRIC UPDATE */}
                        {/* ============================================== */}
                        {isProcessing && activeDept === 'Heat Treatment' && (
                          <div className="mt-3 pt-3 text-xs space-y-4 font-sans">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record Hardness specs & Route to Plating</h4>
                            
                            {/* Process Parameter Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-slate-400 mb-1">Hardness Achieved (Spec Required)</label>
                                <input
                                  type="text"
                                  value={htHardness}
                                  onChange={e => setHtHardness(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Hardening Temperature (°C)</label>
                                <input
                                  type="text"
                                  value={htTemp}
                                  onChange={e => setHtTemp(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Cycle Duration Time</label>
                                <input
                                  type="text"
                                  value={htDuration}
                                  onChange={e => setHtDuration(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-rose-500 font-semibold mb-1">Furnace Rejection (KG)</label>
                                <input
                                  type="number"
                                  value={htRejectionQty}
                                  onChange={e => {
                                    const rej = Math.max(0, parseInt(e.target.value) || 0);
                                    setHtRejectionQty(rej);
                                    setHtQtySentToPlating(prev => Math.max(0, htQtyReceived - rej));
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-rose-200 focus:border-rose-500 rounded p-1.5 font-mono font-bold text-rose-600 dark:text-rose-450"
                                />
                              </div>
                            </div>

                            {/* Quantity Allocation Control Section */}
                            <div className="bg-slate-100/85 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                              <h5 className="font-bold text-slate-700 dark:text-slate-350 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#3B82F6] inline-block"></span>
                                Material Quantity Allocation & Balance Tracker
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-slate-450 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty Received From Prod (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={htQtyReceived}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-blue-600 dark:text-blue-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Quantity received from Production (Unmodifiable)"
                                  />
                                </div>
                                
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty to Send to Plating (KG)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={htQtyReceived}
                                    value={htQtySentToPlating}
                                    onChange={e => setHtQtySentToPlating(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-white dark:bg-slate-950 font-mono font-extrabold text-[12px] text-purple-700 dark:text-purple-400 border border-purple-200 focus:border-purple-500 rounded p-1.5 focus:outline-none"
                                    title="How much quantity we send to Plating"
                                  />
                                </div>

                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Remaining Balance Qty (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={Math.max(0, htQtyReceived - htQtySentToPlating - htRejectionQty)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-amber-700 dark:text-amber-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Remaining Quantity = Received - Sent to Plating - Rejection"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleCompleteHeatTreatment(job)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                              >
                                Save Furnace logs & Route to plating
                              </button>
                              <button
                                onClick={() => setActiveHtJob(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ============================================== */}
                        {/* 3. PLATING METRICS UPDATE */}
                        {/* ============================================== */}
                        {isProcessing && activeDept === 'Plating' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-3 font-sans">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record Coating Thickness & Route to Packing</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-slate-400 mb-1">Cylinder Plating Bath Type</label>
                                <input
                                  type="text"
                                  value={platingType}
                                  onChange={e => setPlatingType(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Micron Thickness Verified (e.g. 5-10μm)</label>
                                <input
                                  type="text"
                                  value={platingThick}
                                  onChange={e => setPlatingThick(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Inductions Bath Duration</label>
                                <input
                                  type="text"
                                  value={platingDur}
                                  onChange={e => setPlatingDur(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                />
                              </div>
                              <div>
                                <label className="block text-rose-500 font-semibold mb-1">Coating Rejection (KG)</label>
                                <input
                                  type="number"
                                  value={platingRejectionQty}
                                  onChange={e => {
                                    const rej = Math.max(0, parseInt(e.target.value) || 0);
                                    setPlatingRejectionQty(rej);
                                    setPlatingQtySentToPacking(prev => Math.max(0, platingQtyReceived - rej));
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-rose-200 focus:border-rose-500 rounded p-1.5 font-mono font-bold text-rose-600 dark:text-rose-450"
                                />
                              </div>
                            </div>

                            {/* Quantity Allocation Control Section */}
                            <div className="bg-slate-100/85 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                              <h5 className="font-bold text-slate-700 dark:text-slate-350 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#3B82F6] inline-block"></span>
                                Material Quantity Allocation & Balance Tracker (Plating to Packing)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-slate-450 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty Received From HT/Prod (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={platingQtyReceived}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-blue-600 dark:text-blue-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Quantity received from Heat Treatment / Production (Unmodifiable)"
                                  />
                                </div>
                                
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty to Send for Packing (KG)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={platingQtyReceived}
                                    value={platingQtySentToPacking}
                                    onChange={e => setPlatingQtySentToPacking(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-white dark:bg-slate-950 font-mono font-extrabold text-[12px] text-purple-700 dark:text-purple-400 border border-purple-200 focus:border-purple-500 rounded p-1.5 focus:outline-none"
                                    title="How much quantity we send for Packing"
                                  />
                                </div>

                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Remaining/Pending Qty (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={Math.max(0, platingQtyReceived - platingQtySentToPacking - platingRejectionQty)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-amber-700 dark:text-amber-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Pending Qty = Received from HT - Sent for Packing - Rejection"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleCompletePlating(job)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                              >
                                Complete Coating & Route to packing
                              </button>
                              <button
                                onClick={() => setActivePlatingJob(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ============================================== */}
                        {/* 4. PACKING SPECS UPDATE */}
                        {/* ============================================== */}
                        {isProcessing && activeDept === 'Packing' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-4 font-sans">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record boxing count & weight balance</h4>
                            
                            {/* Packing Specifications */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-slate-450 mb-1 font-semibold">Total Corrugated Boxes count</label>
                                <input
                                  type="number"
                                  value={packBoxCount}
                                  onChange={e => setPackBoxCount(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-450 mb-1 font-semibold">Materials Boxing Style</label>
                                <input
                                  type="text"
                                  value={packStyle}
                                  onChange={e => setPackStyle(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-rose-500 font-semibold mb-1">Packing Rejection (KG)</label>
                                <input
                                  type="number"
                                  value={packRejectionQty}
                                  onChange={e => {
                                    const rej = Math.max(0, parseInt(e.target.value) || 0);
                                    setPackRejectionQty(rej);
                                    setPackQtySentToStore(prev => Math.max(0, packQtyReceived - rej));
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-rose-200 focus:border-rose-500 rounded p-1.5 font-mono font-bold text-rose-600 dark:text-rose-450"
                                />
                              </div>
                            </div>

                            {/* Quantity Allocation Control Section */}
                            <div className="bg-slate-100/85 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                              <h5 className="font-bold text-slate-700 dark:text-slate-350 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#3B82F6] inline-block"></span>
                                Material Quantity Allocation & Balance Tracker (Packing to Store)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-slate-450 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty Received From Plating (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={packQtyReceived}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-blue-600 dark:text-blue-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Quantity received from Zinc Plating (Unmodifiable)"
                                  />
                                </div>
                                
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty to Send for Store (KG)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={packQtyReceived}
                                    value={packQtySentToStore}
                                    onChange={e => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setPackQtySentToStore(val);
                                      setPackQty(val);
                                    }}
                                    className="w-full bg-white dark:bg-slate-950 font-mono font-extrabold text-[12px] text-purple-700 dark:text-purple-400 border border-purple-200 focus:border-purple-500 rounded p-1.5 focus:outline-none"
                                    title="How much quantity we send to Store"
                                  />
                                </div>

                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Remaining/Pending Qty (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={Math.max(0, packQtyReceived - packQtySentToStore - packRejectionQty)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-amber-700 dark:text-amber-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Pending Qty = Received from Plating - Sent for Store - Rejection"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 pt-1 font-sans">
                              <button
                                onClick={() => handleCompletePacking(job)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                              >
                                Box completed cargos & Route to stores
                              </button>
                              <button
                                onClick={() => setActivePackingJob(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ============================================== */}
                        {/* 5. STOREHOUSE METRICS UPDATE */}
                        {/* ============================================== */}
                        {isProcessing && activeDept === 'Store' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-4 font-sans">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record Ingress locations & Quantities</h4>
                            
                            {/* Warehouse specifications and rejections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-slate-450 mb-1 font-semibold">Warehouse Bin shelf Coordinate</label>
                                <input
                                  type="text"
                                  value={storeBinLoc}
                                  onChange={e => setStoreBinLoc(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 focus:outline-none font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-rose-500 mb-1 font-semibold">Store Rejection/Discrepancy (KG)</label>
                                <input
                                  type="number"
                                  value={storeRejectionQty}
                                  onChange={e => {
                                    const rej = Math.max(0, parseInt(e.target.value) || 0);
                                    setStoreRejectionQty(rej);
                                    setStoreQtySentToDispatch(prev => Math.max(0, storeQtyReceived - rej));
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-rose-200 focus:border-rose-500 rounded p-1.5 font-mono font-bold text-rose-600 dark:text-rose-455"
                                />
                              </div>
                            </div>

                            {/* Quantity Allocation Control Section */}
                            <div className="bg-slate-100/85 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                              <h5 className="font-bold text-slate-700 dark:text-slate-350 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#10B981] inline-block"></span>
                                Material Quantity Allocation & Balance Tracker (Store to Dispatch)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-slate-450 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty Received From Packing (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={storeQtyReceived}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-blue-600 dark:text-blue-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Quantity received from Packing (Unmodifiable)"
                                  />
                                </div>
                                
                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Qty to Send for Dispatch (KG)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={storeQtyReceived}
                                    value={storeQtySentToDispatch}
                                    onChange={e => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setStoreQtySentToDispatch(val);
                                      setStoreVerifiedQty(val);
                                    }}
                                    className="w-full bg-white dark:bg-slate-950 font-mono font-extrabold text-[12px] text-purple-700 dark:text-purple-400 border border-purple-200 focus:border-purple-500 rounded p-1.5 focus:outline-none"
                                    title="Verified quantity stocked and ready to dispatch"
                                  />
                                </div>

                                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                                  <label className="block text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                                    Remaining/Pending Qty (KG)
                                  </label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={Math.max(0, storeQtyReceived - storeQtySentToDispatch - storeRejectionQty)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 font-mono font-extrabold text-[12px] text-amber-700 dark:text-amber-400 border border-slate-205 dark:border-slate-800 rounded p-1.5 focus:outline-none"
                                    title="Pending Qty = Received from Packing - Sent to Dispatch - Rejection"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleCompleteStore(job)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                              >
                                Verify Stock weight & Store in warehouse
                              </button>
                              <button
                                onClick={() => setActiveStoreJob(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* C. OUTBOUND TRANSFERS LOGGED FOR ARCHIVING */}
          {activeSubView === 'completed' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                📋 Completed Outbound Ledgers
              </h3>

              {completedDepartmentLogs.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-2xl">⏳</span>
                  <p className="text-slate-400 text-xs font-mono font-medium">No archived outbound handoffs recorded in active session</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 font-mono text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-3">Job Card</th>
                        <th className="py-2.5 px-3">Dispatched to</th>
                        <th className="py-2.5 px-3">Handoff Weight</th>
                        <th className="py-2.5 px-3">Recipient Signer</th>
                        <th className="py-2.5 px-3">Handoff Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedDepartmentLogs.map(m => (
                        <tr key={m.movementId} className="border-b last:border-b-0 border-slate-200 dark:border-slate-850 hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-mono font-bold text-indigo-500">{m.jobCardNo}</td>
                          <td className="py-3 px-3 font-semibold">{m.toDepartment}</td>
                          <td className="py-3 px-3 font-mono font-semibold">{m.quantity} KG</td>
                          <td className="py-3 px-3">{m.acceptedBy || 'System auto-close'}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">
                            {new Date(m.acceptedDate || m.transferDate).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
