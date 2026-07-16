import React, { useState, useEffect, useRef } from 'react';
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
import { JobCard, MaterialMovement, Department, UserProfile, SavedItem } from '../types';
import { DBService } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface DepartmentOperationsProps {
  currentUser: UserProfile;
  jobCards: JobCard[];
  movements: MaterialMovement[];
  onCreateJobCard: (job: any) => void;
  onUpdateJobCard: (jobCardNo: string, updates: Partial<JobCard>) => void;
  onCreateMovement: (mov: {
    jobCardNo: string;
    fromDepartment: Department;
    toDepartment: Department | 'Completed';
    quantity: number;
    remarks?: string;
    isIssueRequest?: boolean;
    requestedUnit?: 'PCS' | 'KGS';
    requestedQty?: number;
  }) => void;
  onAcceptMovement: (
    movementId: string, 
    remarks?: string, 
    extraFields?: { allottedLocation?: string; rackNo?: string; quantity?: number; issueStatus?: 'Issued' | 'Rejected' }
  ) => Promise<void> | any;
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

  // --- HORIZONTAL SWIPE FOR DEPARTMENT SUBVIEWS ---
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target && typeof target.closest === 'function') {
      if (
        target.closest('.overflow-x-auto') || 
        target.closest('table') || 
        target.closest('input') || 
        target.closest('textarea') || 
        target.closest('select') ||
        target.closest('button')
      ) {
        return;
      }
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target && typeof target.closest === 'function') {
      if (target.closest('.overflow-x-auto') || target.closest('table')) {
        return;
      }
    }
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    if (!isSwiping.current) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      if (absDeltaX > absDeltaY && absDeltaX > 15 && absDeltaY < 30) {
        isSwiping.current = true;
      }
    }
    if (isSwiping.current) {
      touchCurrentX.current = currentX;
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    const deltaX = touchCurrentX.current - touchStartX.current;
    const subViews: ('incoming' | 'operations' | 'completed')[] = ['incoming', 'operations', 'completed'];
    const curIndex = subViews.indexOf(activeSubView);

    if (Math.abs(deltaX) > 75 && curIndex !== -1) {
      if (deltaX < 0) {
        // Swipe Left -> Next
        if (curIndex < subViews.length - 1) {
          setActiveSubView(subViews[curIndex + 1]);
        }
      } else {
        // Swipe Right -> Prev
        if (curIndex > 0) {
          setActiveSubView(subViews[curIndex - 1]);
        }
      }
    }
    isSwiping.current = false;
  };

  const [rejectionNotes, setRejectionNotes] = useState('');
  const [activeRejectionId, setActiveRejectionId] = useState<string | null>(null);

  // Track material movements / job card custody acceptance animations
  const [acceptedMovementIds, setAcceptedMovementIds] = useState<Record<string, 'animating' | 'done'>>({});

  // --- FORM STATES ---
  // Create Order (Dispatch)
  const [partyName, setPartyName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [orderQty, setOrderQty] = useState<number>(1000);
  const [htRequired, setHtRequired] = useState(false);
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [processType, setProcessType] = useState<'Manufacturing' | 'Purchase'>('Manufacturing');

  // --- MASTER SAVED ITEMS FOR AUTOCOMPLETE ---
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showPurchaseItemDropdown, setShowPurchaseItemDropdown] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const items = await DBService.getSavedItems();
        setSavedItems(items);
      } catch (err) {
        console.error("Failed to load saved items:", err);
      }
    };
    loadItems();
  }, [jobCards]);

  // Purchase Department Inputs
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseBill, setPurchaseBill] = useState('');
  const [purchaseRemarks, setPurchaseRemarks] = useState('');
  const [purchaseRecQty, setPurchaseRecQty] = useState<number>(0);
  const [purchaseRejQty, setPurchaseRejQty] = useState<number>(0);
  const [purchaseSentQty, setPurchaseSentQty] = useState<number>(0);
  const [purchaseItemName, setPurchaseItemName] = useState('');
  const [purchaseItemCode, setPurchaseItemCode] = useState('');
  const [activePurchaseJob, setActivePurchaseJob] = useState<string | null>(null);
  const [purchaseTargetDept, setPurchaseTargetDept] = useState<'Store' | 'Plating' | 'Heat Treatment'>('Store');

  // Store Department target selection for Purchase route
  const [storeTargetDept, setStoreTargetDept] = useState<'Packing' | 'Dispatch'>('Dispatch');

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
  const [packPcsPerBagOrBox, setPackPcsPerBagOrBox] = useState<number>(100);
  const [packTotalPcs, setPackTotalPcs] = useState<number>(500);
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
  const [storeIncomingLocs, setStoreIncomingLocs] = useState<Record<string, string>>({});
  const [storeIncomingRacks, setStoreIncomingRacks] = useState<Record<string, string>>({});
  const [purchaseIncomingRouting, setPurchaseIncomingRouting] = useState<Record<string, 'Packing' | 'Store'>>({});

  // Outbound Dispatch Inputs
  const [dispInvoice, setDispInvoice] = useState('INV-2026-');
  const [dispVehicle, setDispVehicle] = useState('MH-12-');
  const [dispQty, setDispQty] = useState<number>(0);
  const [activeDispJob, setActiveDispJob] = useState<string | null>(null);
  const [activeRequestJob, setActiveRequestJob] = useState<string | null>(null);
  const [requestUnit, setRequestUnit] = useState<'KGS' | 'PCS'>('KGS');
  const [requestQty, setRequestQty] = useState<number>(0);
  const [requestRemarks, setRequestRemarks] = useState<string>('');

  // Storekeeper issue states
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [issueWeight, setIssueWeight] = useState<number>(0);
  const [issueRack, setIssueRack] = useState<string>('');
  const [issueLoc, setIssueLoc] = useState<string>('');
  const [issueRemarksState, setIssueRemarksState] = useState<string>('');
  const [activeIssueRejectionId, setActiveIssueRejectionId] = useState<string | null>(null);
  const [issueRejectionNotes, setIssueRejectionNotes] = useState<string>('');

  const filteredItems = savedItems.filter(item => 
    item.itemName.toLowerCase().includes(itemName.toLowerCase())
  );

  const filteredPurchaseItems = savedItems.filter(item => 
    item.itemName.toLowerCase().includes(purchaseItemName.toLowerCase())
  );

  // --- ACTIONS ---
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName || !itemName || !itemCode || orderQty <= 0) return;

    onCreateJobCard({
      partyName,
      itemName,
      itemCode,
      orderQty,
      heatTreatmentRequired: processType === 'Purchase' ? false : htRequired,
      currentQty: orderQty,
      currentDepartment: processType === 'Purchase' ? 'Purchase' : 'Production', // immediately routed to first node
      status: 'Pending',
      processType
    });

    // Reset Form
    setPartyName('');
    setItemName('');
    setItemCode('');
    setOrderQty(1000);
    setHtRequired(false);
    setDispatchRemarks('');
  };

  const handleDirectPurchaseEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupplier || !purchaseItemName || !purchaseItemCode || purchaseRecQty <= 0) return;

    if (purchaseSentQty > purchaseRecQty) {
      alert(`Error: Sent quantity (${purchaseSentQty} KG) cannot exceed the received quantity (${purchaseRecQty} KG).`);
      return;
    }
    if (purchaseSentQty + purchaseRejQty > purchaseRecQty) {
      alert(`Error: Combined sent quantity (${purchaseSentQty} KG) and rejection quantity (${purchaseRejQty} KG) cannot exceed the received quantity (${purchaseRecQty} KG).`);
      return;
    }

    onCreateJobCard({
      partyName: purchaseSupplier,
      itemName: purchaseItemName,
      itemCode: purchaseItemCode,
      orderQty: purchaseRecQty,
      heatTreatmentRequired: purchaseTargetDept === 'Heat Treatment',
      currentQty: purchaseSentQty,
      currentDepartment: purchaseTargetDept, // Dynamically route to selected department
      status: 'Pending Acceptance', // Selected department needs to accept custody
      processType: 'Purchase',
      purchaseDetails: {
        supplierName: purchaseSupplier,
        billNo: purchaseBill,
        receivedQty: purchaseRecQty,
        rejectionQty: purchaseRejQty,
        sentToStore: purchaseSentQty,
        remarks: purchaseRemarks
      }
    });

    // Reset Form
    setPurchaseSupplier('');
    setPurchaseBill('');
    setPurchaseItemName('');
    setPurchaseItemCode('');
    setPurchaseRemarks('');
    setPurchaseRecQty(0);
    setPurchaseRejQty(0);
    setPurchaseSentQty(0);
  };

  // Switch status for purchase start
  const handleStartPurchase = (jCard: JobCard) => {
    onUpdateJobCard(jCard.jobCardNo, { status: 'In Process' });
  };

  const handleCompletePurchase = (jCard: JobCard) => {
    if (!purchaseSupplier || purchaseSentQty <= 0) return;

    if (purchaseSentQty > purchaseRecQty) {
      alert(`Error: Sent quantity (${purchaseSentQty} KG) cannot exceed the received quantity (${purchaseRecQty} KG).`);
      return;
    }
    if (purchaseSentQty + purchaseRejQty > purchaseRecQty) {
      alert(`Error: Combined sent quantity (${purchaseSentQty} KG) and rejection quantity (${purchaseRejQty} KG) cannot exceed the received quantity (${purchaseRecQty} KG).`);
      return;
    }

    onUpdateJobCard(jCard.jobCardNo, {
      purchaseDetails: {
        supplierName: purchaseSupplier,
        billNo: purchaseBill,
        receivedQty: purchaseRecQty,
        rejectionQty: purchaseRejQty,
        sentToStore: purchaseSentQty,
        remarks: purchaseRemarks
      },
      currentQty: purchaseSentQty,
      balanceQty: Math.max(0, (jCard.balanceQty ?? jCard.orderQty) - purchaseRejQty),
      heatTreatmentRequired: jCard.heatTreatmentRequired || purchaseTargetDept === 'Heat Treatment'
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Purchase',
      toDepartment: purchaseTargetDept, // Dynamically route to selected department
      quantity: purchaseSentQty,
      remarks: `Material inwarded from supplier: ${purchaseSupplier}. Received: ${purchaseRecQty} KG, Dispatched to ${purchaseTargetDept}: ${purchaseSentQty} KG, Rejections: ${purchaseRejQty} KG. Remarks: ${purchaseRemarks}`
    });

    setPurchaseSupplier('');
    setPurchaseBill('');
    setPurchaseRemarks('');
    setPurchaseRecQty(0);
    setPurchaseRejQty(0);
    setPurchaseSentQty(0);
    setActivePurchaseJob(null);
  };

  // Switch status for production start
  const handleStartProduction = (jCard: JobCard) => {
    onUpdateJobCard(jCard.jobCardNo, { status: 'In Process' });
  };

  const handleCompleteProduction = (jCard: JobCard) => {
    if (!prodOpName || prodQty <= 0) return;

    const totalMovedFromProdBefore = movements
      .filter(m => m.jobCardNo.toLowerCase() === jCard.jobCardNo.toLowerCase() && m.fromDepartment === 'Production')
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalProducedIncludingCurrent = totalMovedFromProdBefore + prodQty;

    // Update job card specs
    onUpdateJobCard(jCard.jobCardNo, {
      operatorName: prodOpName,
      currentQty: prodQty,
      // Formula: Balance = Order Qty - Overall Processed Qty
      balanceQty: Math.max(0, jCard.orderQty - totalProducedIncludingCurrent)
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

    if (sentToPlating > receivedFromProd) {
      alert(`Error: Sent quantity (${sentToPlating} KG) cannot exceed the received quantity (${receivedFromProd} KG).`);
      return;
    }
    if (sentToPlating + htRejectionQty > receivedFromProd) {
      alert(`Error: Combined sent quantity (${sentToPlating} KG) and rejection quantity (${htRejectionQty} KG) cannot exceed the received quantity (${receivedFromProd} KG).`);
      return;
    }

    const remainingQty = Math.max(0, receivedFromProd - sentToPlating - htRejectionQty);

    const prevHT = jCard.heatTreatmentDetails;
    const totalRejectionInHT = (prevHT?.rejectionQty || 0) + htRejectionQty;
    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToPlating: (jCard.customRoutedToPlating || 0) + sentToPlating,
      balanceQty: Math.max(0, (jCard.balanceQty ?? jCard.orderQty) - htRejectionQty),
      heatTreatmentDetails: {
        hardnessRequired: htHardness,
        temperature: htTemp,
        cycleTime: htDuration,
        rejectionQty: totalRejectionInHT,
        qtyReceivedFromProd: (prevHT?.qtyReceivedFromProd || 0) + receivedFromProd,
        qtySentToPlating: (prevHT?.qtySentToPlating || 0) + sentToPlating,
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

    if (sentToPacking > receivedFromHt) {
      alert(`Error: Sent quantity (${sentToPacking} KG) cannot exceed the received quantity (${receivedFromHt} KG).`);
      return;
    }
    if (sentToPacking + platingRejectionQty > receivedFromHt) {
      alert(`Error: Combined sent quantity (${sentToPacking} KG) and rejection quantity (${platingRejectionQty} KG) cannot exceed the received quantity (${receivedFromHt} KG).`);
      return;
    }

    const remainingQty = Math.max(0, receivedFromHt - sentToPacking - platingRejectionQty);

    const prevPlating = jCard.platingDetails;
    const totalRejectionInPlating = (prevPlating?.rejectionQty || 0) + platingRejectionQty;
    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToPacking: (jCard.customRoutedToPacking || 0) + sentToPacking,
      balanceQty: Math.max(0, (jCard.balanceQty ?? jCard.orderQty) - platingRejectionQty),
      platingDetails: {
        platingType,
        micronThickness: platingThick,
        durationMinutes: platingDur,
        rejectionQty: totalRejectionInPlating,
        qtyReceivedFromHt: (prevPlating?.qtyReceivedFromHt || 0) + receivedFromHt,
        qtySentToPacking: (prevPlating?.qtySentToPacking || 0) + sentToPacking,
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

    if (sentToStore > receivedFromPlating) {
      alert(`Error: Sent quantity (${sentToStore} KG) cannot exceed the received quantity (${receivedFromPlating} KG).`);
      return;
    }
    if (sentToStore + packRejectionQty > receivedFromPlating) {
      alert(`Error: Combined sent quantity (${sentToStore} KG) and rejection quantity (${packRejectionQty} KG) cannot exceed the received quantity (${receivedFromPlating} KG).`);
      return;
    }

    const remainingQty = Math.max(0, receivedFromPlating - sentToStore - packRejectionQty);

    const prevPacking = jCard.packingDetails;
    const totalPackedIncludingCurrent = (prevPacking?.qtySentToStore || 0) + sentToStore;

    const htRejectionTotal = jCard.heatTreatmentDetails?.rejectionQty || 0;
    const platingRejectionTotal = jCard.platingDetails?.rejectionQty || 0;
    const packingRejectionTotal = (prevPacking?.rejectionQty || 0) + packRejectionQty;
    const totalRejections = htRejectionTotal + platingRejectionTotal + packingRejectionTotal;

    onUpdateJobCard(jCard.jobCardNo, {
      customRoutedToStore: (jCard.customRoutedToStore || 0) + sentToStore,
      packingDetails: {
        packedQty: totalPackedIncludingCurrent,
        boxCount: (prevPacking?.boxCount || 0) + packBoxCount,
        packingType: packStyle,
        rejectionQty: packingRejectionTotal,
        qtyReceivedFromPlating: (prevPacking?.qtyReceivedFromPlating || 0) + receivedFromPlating,
        qtySentToStore: totalPackedIncludingCurrent,
        qtyRemaining: remainingQty,
        pcsPerBagOrBox: packPcsPerBagOrBox,
        totalPcs: (prevPacking?.totalPcs || 0) + packTotalPcs,
      },
      currentQty: sentToStore,
      balanceQty: Math.max(0, jCard.orderQty - totalPackedIncludingCurrent - totalRejections)
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Packing',
      toDepartment: 'Store',
      quantity: sentToStore,
      remarks: `Packed in ${packBoxCount} boxes (${packPcsPerBagOrBox} pcs/box, Total: ${packTotalPcs} pcs). Quality verified. Recv from Plating: ${receivedFromPlating} KG, Sent to Store: ${sentToStore} KG, Rejections: ${packRejectionQty} KG, Remaining: ${remainingQty} KG.`
    });

    setPackRejectionQty(0);
    setPackQtyReceived(0);
    setPackQtySentToStore(0);
    setActivePackingJob(null);
  };

  const handleCompleteStore = (jCard: JobCard) => {
    const receivedFromPacking = storeQtyReceived;
    const sentToNext = storeQtySentToDispatch;

    if (sentToNext > receivedFromPacking) {
      alert(`Error: Sent quantity (${sentToNext} KG) cannot exceed the received quantity (${receivedFromPacking} KG).`);
      return;
    }
    if (sentToNext + storeRejectionQty > receivedFromPacking) {
      alert(`Error: Combined sent quantity (${sentToNext} KG) and rejection quantity (${storeRejectionQty} KG) cannot exceed the received quantity (${receivedFromPacking} KG).`);
      return;
    }

    const remainingQty = Math.max(0, receivedFromPacking - sentToNext - storeRejectionQty);
    const targetDept = jCard.processType === 'Purchase' ? storeTargetDept : 'Dispatch';

    onUpdateJobCard(jCard.jobCardNo, {
      storeDetails: {
        verifiedQty: sentToNext,
        locationBin: storeBinLoc,
        rejectionQty: storeRejectionQty,
        qtyReceivedFromPacking: receivedFromPacking,
        qtySentToDispatch: targetDept === 'Dispatch' ? sentToNext : 0,
        qtyRemaining: remainingQty,
        pcsPerBagOrBox: jCard.packingDetails?.pcsPerBagOrBox,
        totalPcs: jCard.packingDetails?.totalPcs,
      },
      currentQty: sentToNext,
      balanceQty: Math.max(0, jCard.orderQty - sentToNext)
    });

    onCreateMovement({
      jobCardNo: jCard.jobCardNo,
      fromDepartment: 'Store',
      toDepartment: targetDept, // Dynamic transit target: Packing or Dispatch
      quantity: sentToNext,
      remarks: `Stored in bin location: ${storeBinLoc}. Recv: ${receivedFromPacking} KG, Sent to ${targetDept}: ${sentToNext} KG, Rejections: ${storeRejectionQty} KG, Remaining Qty: ${remainingQty} KG.`
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
    const transitMov = movements.find(m => m.jobCardNo.toLowerCase() === jCard.jobCardNo.toLowerCase() && m.toDepartment === 'Dispatch' && !m.accepted);
    if (transitMov) {
      onAcceptMovement(transitMov.movementId, `Dispatched via Invoice ${dispInvoice}`);
    }

    setActiveDispJob(null);
  };

  const handleLocalAccept = async (mov: MaterialMovement) => {
    // 1. Mark as animating
    setAcceptedMovementIds(prev => ({ ...prev, [mov.movementId]: 'animating' }));
    
    // 2. Play subtle vibration pattern if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(55); } catch (_) {}
    }

    // 3. Delay to let acceptance animation play out before database update triggers deletion
    setTimeout(async () => {
      try {
        if (activeDept === 'Store') {
          if (mov.fromDepartment === 'Purchase' && purchaseIncomingRouting[mov.movementId] === 'Packing') {
            await onAcceptMovement(mov.movementId);
            onCreateMovement({
              jobCardNo: mov.jobCardNo,
              fromDepartment: 'Store',
              toDepartment: 'Packing',
              quantity: mov.quantity,
              remarks: `Auto-routed purchased material from Store custody to Packing.`
            });
          } else {
            const loc = storeIncomingLocs[mov.movementId] || '';
            const rack = storeIncomingRacks[mov.movementId] || '';
            await onAcceptMovement(mov.movementId, undefined, { allottedLocation: loc, rackNo: rack });
          }
        } else {
          await onAcceptMovement(mov.movementId);
        }
        
        // Mark as done
        setAcceptedMovementIds(prev => ({ ...prev, [mov.movementId]: 'done' }));
      } catch (err) {
        console.error("Failed to accept movement:", err);
        // Revert UI state on error so user can try again
        setAcceptedMovementIds(prev => {
          const updated = { ...prev };
          delete updated[mov.movementId];
          return updated;
        });
      }
    }, 1150); // Beautiful ~1.15 second animation window
  };

  // --- FILTERED LISTS ---
  // A. Incoming Transfers waiting for acceptance inside this active department
  const incomingTransfers = movements.filter(m => {
    return m.toDepartment === activeDept && !m.accepted;
  });

  const pendingIssueRequests = movements.filter(m => {
    return m.isIssueRequest && m.fromDepartment === 'Store' && !m.accepted;
  });

  // B. Job cards currently assigned to this department
  const activeDepartmentJobs = jobCards.filter(c => {
    if (c.completed) return false;
    
    // If the job card is pending custody acceptance BY THE CURRENT DEPARTMENT,
    // it shouldn't show up in the operational/processing queue until accepted.
    if (c.status === 'Pending Acceptance' && activeDept !== 'Dispatch') {
      const hasUnacceptedIncomingToMe = movements.some(m => 
        m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && 
        m.toDepartment === activeDept && 
        !m.accepted
      );
      if (hasUnacceptedIncomingToMe) {
        return false;
      }
    }
    // Dispatch owns tracking when completed or creating, otherwise matches exactly
    if (activeDept === 'Dispatch') {
      return true;
    }
    if (activeDept === 'Purchase') {
      const totalMovedFromPurchase = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.fromDepartment === 'Purchase')
        .reduce((sum, m) => sum + m.quantity, 0);
      const pendingPurchaseQty = c.orderQty - totalMovedFromPurchase;
      return c.currentDepartment === 'Purchase' || pendingPurchaseQty > 0;
    }
    if (activeDept === 'Production') {
      const totalMovedFromProd = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.fromDepartment === 'Production')
        .reduce((sum, m) => sum + m.quantity, 0);
      const pendingProdQty = c.orderQty - totalMovedFromProd;
      return c.currentDepartment === 'Production' || pendingProdQty > 0;
    }
    if (activeDept === 'Heat Treatment') {
      const totalReceivedAtHT = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.toDepartment === 'Heat Treatment' && m.accepted)
        .reduce((sum, m) => sum + m.quantity, 0);
      const totalRoutedFromHT = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.fromDepartment === 'Heat Treatment')
        .reduce((sum, m) => sum + m.quantity, 0);
      const pendingHTQty = totalReceivedAtHT - totalRoutedFromHT - (c.heatTreatmentDetails?.rejectionQty || 0);
      
      const isHTRequiredOrRouted = c.heatTreatmentRequired || totalReceivedAtHT > 0 || c.currentDepartment === 'Heat Treatment';
      if (!isHTRequiredOrRouted) return false;

      return c.currentDepartment === 'Heat Treatment' || (totalReceivedAtHT > 0 && pendingHTQty > 0);
    }
    if (activeDept === 'Plating') {
      const totalReceivedAtPlating = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.toDepartment === 'Plating' && m.accepted)
        .reduce((sum, m) => sum + m.quantity, 0);
      const totalRoutedFromPlating = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.fromDepartment === 'Plating')
        .reduce((sum, m) => sum + m.quantity, 0);
      const pendingPlatingQty = totalReceivedAtPlating - totalRoutedFromPlating - (c.platingDetails?.rejectionQty || 0);
      return c.currentDepartment === 'Plating' || (totalReceivedAtPlating > 0 && pendingPlatingQty > 0);
    }
    if (activeDept === 'Packing') {
      const totalReceivedAtPacking = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.toDepartment === 'Packing' && m.accepted)
        .reduce((sum, m) => sum + m.quantity, 0);
      const totalRoutedFromPacking = movements
        .filter(m => m.jobCardNo.toLowerCase() === c.jobCardNo.toLowerCase() && m.fromDepartment === 'Packing')
        .reduce((sum, m) => sum + m.quantity, 0);
      const pendingPackingQty = totalReceivedAtPacking - totalRoutedFromPacking - (c.packingDetails?.rejectionQty || 0);
      return c.currentDepartment === 'Packing' || (totalReceivedAtPacking > 0 && pendingPackingQty > 0);
    }
    return c.currentDepartment === activeDept;
  });

  // C. Archived Outbound transfers from this department (both accepted and pending custody downstream)
  const completedDepartmentLogs = movements.filter(m => {
    return m.fromDepartment === activeDept;
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

  const activeProcessingJob = jobCards.find(job => 
    ((activeDept as any) === 'Purchase' && activePurchaseJob === job.jobCardNo) ||
    (activeDept === 'Production' && activeProdJob === job.jobCardNo) ||
    (activeDept === 'Heat Treatment' && activeHtJob === job.jobCardNo) ||
    (activeDept === 'Plating' && activePlatingJob === job.jobCardNo) ||
    (activeDept === 'Packing' && activePackingJob === job.jobCardNo) ||
    (activeDept === 'Store' && activeStoreJob === job.jobCardNo)
  );

  let modalMetrics: any = null;
  if (activeProcessingJob) {
    const job = activeProcessingJob;
    const m = getJobCardProcessMetrics(job, movements);
    const totalMovedFromProd = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.fromDepartment === 'Production')
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const pendingProdQty = job.orderQty - totalMovedFromProd;
    const isRoutedDownstream = job.currentDepartment !== 'Production';

    // 1. Heat Treatment variables
    const totalReceivedAtHT = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.toDepartment === 'Heat Treatment' && mov.accepted)
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const htInputDisplay = totalReceivedAtHT > 0 ? totalReceivedAtHT : (job.currentDepartment === 'Heat Treatment' ? m.qtyReceivedFromProd : 0);
    const totalRoutedFromHT = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.fromDepartment === 'Heat Treatment')
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const pendingHTQty = Math.max(0, htInputDisplay - totalRoutedFromHT - (job.heatTreatmentDetails?.rejectionQty || 0));
    const isHTRoutedDownstream = job.currentDepartment !== 'Heat Treatment';

    // 2. Plating variables
    const totalReceivedAtPlating = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.toDepartment === 'Plating' && mov.accepted)
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const platingInputDisplay = totalReceivedAtPlating > 0 ? totalReceivedAtPlating : (job.currentDepartment === 'Plating' ? m.qtyReceivedAtPlating : 0);
    const totalRoutedFromPlating = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.fromDepartment === 'Plating')
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const pendingPlatingQty = Math.max(0, platingInputDisplay - totalRoutedFromPlating - (job.platingDetails?.rejectionQty || 0));
    const isPlatingRoutedDownstream = job.currentDepartment !== 'Plating';

    // 3. Packing variables
    const totalReceivedAtPacking = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.toDepartment === 'Packing' && mov.accepted)
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const packingInputDisplay = totalReceivedAtPacking > 0 ? totalReceivedAtPacking : (job.currentDepartment === 'Packing' ? m.qtyReceivedAtPacking : 0);
    const totalRoutedFromPacking = movements
      .filter(mov => mov.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && mov.fromDepartment === 'Packing')
      .reduce((sum, mov) => sum + mov.quantity, 0);
    const pendingPackingQty = Math.max(0, packingInputDisplay - totalRoutedFromPacking - (job.packingDetails?.rejectionQty || 0));
    const isPackingRoutedDownstream = job.currentDepartment !== 'Packing';

    modalMetrics = {
      m,
      totalMovedFromProd,
      pendingProdQty,
      isRoutedDownstream,
      htInputDisplay,
      totalRoutedFromHT,
      pendingHTQty,
      isHTRoutedDownstream,
      platingInputDisplay,
      totalRoutedFromPlating,
      pendingPlatingQty,
      isPlatingRoutedDownstream,
      packingInputDisplay,
      totalRoutedFromPacking,
      pendingPackingQty,
      isPackingRoutedDownstream
    };
  }

  const {
    m = {} as any,
    totalMovedFromProd = 0,
    pendingProdQty = 0,
    isRoutedDownstream = false,
    htInputDisplay = 0,
    totalRoutedFromHT = 0,
    pendingHTQty = 0,
    isHTRoutedDownstream = false,
    platingInputDisplay = 0,
    totalRoutedFromPlating = 0,
    pendingPlatingQty = 0,
    isPlatingRoutedDownstream = false,
    packingInputDisplay = 0,
    totalRoutedFromPacking = 0,
    pendingPackingQty = 0,
    isPackingRoutedDownstream = false
  } = modalMetrics || {};

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-6"
    >
      
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
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs text-slate-400 overflow-x-auto max-w-full shrink-0">
            <button
              onClick={() => setActiveSubView('incoming')}
              className={`flex-1 md:flex-none px-4 py-2.5 lg:py-1.5 min-h-[44px] md:min-h-[36px] rounded-md font-bold transition-all relative whitespace-nowrap text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubView === 'incoming' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              <span>Incoming Ingress</span>
              {incomingTransfers.length > 0 && (
                <span className="bg-red-500 text-white text-[9.5px] font-bold h-4.5 w-4.5 rounded-full flex items-center justify-center animate-bounce shrink-0">
                  {incomingTransfers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubView('operations')}
              className={`flex-1 md:flex-none px-4 py-2.5 lg:py-1.5 min-h-[44px] md:min-h-[36px] rounded-md font-bold transition-all whitespace-nowrap text-center flex items-center justify-center cursor-pointer ${
                activeSubView === 'operations' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              Active Floor Jobs
            </button>
            <button
              onClick={() => setActiveSubView('completed')}
              className={`flex-1 md:flex-none px-4 py-2.5 lg:py-1.5 min-h-[44px] md:min-h-[36px] rounded-md font-bold transition-all whitespace-nowrap text-center flex items-center justify-center cursor-pointer ${
                activeSubView === 'completed' ? 'bg-slate-800 text-white shadow' : 'hover:text-white'
              }`}
            >
              Completed Logs
            </button>
          </div>
        )}
      </div>      {/* ======================================================== */}
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
                <div className="relative">
                  <label className="block text-slate-400 font-semibold mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="M12 High-Tensile Bolt"
                    required
                    value={itemName}
                    onChange={e => {
                      setItemName(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6]"
                  />
                  {showItemDropdown && filteredItems.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
                      {filteredItems.map(item => (
                        <div
                          key={item.id}
                          onMouseDown={() => {
                            setItemName(item.itemName);
                            setItemCode(item.itemCode);
                            setShowItemDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <span className="font-medium truncate">{item.itemName}</span>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2 shrink-0">{item.itemCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
                    const isRequesting = activeRequestJob === job.jobCardNo;

                    const jobIssueRequests = movements.filter(m => 
                      m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && 
                      m.isIssueRequest
                    );
                    const pendingIssueReq = jobIssueRequests.find(m => !m.accepted);
                    const isIssuedByStore = jobIssueRequests.some(m => m.accepted && m.issueStatus === 'Issued');
                    
                    const canShip = job.currentDepartment === 'Completed' || (job.currentDepartment === 'Dispatch' && isIssuedByStore) || (job.currentDepartment === 'Dispatch' && jobIssueRequests.length === 0);
                    const canRequest = job.currentDepartment === 'Store' && !pendingIssueReq && !isIssuedByStore;

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
                            {canShip ? (
                              <button
                                onClick={() => {
                                  setActiveDispJob(isClosing ? null : job.jobCardNo);
                                  setDispQty(job.currentQty);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                Invoice & Ship
                              </button>
                            ) : pendingIssueReq ? (
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-3 py-1.5 rounded-md font-mono text-[10px] font-bold">
                                <span className="animate-pulse">⏳</span>
                                Pending Store Issue ({pendingIssueReq.requestedQty} {pendingIssueReq.requestedUnit})
                              </div>
                            ) : canRequest ? (
                              <button
                                onClick={() => {
                                  setActiveRequestJob(isRequesting ? null : job.jobCardNo);
                                  setRequestQty(job.currentQty);
                                  setRequestUnit('KGS');
                                  setRequestRemarks('');
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                              >
                                📩 Request Issue
                              </button>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-850 px-2.5 py-1.5 rounded-full font-mono">
                                Floor: {job.currentDepartment} ({job.status})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Request Issue Panel */}
                        {isRequesting && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-3 font-sans">
                            <div className="flex items-center justify-between font-semibold mb-1 text-slate-800 dark:text-slate-100">
                              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                                📩 Request Material Issue from Storekeeper
                              </span>
                              <button onClick={() => setActiveRequestJob(null)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="bg-slate-100/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                  Request Unit Selection
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRequestUnit('KGS');
                                      setRequestQty(job.currentQty);
                                    }}
                                    className={`flex-1 py-1.5 rounded-md font-bold text-[10.5px] border transition cursor-pointer ${
                                      requestUnit === 'KGS'
                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-extrabold'
                                        : 'bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-750'
                                    }`}
                                  >
                                    ⚖️ In KGS
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRequestUnit('PCS');
                                      setRequestQty(job.packingDetails?.totalPcs || 100);
                                    }}
                                    className={`flex-1 py-1.5 rounded-md font-bold text-[10.5px] border transition cursor-pointer ${
                                      requestUnit === 'PCS'
                                        ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-400 font-extrabold'
                                        : 'bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-750'
                                    }`}
                                  >
                                    🔢 In PCS (Pieces)
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                  Requested Quantity ({requestUnit})
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={requestQty || ''}
                                  onChange={e => setRequestQty(Math.max(1, parseInt(e.target.value) || 0))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded p-1.5 font-mono text-[11px] font-bold text-slate-800 dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                  Remarks for Storekeeper
                                </label>
                                <input
                                  type="text"
                                  placeholder="E.g., Urgent shipment requested by evening..."
                                  value={requestRemarks}
                                  onChange={e => setRequestRemarks(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded p-1.5 text-[11px] text-slate-800 dark:text-white"
                                />
                              </div>
                            </div>

                            <button
                              onClick={async () => {
                                if (!requestQty || requestQty <= 0) return;
                                try {
                                  await onCreateMovement({
                                    jobCardNo: job.jobCardNo,
                                    fromDepartment: 'Store',
                                    toDepartment: 'Dispatch',
                                    quantity: job.currentQty,
                                    isIssueRequest: true,
                                    requestedUnit: requestUnit,
                                    requestedQty: requestQty,
                                    remarks: requestRemarks || `Dispatch requested issue in ${requestUnit}`
                                  });
                                  setActiveRequestJob(null);
                                } catch (err) {
                                  console.error("Failed to send issue request", err);
                                }
                              }}
                              className="w-full bg-indigo-600 text-white hover:bg-indigo-500 py-2 rounded font-bold uppercase tracking-wider text-xs shadow-sm mt-1 cursor-pointer"
                            >
                              Submit Issue Request to Storekeeper
                            </button>
                          </div>
                        )}

                        {/* Invoice & Ship execution panel */}
                        {isClosing && (
                          <div className="mt-4 pt-4 border-t border-slate-210 text-xs space-y-3 font-sans">
                            <div className="flex items-center justify-between font-semibold mb-1 text-slate-800 dark:text-white">
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
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded p-1.5 font-mono text-slate-800 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Vehicle / Carrier Registrations</label>
                                  <input
                                  type="text"
                                  value={dispVehicle}
                                  onChange={e => setDispVehicle(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded p-1.5 font-mono text-slate-800 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Final Dispatch quantity (KG)</label>
                                <input
                                  type="number"
                                  value={dispQty}
                                  onChange={e => setDispQty(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded p-1.5 font-mono text-slate-800 dark:text-white"
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
      {/* PURCHASE SPECIFIC MODULE: DIRECT GOODS ENTRY */}
      {/* ======================================================== */}
      {activeDept === 'Purchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Direct Purchase Goods Entry Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 mb-2">
              <Plus className="h-5 w-5 text-[#3B82F6]" />
              <h3 className="font-sans font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">
                Direct Purchase Goods Entry
              </h3>
            </div>

            <form onSubmit={handleDirectPurchaseEntry} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Supplier / Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jindal Steel Power"
                  required
                  value={purchaseSupplier}
                  onChange={e => setPurchaseSupplier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-slate-400 font-semibold mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Steel Wire Rods"
                    required
                    value={purchaseItemName}
                    onChange={e => {
                      setPurchaseItemName(e.target.value);
                      setShowPurchaseItemDropdown(true);
                    }}
                    onFocus={() => setShowPurchaseItemDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPurchaseItemDropdown(false), 200)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6]"
                  />
                  {showPurchaseItemDropdown && filteredPurchaseItems.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
                      {filteredPurchaseItems.map(item => (
                        <div
                          key={item.id}
                          onMouseDown={() => {
                            setPurchaseItemName(item.itemName);
                            setPurchaseItemCode(item.itemCode);
                            setShowPurchaseItemDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <span className="font-medium truncate">{item.itemName}</span>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2 shrink-0">{item.itemCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Item Code</label>
                  <input
                    type="text"
                    placeholder="e.g. WR-STEEL-5.5"
                    required
                    value={purchaseItemCode}
                    onChange={e => setPurchaseItemCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Bill / Invoice No</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-09"
                    required
                    value={purchaseBill}
                    onChange={e => setPurchaseBill(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-455 font-semibold mb-1">Received Quantity (KG)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseRecQty || ''}
                    onChange={e => {
                      const rec = Math.max(0, parseInt(e.target.value) || 0);
                      setPurchaseRecQty(rec);
                      setPurchaseSentQty(Math.max(0, rec - purchaseRejQty));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-rose-500 font-semibold mb-1">Rejection Qty (KG)</label>
                  <input
                    type="number"
                    value={purchaseRejQty || ''}
                    onChange={e => {
                      const rej = Math.max(0, parseInt(e.target.value) || 0);
                      setPurchaseRejQty(rej);
                      setPurchaseSentQty(Math.max(0, purchaseRecQty - rej));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-rose-200 focus:border-rose-500 rounded-lg px-3 py-2.5 text-rose-600 dark:text-rose-400 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-emerald-600 font-semibold mb-1">Sent to {purchaseTargetDept} (KG)</label>
                  <input
                    type="number"
                    readOnly
                    value={purchaseSentQty}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-100 font-mono font-bold focus:outline-none"
                    title="Calculated: Received - Rejection"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Send / Route Material To</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchaseTargetDept('Store')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition cursor-pointer text-xs ${
                      purchaseTargetDept === 'Store'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🏢 Store
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseTargetDept('Heat Treatment')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition cursor-pointer text-xs ${
                      purchaseTargetDept === 'Heat Treatment'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🔥 Heat Treatment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseTargetDept('Plating')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition cursor-pointer text-xs ${
                      purchaseTargetDept === 'Plating'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    💿 Plating Process
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Remarks / Quality Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter wire diameter, test certificate specs..."
                  value={purchaseRemarks}
                  onChange={e => setPurchaseRemarks(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-755 rounded-lg p-2.5 text-slate-855 dark:text-slate-100 focus:outline-none focus:border-[#3B82F6] font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg shadow-md transition-all uppercase tracking-wide font-mono text-xs border border-emerald-700 cursor-pointer"
              >
                Save Purchase Entry & Send to {purchaseTargetDept}
              </button>
            </form>
          </div>

          {/* Right Column: Workbench Operations for Purchase */}
          <div className="lg:col-span-2 space-y-4">
            {/* RENDER DYNAMIC SUBVIEW CONTENTS FOR PURCHASE WORKBENCH */}
            {activeSubView === 'incoming' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  📥 Pending Custody Receipts 
                </h3>
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xl">🙌</span>
                  <p className="text-slate-400 text-xs font-mono font-medium">Direct Inwarding Enabled. No incoming transfer receipts required.</p>
                </div>
              </div>
            )}

            {activeSubView === 'operations' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                  Active Floor Inwards Queue
                </h3>
                {activeDepartmentJobs.filter(job => job.currentDepartment === 'Purchase').length === 0 ? (
                  <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-2xl">🌱</span>
                    <p className="text-slate-400 text-xs font-mono font-medium">No purchase items currently in physical inwarding</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeDepartmentJobs.filter(job => job.currentDepartment === 'Purchase').map(job => {
                      const isProcessing = activePurchaseJob === job.jobCardNo;
                      return (
                        <div key={job.jobCardNo} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                            <div onClick={() => onSelectJobCard(job)} className="cursor-pointer hover:underline min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                  {job.jobCardNo}
                                </span>
                                <span className="font-sans font-extrabold text-slate-900 dark:text-white truncate">
                                  Supplier: {job.partyName}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                <strong>{job.itemName}</strong> | Target: {job.orderQty} KG
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                              {job.status === 'Pending' ? (
                                <button
                                  onClick={() => handleStartPurchase(job)}
                                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11.5px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none cursor-pointer"
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  Start Inwarding
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActivePurchaseJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      setPurchaseRecQty(job.orderQty);
                                      setPurchaseSentQty(job.orderQty);
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none cursor-pointer"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Record Metrics
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Purchase Job Metrics Subform */}
                          {isProcessing && (
                            <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-4 font-sans">
                              <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-[10px]">Record Inward Receipt Metrics</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="block text-slate-400 mb-1">Purchase Invoice/Bill Number</label>
                                  <input
                                    type="text"
                                    value={purchaseBill}
                                    onChange={e => setPurchaseBill(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-400 mb-1">Supplier Name</label>
                                  <input
                                    type="text"
                                    value={purchaseSupplier}
                                    onChange={e => setPurchaseSupplier(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-bold"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <label className="block text-slate-400 mb-1">Total Bill Weight (KG)</label>
                                  <input
                                    type="number"
                                    value={purchaseRecQty || ''}
                                    onChange={e => {
                                      const rec = Math.max(0, parseInt(e.target.value) || 0);
                                      setPurchaseRecQty(rec);
                                      setPurchaseSentQty(Math.max(0, rec - purchaseRejQty));
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-rose-500 mb-1">Rejection Weight (KG)</label>
                                  <input
                                    type="number"
                                    value={purchaseRejQty || ''}
                                    onChange={e => {
                                      const rej = Math.max(0, parseInt(e.target.value) || 0);
                                      setPurchaseRejQty(rej);
                                      setPurchaseSentQty(Math.max(0, purchaseRecQty - rej));
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-rose-200 rounded p-1.5 font-mono font-bold text-rose-600"
                                  />
                                </div>
                                <div>
                                  <label className="block text-emerald-600 mb-1">Sent to {purchaseTargetDept} (KG)</label>
                                  <input
                                    type="number"
                                    readOnly
                                    value={purchaseSentQty}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded p-1.5 font-mono font-bold"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-slate-400 mb-1">Send / Route Material To</label>
                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setPurchaseTargetDept('Store')}
                                    className={`py-1.5 px-3 rounded font-bold border text-center transition cursor-pointer text-xs ${
                                      purchaseTargetDept === 'Store'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    🏢 Store
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPurchaseTargetDept('Heat Treatment')}
                                    className={`py-1.5 px-3 rounded font-bold border text-center transition cursor-pointer text-xs ${
                                      purchaseTargetDept === 'Heat Treatment'
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-400'
                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    🔥 Heat Treatment
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPurchaseTargetDept('Plating')}
                                    className={`py-1.5 px-3 rounded font-bold border text-center transition cursor-pointer text-xs ${
                                      purchaseTargetDept === 'Plating'
                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    💿 Plating Process
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-slate-400 mb-1">Quality Inspection remarks</label>
                                <textarea
                                  rows={2}
                                  value={purchaseRemarks}
                                  onChange={e => setPurchaseRemarks(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5"
                                  placeholder="Physical condition, batch identification..."
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleCompletePurchase(job)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                                >
                                  Inward Cargo & Route to {purchaseTargetDept}
                                </button>
                                <button
                                  onClick={() => setActivePurchaseJob(null)}
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
        </div>
      )}

      {/* ======================================================== */}
      {/* OTHER DEPARTMENTS ACTIONS PANEL */}
      {/* ======================================================== */}
      {activeDept !== 'Dispatch' && activeDept !== 'Purchase' && (
        <div className="space-y-4">
          
          {/* A. INCOMING SUBVIEW (ACCEPTANCE AND REJECTIONS FLOW) */}
          {activeSubView === 'incoming' && (
            <div className="space-y-4">
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
                  <AnimatePresence mode="popLayout">
                    {incomingTransfers.map(mov => {
                      const isRejecting = activeRejectionId === mov.movementId;
                      const isAccepting = acceptedMovementIds[mov.movementId] === 'animating';
                      return (
                        <motion.div 
                          key={mov.movementId}
                          layout
                          initial={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, height: 0, y: -15, marginBottom: 0, padding: 0 }}
                          transition={{ duration: 0.4, ease: 'easeInOut' }}
                          className="relative bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-201 dark:border-slate-850 flex flex-col gap-3 overflow-hidden"
                        >
                          {/* Success confirmation overlay */}
                          {isAccepting && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 z-10 bg-emerald-50/95 dark:bg-emerald-950/95 flex flex-col items-center justify-center gap-1.5 p-4 text-center"
                            >
                              <motion.div
                                initial={{ scale: 0.5, rotate: -30 }}
                                animate={{ scale: [0.5, 1.25, 1], rotate: 0 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                                className="bg-emerald-500 text-white rounded-full p-2 shadow-lg shadow-emerald-500/20"
                              >
                                <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                              </motion.div>
                              <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.35 }}
                                className="text-emerald-700 dark:text-emerald-300 font-extrabold text-xs uppercase tracking-wider font-sans"
                              >
                                Custody Accepted! 🎉
                              </motion.p>
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.75 }}
                                transition={{ delay: 0.3 }}
                                className="text-emerald-600/90 dark:text-emerald-450 text-[10px] font-mono"
                              >
                                Moving to floor workbench...
                              </motion.p>
                            </motion.div>
                          )}

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

                              {activeDept === 'Store' && (
                                <div className="mt-3 pt-3 border-t border-slate-200/65 dark:border-slate-800 space-y-3 text-left">
                                  {mov.fromDepartment === 'Purchase' && (
                                    <div className="bg-slate-100/70 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">
                                        📥 Routing Disposition (Where should this purchased material go next?)
                                      </label>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setPurchaseIncomingRouting(prev => ({ ...prev, [mov.movementId]: 'Store' }))}
                                          className={`flex-1 py-1.5 px-2 rounded-md font-bold text-[11px] border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                            (purchaseIncomingRouting[mov.movementId] || 'Store') === 'Store'
                                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-sans'
                                              : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700 font-sans'
                                          }`}
                                        >
                                          🏢 Place into Store
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPurchaseIncomingRouting(prev => ({ ...prev, [mov.movementId]: 'Packing' }))}
                                          className={`flex-1 py-1.5 px-2 rounded-md font-bold text-[11px] border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                            purchaseIncomingRouting[mov.movementId] === 'Packing'
                                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-sans'
                                              : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 border-slate-200 dark:border-slate-700 font-sans'
                                          }`}
                                        >
                                          📦 Send to Packing
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {(mov.fromDepartment !== 'Purchase' || (purchaseIncomingRouting[mov.movementId] || 'Store') === 'Store') ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
                                          Allotted Location / Shelf Coordinate
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="E.g., Shelf-B3, BIN-7"
                                          value={storeIncomingLocs[mov.movementId] || ''}
                                          onChange={e => setStoreIncomingLocs(prev => ({ ...prev, [mov.movementId]: e.target.value }))}
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
                                          Rack No / Compartment
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="E.g., RACK-12, Section-A"
                                          value={storeIncomingRacks[mov.movementId] || ''}
                                          onChange={e => setStoreIncomingRacks(prev => ({ ...prev, [mov.movementId]: e.target.value }))}
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-900 flex items-center gap-2">
                                      <span className="text-sm">⚡</span>
                                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium font-sans">
                                        This purchased material will be immediately transferred downstream to the **Packing** queue.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-0 w-full sm:w-auto shrink-0">
                              <button
                                onClick={() => handleLocalAccept(mov)}
                                disabled={isAccepting}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-200 flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                              >
                                <Check className="h-4 w-4" />
                                <span>Accept Cargo</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveRejectionId(isRejecting ? null : mov.movementId);
                                  setRejectionNotes('');
                                }}
                                disabled={isAccepting}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-200 flex-1 sm:flex-none flex items-center justify-center min-h-[44px] cursor-pointer"
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
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {activeDept === 'Store' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  🚚 Dispatch Material Issue Requests
                </h3>
                {pendingIssueRequests.length === 0 ? (
                  <div className="text-center py-8 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-xl">📋</span>
                    <p className="text-slate-400 text-xs font-mono font-medium">No pending Dispatch issue requests found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {pendingIssueRequests.map(req => {
                        const isIssuing = activeIssueId === req.movementId;
                        const isRejectingReq = activeIssueRejectionId === req.movementId;
                        const isAccepting = acceptedMovementIds[req.movementId] === 'animating';
                        const correspondingJob = jobCards.find(c => c.jobCardNo.toLowerCase() === req.jobCardNo.toLowerCase());
                        
                        return (
                          <motion.div 
                            key={req.movementId}
                            layout
                            initial={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, height: 0, y: -15, marginBottom: 0, padding: 0 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className="relative bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-indigo-200/50 dark:border-indigo-900/40 flex flex-col gap-3 hover:border-indigo-300 transition-all text-left overflow-hidden"
                          >
                            {/* Success confirmation overlay */}
                            {isAccepting && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 z-10 bg-emerald-50/95 dark:bg-emerald-950/95 flex flex-col items-center justify-center gap-1.5 p-4 text-center"
                              >
                                <motion.div
                                  initial={{ scale: 0.5, rotate: -30 }}
                                  animate={{ scale: [0.5, 1.25, 1], rotate: 0 }}
                                  transition={{ duration: 0.45, ease: 'easeOut' }}
                                  className="bg-emerald-500 text-white rounded-full p-2 shadow-lg shadow-emerald-500/20"
                                >
                                  <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                                </motion.div>
                                <motion.p
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.15, duration: 0.35 }}
                                  className="text-emerald-700 dark:text-emerald-300 font-extrabold text-xs uppercase tracking-wider font-sans"
                                >
                                  Issue Confirmed! 🚚
                                </motion.p>
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 0.75 }}
                                  transition={{ delay: 0.3 }}
                                  className="text-emerald-600/90 dark:text-emerald-450 text-[10px] font-mono"
                                >
                                  Material released & handed over...
                                </motion.p>
                              </motion.div>
                            )}

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                              <div>
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                                    {req.jobCardNo}
                                  </span>
                                  <span className="text-slate-400 font-bold">Request ID: {req.movementId}</span>
                                </div>
                                <h4 className="font-extrabold text-slate-900 dark:text-white mt-2 font-sans text-[12px]">
                                  Party: {correspondingJob?.partyName || 'N/A'} | Item: {correspondingJob?.itemName || 'N/A'}
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                  Requested Unit: <strong className="text-pink-600 dark:text-pink-400">{req.requestedUnit || 'KGS'}</strong> | Qty: <strong className="text-indigo-600 dark:text-indigo-400">{(req.requestedQty || 0).toLocaleString()}</strong>
                                </p>
                                <p className="text-[10.5px] text-slate-500 mt-0.5 font-sans">
                                  Requested by: <strong className="text-slate-750 dark:text-slate-300">{req.transferBy}</strong> | Date: {new Date(req.transferDate).toLocaleDateString([], {hour:'2-digit', minute:'2-digit'})}
                                </p>
                                {req.remarks && (
                                  <p className="text-[11px] bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded border border-indigo-100/60 dark:border-indigo-950 text-indigo-700 dark:text-indigo-400 mt-2 font-sans italic">
                                    💬 Dispatch Remarks: "{req.remarks}"
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                                <button
                                  onClick={() => {
                                    setActiveIssueId(isIssuing ? null : req.movementId);
                                    setActiveIssueRejectionId(null);
                                    // Default weights
                                    setIssueWeight(correspondingJob?.currentQty || req.quantity);
                                    setIssueLoc(correspondingJob?.storeDetails?.locationBin || '');
                                    setIssueRack(correspondingJob?.storeDetails?.rackNo || '');
                                    setIssueRemarksState('');
                                  }}
                                  disabled={isAccepting}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold py-1.5 px-3 rounded-md transition duration-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                  Issue Material
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveIssueRejectionId(isRejectingReq ? null : req.movementId);
                                    setActiveIssueId(null);
                                    setIssueRejectionNotes('');
                                  }}
                                  disabled={isAccepting}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10.5px] font-bold py-1.5 px-3 rounded-md transition duration-200 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>

                            {/* Issue Material Confirmation Panel */}
                            {isIssuing && (
                              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-3 font-sans text-left bg-emerald-50/10 p-3 rounded-lg border border-dashed border-emerald-500/20">
                                <label className="block text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider text-[10px]">
                                  Release & Weight Verification Sign-off
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-slate-400 text-[10px] mb-1 font-bold uppercase">Actual Weight to Issue (KG)</label>
                                    <input
                                      type="number"
                                      value={issueWeight || ''}
                                      onChange={e => setIssueWeight(Math.max(1, parseFloat(e.target.value) || 0))}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold text-slate-800 dark:text-white"
                                    />
                                    <p className="text-[9.5px] text-slate-400 mt-1">
                                      *Enter precise scale reading in KG
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-slate-400 text-[10px] mb-1 font-bold uppercase">Allotted Bin Location</label>
                                    <input
                                      type="text"
                                      placeholder="E.g., Shelf-B3"
                                      value={issueLoc}
                                      onChange={e => setIssueLoc(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-400 text-[10px] mb-1 font-bold uppercase">Rack No</label>
                                    <input
                                      type="text"
                                      placeholder="E.g., Rack-4"
                                      value={issueRack}
                                      onChange={e => setIssueRack(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-[11px]"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-slate-400 text-[10px] mb-1 font-bold uppercase">Gate Pass / Release Remarks</label>
                                  <input
                                    type="text"
                                    placeholder="Released to Dispatch. Weight verified."
                                    value={issueRemarksState}
                                    onChange={e => setIssueRemarksState(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-[11px]"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setActiveIssueId(null)}
                                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded font-bold text-[10px]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!issueWeight) return;
                                      setAcceptedMovementIds(prev => ({ ...prev, [req.movementId]: 'animating' }));
                                      
                                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                        try { navigator.vibrate(55); } catch (_) {}
                                      }

                                      setTimeout(async () => {
                                        try {
                                          await onAcceptMovement(req.movementId, issueRemarksState || 'Released & Issued', {
                                            allottedLocation: issueLoc,
                                            rackNo: issueRack,
                                            quantity: issueWeight,
                                            issueStatus: 'Issued'
                                          });
                                          setActiveIssueId(null);
                                          setAcceptedMovementIds(prev => ({ ...prev, [req.movementId]: 'done' }));
                                        } catch (err) {
                                          console.error("Failed to accept issue:", err);
                                          setAcceptedMovementIds(prev => {
                                            const updated = { ...prev };
                                            delete updated[req.movementId];
                                            return updated;
                                          });
                                        }
                                      }, 1150);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px]"
                                  >
                                    Confirm Issue & Release
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Reject Issue Request Panel */}
                            {isRejectingReq && (
                              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-rose-50/20 dark:bg-rose-950/20 p-3 rounded-lg text-left">
                                <label className="block text-rose-500 font-bold uppercase tracking-wider text-[9px]">
                                  Reason for rejecting Dispatch Request
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Describe exact reasons (e.g. Stock mismatch, QC hold, physical verification failed)..."
                                  value={issueRejectionNotes}
                                  onChange={e => setIssueRejectionNotes(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-2 focus:outline-none focus:border-rose-500"
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => setActiveIssueRejectionId(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded text-[10px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!issueRejectionNotes) return;
                                      await onRejectMovement(req.movementId, issueRejectionNotes);
                                      setActiveIssueRejectionId(null);
                                    }}
                                    disabled={!issueRejectionNotes}
                                    className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded text-[10px] font-bold disabled:opacity-40"
                                  >
                                    Confirm Rejection
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
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
                      ((activeDept as any) === 'Purchase' && activePurchaseJob === job.jobCardNo) ||
                      (activeDept === 'Production' && activeProdJob === job.jobCardNo) ||
                      (activeDept === 'Heat Treatment' && activeHtJob === job.jobCardNo) ||
                      (activeDept === 'Plating' && activePlatingJob === job.jobCardNo) ||
                      (activeDept === 'Packing' && activePackingJob === job.jobCardNo) ||
                      (activeDept === 'Store' && activeStoreJob === job.jobCardNo);

                    const m = getJobCardProcessMetrics(job, movements);
                    const totalMovedFromProd = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.fromDepartment === 'Production')
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const pendingProdQty = job.orderQty - totalMovedFromProd;
                    const isRoutedDownstream = job.currentDepartment !== 'Production';

                    // 1. Heat Treatment variables
                    const totalReceivedAtHT = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.toDepartment === 'Heat Treatment' && m.accepted)
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const htInputDisplay = totalReceivedAtHT > 0 ? totalReceivedAtHT : (job.currentDepartment === 'Heat Treatment' ? m.qtyReceivedFromProd : 0);
                    const totalRoutedFromHT = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.fromDepartment === 'Heat Treatment')
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const pendingHTQty = Math.max(0, htInputDisplay - totalRoutedFromHT - (job.heatTreatmentDetails?.rejectionQty || 0));
                    const isHTRoutedDownstream = job.currentDepartment !== 'Heat Treatment';

                    // 2. Plating variables
                    const totalReceivedAtPlating = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.toDepartment === 'Plating' && m.accepted)
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const platingInputDisplay = totalReceivedAtPlating > 0 ? totalReceivedAtPlating : (job.currentDepartment === 'Plating' ? m.qtyReceivedAtPlating : 0);
                    const totalRoutedFromPlating = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.fromDepartment === 'Plating')
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const pendingPlatingQty = Math.max(0, platingInputDisplay - totalRoutedFromPlating - (job.platingDetails?.rejectionQty || 0));
                    const isPlatingRoutedDownstream = job.currentDepartment !== 'Plating';

                    // 3. Packing variables
                    const totalReceivedAtPacking = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.toDepartment === 'Packing' && m.accepted)
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const packingInputDisplay = totalReceivedAtPacking > 0 ? totalReceivedAtPacking : (job.currentDepartment === 'Packing' ? m.qtyReceivedAtPacking : 0);
                    const totalRoutedFromPacking = movements
                      .filter(m => m.jobCardNo.toLowerCase() === job.jobCardNo.toLowerCase() && m.fromDepartment === 'Packing')
                      .reduce((sum, m) => sum + m.quantity, 0);
                    const pendingPackingQty = Math.max(0, packingInputDisplay - totalRoutedFromPacking - (job.packingDetails?.rejectionQty || 0));
                    const isPackingRoutedDownstream = job.currentDepartment !== 'Packing';

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
                            {activeDept === 'Production' ? (
                              <div className="space-y-1 mt-1.5">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  {job.itemName}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/40">
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Order</span>
                                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{job.orderQty.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-450 uppercase font-bold">Produced & Routed</span>
                                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalMovedFromProd.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500 uppercase font-bold">Pending Production</span>
                                    <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{pendingProdQty.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Current Custody</span>
                                    <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">{job.currentDepartment} ({job.currentQty} KG)</span>
                                  </div>
                                </div>
                                {isRoutedDownstream && (
                                  <div className="mt-1.5 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 font-sans">
                                    <span>↪️ Currently processing downstream at {job.currentDepartment}. Remaining pending quantity can be processed & transferred below.</span>
                                  </div>
                                )}
                              </div>
                            ) : activeDept === 'Heat Treatment' ? (
                              <div className="space-y-1 mt-1.5">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  {job.itemName}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/40">
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Received</span>
                                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{htInputDisplay.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-450 uppercase font-bold">Hardened & Routed</span>
                                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalRoutedFromHT.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500 uppercase font-bold">Pending Hardening</span>
                                    <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{pendingHTQty.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Current Custody</span>
                                    <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">{job.currentDepartment} ({job.currentQty} KG)</span>
                                  </div>
                                </div>
                                {isHTRoutedDownstream && (
                                  <div className="mt-1.5 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 font-sans">
                                    <span>↪️ Currently processing downstream at {job.currentDepartment}. Remaining pending quantity can be processed & transferred below.</span>
                                  </div>
                                )}
                              </div>
                            ) : activeDept === 'Plating' ? (
                              <div className="space-y-1 mt-1.5">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  {job.itemName}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/40">
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Received</span>
                                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{platingInputDisplay.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-450 uppercase font-bold">Coated & Routed</span>
                                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalRoutedFromPlating.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500 uppercase font-bold">Pending Plating</span>
                                    <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{pendingPlatingQty.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Current Custody</span>
                                    <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">{job.currentDepartment} ({job.currentQty} KG)</span>
                                  </div>
                                </div>
                                {isPlatingRoutedDownstream && (
                                  <div className="mt-1.5 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 font-sans">
                                    <span>↪️ Currently processing downstream at {job.currentDepartment}. Remaining pending quantity can be processed & transferred below.</span>
                                  </div>
                                )}
                              </div>
                            ) : activeDept === 'Packing' ? (
                              <div className="space-y-1 mt-1.5">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  {job.itemName}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-2 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/40">
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Received</span>
                                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{packingInputDisplay.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-450 uppercase font-bold">Packed & Routed</span>
                                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalRoutedFromPacking.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500 uppercase font-bold">Pending Packing</span>
                                    <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{pendingPackingQty.toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-pink-500 uppercase font-bold">Pcs in Bag/Box</span>
                                    <span className="text-xs font-bold font-mono text-pink-650 dark:text-pink-400">{job.packingDetails?.pcsPerBagOrBox ? `${job.packingDetails.pcsPerBagOrBox} pcs` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-indigo-500 uppercase font-bold">Total Pieces (Pcs)</span>
                                    <span className="text-xs font-bold font-mono text-indigo-650 dark:text-indigo-400">{job.packingDetails?.totalPcs ? `${job.packingDetails.totalPcs.toLocaleString()} pcs` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Current Custody</span>
                                    <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">{job.currentDepartment} ({job.currentQty} KG)</span>
                                  </div>
                                </div>
                                {isPackingRoutedDownstream && (
                                  <div className="mt-1.5 text-[10.5px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 font-sans">
                                    <span>↪️ Currently processing downstream at {job.currentDepartment}. Remaining pending quantity can be processed & transferred below.</span>
                                  </div>
                                )}
                              </div>
                            ) : activeDept === 'Store' ? (
                              <div className="space-y-1 mt-1.5">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                  {job.itemName}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 bg-slate-100/70 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/40">
                                  <div>
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Received</span>
                                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{(getJobCardProcessMetrics(job, movements).qtyReceivedAtStore || job.storeDetails?.qtyReceivedFromPacking || 0).toLocaleString()} KG</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-450 uppercase font-bold">Box Count</span>
                                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{job.packingDetails?.boxCount || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-pink-500 uppercase font-bold">Pcs in Bag/Box</span>
                                    <span className="text-xs font-bold font-mono text-pink-650 dark:text-pink-400">{job.packingDetails?.pcsPerBagOrBox ? `${job.packingDetails.pcsPerBagOrBox} pcs` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-indigo-500 uppercase font-bold">Total Pieces (Pcs)</span>
                                    <span className="text-xs font-bold font-mono text-indigo-650 dark:text-indigo-400">{job.packingDetails?.totalPcs ? `${job.packingDetails.totalPcs.toLocaleString()} pcs` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-slate-450 uppercase font-bold font-sans">Bin Location</span>
                                    <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">{job.storeDetails?.locationBin || 'Pending placement'}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {job.itemName} • Order Qty: {job.orderQty} KG | <strong>Custody Weight: {job.currentQty} KG</strong> (Outstanding Balance: {job.balanceQty} KG)
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                            {job.status === 'Pending' || job.status === 'Rejected' ? (
                              <button
                                onClick={() => {
                                  if ((activeDept as any) === 'Purchase') {
                                    handleStartPurchase(job);
                                  } else {
                                    handleStartProduction(job);
                                  }
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11.5px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none cursor-pointer"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                {(activeDept as any) === 'Purchase' ? 'Start Purchase Inwarding' : 'Start Production Processing'}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  // Set appropriate form parameters before launching sub-form
                                  if ((activeDept as any) === 'Purchase') {
                                    setActivePurchaseJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      setPurchaseRecQty(job.orderQty);
                                      setPurchaseSentQty(job.orderQty);
                                    }
                                  } else if (activeDept === 'Production') {
                                    setActiveProdJob(isProcessing ? null : job.jobCardNo);
                                    setProdQty(pendingProdQty);
                                  } else if (activeDept === 'Heat Treatment') {
                                    setActiveHtJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      setHtQtyReceived(pendingHTQty);
                                      setHtQtySentToPlating(pendingHTQty);
                                    }
                                  } else if (activeDept === 'Plating') {
                                    setActivePlatingJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      setPlatingQtyReceived(pendingPlatingQty);
                                      setPlatingQtySentToPacking(pendingPlatingQty);
                                    }
                                  } else if (activeDept === 'Packing') {
                                    setActivePackingJob(isProcessing ? null : job.jobCardNo);
                                    if (!isProcessing) {
                                      setPackQtyReceived(pendingPackingQty);
                                      setPackQtySentToStore(pendingPackingQty);
                                      setPackQty(pendingPackingQty);
                                      setPackBoxCount(job.packingDetails?.boxCount || 5);
                                      setPackStyle(job.packingDetails?.packingType || 'Corrugated Boxes with wooden pallet support');
                                      setPackPcsPerBagOrBox(job.packingDetails?.pcsPerBagOrBox || 100);
                                      setPackTotalPcs(job.packingDetails?.totalPcs || (job.packingDetails?.boxCount || 5) * (job.packingDetails?.pcsPerBagOrBox || 100));
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
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-md transition flex items-center gap-1 leading-none cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Record Process Metrics
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Process Metrics Form (No popup page) */}
                        {isProcessing && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-4 font-sans bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl">
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              Record {activeDept} Operational Specs
                            </h4>

                            {activeDept === 'Production' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Milling Lead Operator Name</label>
                                    <input
                                      type="text"
                                      placeholder="E.g. Ramesh Patil"
                                      value={prodOpName}
                                      onChange={e => setProdOpName(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Produced Quantity In KG</label>
                                    <input
                                      type="number"
                                      value={prodQty || ''}
                                      onChange={e => setProdQty(Math.max(0, parseInt(e.target.value) || 0))}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                                <div className="p-3 bg-indigo-50/40 dark:bg-slate-950/20 rounded-lg text-[10.5px] text-slate-600 dark:text-slate-400 border border-indigo-100/35 leading-relaxed">
                                  <strong>Business Routing Rule:</strong> {job.heatTreatmentRequired 
                                    ? '⚠️ Heat Treatment is Required. Completing this step immediately transfers this job to the Furnace line queue.' 
                                    : '✔️ Heat Treatment Skipped. Completing this step transfers cargo directly to Electroplating.'}
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setActiveProdJob(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!prodOpName || prodQty <= 0}
                                    onClick={() => handleCompleteProduction(job)}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold py-2 px-4 rounded text-xs uppercase cursor-pointer"
                                  >
                                    Save Production & Route Direct
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeDept === 'Heat Treatment' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Hardness Achieved</label>
                                    <input
                                      type="text"
                                      value={htHardness}
                                      onChange={e => setHtHardness(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Temperature (°C)</label>
                                    <input
                                      type="text"
                                      value={htTemp}
                                      onChange={e => setHtTemp(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Cycle Duration</label>
                                    <input
                                      type="text"
                                      value={htDuration}
                                      onChange={e => setHtDuration(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-rose-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Furnace Rejection (KG)</label>
                                    <input
                                      type="number"
                                      value={htRejectionQty || ''}
                                      onChange={e => {
                                        const rej = Math.max(0, parseInt(e.target.value) || 0);
                                        if (rej > htQtyReceived) {
                                          setHtRejectionQty(htQtyReceived);
                                          setHtQtySentToPlating(0);
                                        } else {
                                          setHtRejectionQty(rej);
                                          setHtQtySentToPlating(Math.max(0, htQtyReceived - rej));
                                        }
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-rose-200 rounded p-1.5 font-mono font-bold text-rose-650 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg grid grid-cols-3 gap-3 text-[11px] font-mono border border-slate-200 dark:border-slate-800">
                                  <div>
                                    <span className="text-slate-450 block uppercase text-[8.5px]">Qty Received:</span>
                                    <strong className="text-blue-600">{htQtyReceived} KG</strong>
                                  </div>
                                  <div>
                                    <span className="text-indigo-600 block uppercase text-[8.5px]">Sent to Plating:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={htQtyReceived}
                                      value={htQtySentToPlating}
                                      onChange={e => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setHtQtySentToPlating(val > htQtyReceived ? htQtyReceived : val);
                                      }}
                                      className="w-16 bg-white dark:bg-slate-950 border border-slate-300 rounded px-1 py-0.2 text-center text-[10.5px] font-bold text-indigo-700"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-amber-600 block uppercase text-[8.5px]">Remaining Balance:</span>
                                    <strong>{Math.max(0, htQtyReceived - htQtySentToPlating - htRejectionQty)} KG</strong>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setActiveHtJob(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteHeatTreatment(job)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase cursor-pointer"
                                  >
                                    Save Furnace Logs & Route
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeDept === 'Plating' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Plating Bath Type</label>
                                    <input
                                      type="text"
                                      value={platingType}
                                      onChange={e => setPlatingType(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Micron Thickness</label>
                                    <input
                                      type="text"
                                      value={platingThick}
                                      onChange={e => setPlatingThick(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Bath Duration</label>
                                    <input
                                      type="text"
                                      value={platingDur}
                                      onChange={e => setPlatingDur(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-rose-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Coating Rejection (KG)</label>
                                    <input
                                      type="number"
                                      value={platingRejectionQty || ''}
                                      onChange={e => {
                                        const rej = Math.max(0, parseInt(e.target.value) || 0);
                                        if (rej > platingQtyReceived) {
                                          setPlatingRejectionQty(platingQtyReceived);
                                          setPlatingQtySentToPacking(0);
                                        } else {
                                          setPlatingRejectionQty(rej);
                                          setPlatingQtySentToPacking(Math.max(0, platingQtyReceived - rej));
                                        }
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-rose-200 rounded p-1.5 font-mono font-bold text-rose-650 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg grid grid-cols-3 gap-3 text-[11px] font-mono border border-slate-200 dark:border-slate-800">
                                  <div>
                                    <span className="text-slate-455 block uppercase text-[8.5px]">Qty Received:</span>
                                    <strong className="text-blue-600">{platingQtyReceived} KG</strong>
                                  </div>
                                  <div>
                                    <span className="text-indigo-600 block uppercase text-[8.5px]">Sent to Packing:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={platingQtyReceived}
                                      value={platingQtySentToPacking}
                                      onChange={e => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setPlatingQtySentToPacking(val > platingQtyReceived ? platingQtyReceived : val);
                                      }}
                                      className="w-16 bg-white dark:bg-slate-950 border border-slate-300 rounded px-1 py-0.2 text-center text-[10.5px] font-bold text-indigo-700"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-amber-600 block uppercase text-[8.5px]">Remaining Balance:</span>
                                    <strong>{Math.max(0, platingQtyReceived - platingQtySentToPacking - platingRejectionQty)} KG</strong>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setActivePlatingJob(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCompletePlating(job)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase cursor-pointer"
                                  >
                                    Complete Coating & Route
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeDept === 'Packing' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Total Boxes count</label>
                                    <input
                                      type="number"
                                      value={packBoxCount}
                                      onChange={e => {
                                        const count = Math.max(0, parseInt(e.target.value) || 0);
                                        setPackBoxCount(count);
                                        setPackTotalPcs(count * packPcsPerBagOrBox);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Pcs per Box</label>
                                    <input
                                      type="number"
                                      value={packPcsPerBagOrBox}
                                      onChange={e => {
                                        const pcs = Math.max(0, parseInt(e.target.value) || 0);
                                        setPackPcsPerBagOrBox(pcs);
                                        setPackTotalPcs(packBoxCount * pcs);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-indigo-600 font-bold uppercase text-[9.5px] tracking-wider mb-1">Total Pieces</label>
                                    <input
                                      type="number"
                                      value={packTotalPcs}
                                      onChange={e => setPackTotalPcs(Math.max(0, parseInt(e.target.value) || 0))}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono font-bold text-indigo-700 dark:text-indigo-400 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-rose-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Packing Rejection (KG)</label>
                                    <input
                                      type="number"
                                      value={packRejectionQty || ''}
                                      onChange={e => {
                                        const rej = Math.max(0, parseInt(e.target.value) || 0);
                                        if (rej > packQtyReceived) {
                                          setPackRejectionQty(packQtyReceived);
                                          setPackQtySentToStore(0);
                                          setPackQty(0);
                                        } else {
                                          setPackRejectionQty(rej);
                                          const val = Math.max(0, packQtyReceived - rej);
                                          setPackQtySentToStore(val);
                                          setPackQty(val);
                                        }
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-rose-200 rounded p-1.5 font-mono font-bold text-rose-650 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Boxing Style</label>
                                    <input
                                      type="text"
                                      value={packStyle}
                                      onChange={e => setPackStyle(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                                    />
                                  </div>
                                  <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg grid grid-cols-3 gap-3 text-[11px] font-mono border border-slate-200 dark:border-slate-800">
                                    <div>
                                      <span className="text-slate-455 block uppercase text-[8.5px]">Qty Received:</span>
                                      <strong className="text-blue-600">{packQtyReceived} KG</strong>
                                    </div>
                                    <div>
                                      <span className="text-indigo-600 block uppercase text-[8.5px]">Sent to Store:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max={packQtyReceived}
                                        value={packQtySentToStore}
                                        onChange={e => {
                                          const val = Math.max(0, parseInt(e.target.value) || 0);
                                          setPackQtySentToStore(val > packQtyReceived ? packQtyReceived : val);
                                          setPackQty(val > packQtyReceived ? packQtyReceived : val);
                                        }}
                                        className="w-16 bg-white dark:bg-slate-950 border border-slate-300 rounded px-1 py-0.2 text-center text-[10.5px] font-bold text-indigo-700"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-amber-600 block uppercase text-[8.5px]">Remaining Balance:</span>
                                      <strong>{Math.max(0, packQtyReceived - packQtySentToStore - packRejectionQty)} KG</strong>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setActivePackingJob(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCompletePacking(job)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase cursor-pointer"
                                  >
                                    Box completed cargos & Route
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeDept === 'Store' && (
                              <div className="space-y-4">
                                {job.packingDetails && (
                                  <div className="bg-pink-50/20 dark:bg-pink-950/5 p-2.5 rounded border border-pink-100/50 grid grid-cols-3 gap-2 font-mono text-[10.5px]">
                                    <div><span className="text-pink-500 block text-[9px] uppercase">Boxes:</span> <strong>{job.packingDetails.boxCount || 0} boxes</strong></div>
                                    <div><span className="text-pink-500 block text-[9px] uppercase">Pcs per Box:</span> <strong>{job.packingDetails.pcsPerBagOrBox || 0} pcs</strong></div>
                                    <div><span className="text-pink-500 block text-[9px] uppercase">Total Pieces:</span> <strong>{(job.packingDetails.totalPcs || 0).toLocaleString()} pcs</strong></div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-slate-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Warehouse Bin Coordinate</label>
                                    <input
                                      type="text"
                                      value={storeBinLoc}
                                      onChange={e => setStoreBinLoc(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 rounded p-1.5 font-mono text-slate-800 dark:text-slate-100 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-rose-500 font-bold uppercase text-[9.5px] tracking-wider mb-1">Store Rejection (KG)</label>
                                    <input
                                      type="number"
                                      value={storeRejectionQty || ''}
                                      onChange={e => {
                                        const rej = Math.max(0, parseInt(e.target.value) || 0);
                                        if (rej > storeQtyReceived) {
                                          setStoreRejectionQty(storeQtyReceived);
                                          setStoreQtySentToDispatch(0);
                                          setStoreVerifiedQty(0);
                                        } else {
                                          setStoreRejectionQty(rej);
                                          const val = Math.max(0, storeQtyReceived - rej);
                                          setStoreQtySentToDispatch(val);
                                          setStoreVerifiedQty(val);
                                        }
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-rose-200 rounded p-1.5 font-mono font-bold text-rose-650 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                {job.processType === 'Purchase' && (
                                  <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg space-y-2 border border-slate-200">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[9px] tracking-wider">Routing Option (Next Destination)</label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setStoreTargetDept('Packing')}
                                        className={`flex-1 py-1.5 rounded font-bold border transition text-xs cursor-pointer ${
                                          storeTargetDept === 'Packing' 
                                            ? 'bg-indigo-600 text-white border-indigo-700' 
                                            : 'bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200'
                                        }`}
                                      >
                                        📦 Send to Packing Line
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setStoreTargetDept('Dispatch')}
                                        className={`flex-1 py-1.5 rounded font-bold border transition text-xs cursor-pointer ${
                                          storeTargetDept === 'Dispatch' 
                                            ? 'bg-indigo-600 text-white border-indigo-700' 
                                            : 'bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200'
                                        }`}
                                      >
                                        🚚 Send to Direct Dispatch
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg grid grid-cols-3 gap-3 text-[11px] font-mono border border-slate-200 dark:border-slate-800">
                                  <div>
                                    <span className="text-slate-455 block uppercase text-[8.5px]">Qty Received:</span>
                                    <strong className="text-blue-600">{storeQtyReceived} KG</strong>
                                  </div>
                                  <div>
                                    <span className="text-indigo-600 block uppercase text-[8.5px]">Route to {job.processType === 'Purchase' ? storeTargetDept : 'Dispatch'}:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={storeQtyReceived}
                                      value={storeQtySentToDispatch}
                                      onChange={e => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setStoreQtySentToDispatch(val > storeQtyReceived ? storeQtyReceived : val);
                                        setStoreVerifiedQty(val > storeQtyReceived ? storeQtyReceived : val);
                                      }}
                                      className="w-16 bg-white dark:bg-slate-950 border border-slate-300 rounded px-1 py-0.2 text-center text-[10.5px] font-bold text-indigo-700"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-amber-600 block uppercase text-[8.5px]">Remaining Balance:</span>
                                    <strong>{Math.max(0, storeQtyReceived - storeQtySentToDispatch - storeRejectionQty)} KG</strong>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setActiveStoreJob(null)}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-xs font-bold cursor-pointer hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteStore(job)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-xs uppercase cursor-pointer"
                                  >
                                    Verify Stock & Send to {job.processType === 'Purchase' ? storeTargetDept : 'Dispatch'}
                                  </button>
                                </div>
                              </div>
                            )}
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
                        <th className="py-2.5 px-3">Acceptance Status</th>
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
                          <td className="py-3 px-3">
                            {m.accepted ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-105 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">
                                Accepted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-105 border border-purple-200 text-purple-850 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/40 animate-pulse">
                                Pending downstream
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                            {m.accepted ? (m.acceptedBy || 'System auto-close') : <span className="text-slate-400 italic font-normal text-[10px]">Awaiting Sign-off</span>}
                          </td>
                          <td className="py-3 px-3 text-slate-450 font-mono">
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
