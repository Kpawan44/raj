import React, { useState } from 'react';
import { 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Layers, 
  Calendar, 
  Search,
  Filter,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { JobCard, MaterialMovement, Department } from '../types';
import { getJobCardProcessMetrics } from '../lib/metrics';

interface ReportViewProps {
  jobCards: JobCard[];
  movements: MaterialMovement[];
}

type ReportType = 
  | 'production'
  | 'heattreat'
  | 'plating'
  | 'packing'
  | 'store'
  | 'dispatch'
  | 'pending'
  | 'completed'
  | 'rejected'
  | 'movements'
  | 'balance';

export default function ReportView({ jobCards, movements }: ReportViewProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('production');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Define reports descriptors
  const reportOptions: { id: ReportType; label: string; desc: string }[] = [
    { id: 'production', label: 'Production Milling Report', desc: "Machining outputs and operator signoffs" },
    { id: 'heattreat', label: 'Heat Treatment Report', desc: "Hardness levels and temperature recipes" },
    { id: 'plating', label: 'Surfacing & Plating Report', desc: "Thickness measurements and coating quality" },
    { id: 'packing', label: 'Packaging Weights Report', desc: "Box specifications and total count packed" },
    { id: 'store', label: 'Store / Warehousing Report', desc: "Verified inventory placement and bin location storage" },
    { id: 'dispatch', label: 'Dispatch Shipment Report', desc: "Invoiced amounts and vehicle tracking records" },
    { id: 'pending', label: 'Active Outstanding Queue', desc: "Incomplete orders currently on work floors" },
    { id: 'completed', label: 'Archived Completed Orders', desc: "Perfect run items fully shipped out" },
    { id: 'rejected', label: 'Rejected Orders Report', desc: "Orders flagged with rejection status" },
    { id: 'movements', label: 'Material Movement Log', desc: "Step-by-step chain of custody transfer ledger" },
    { id: 'balance', label: 'Balance Quantity Audit', desc: "Formula calculations: Target vs Processed (Scrap analysis)" }
  ];

  // Filters calculation
  const getFilteredData = () => {
    console.log("ReportView: total jobCards loaded =", jobCards.length);
    if (jobCards.length > 0) {
        console.log("First job card:", jobCards[0]);
        const found = jobCards.find(jc => jc.jobCardNo === 'jc-1001');
        console.log("jc-1001 found in jobCards?", !!found);
    }
    let baseData: any[] = [];

    // 1. Filter dataset according to the reports type
    switch (activeReport) {
      case 'production':
        baseData = jobCards.map(c => {
          const m = getJobCardProcessMetrics(c, movements);
          return {
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            itemName: c.itemName,
            targetQtyKg: c.orderQty,
            receivedFromProdKg: m.qtyReceivedFromProd,
            routedToPlatingKg: m.qtyRoutedToPlating,
            remainingAtProdKg: m.qtyRemainingAtProd,
            date: c.createdAt
          };
        });
        break;
      case 'heattreat':
        baseData = jobCards
          .filter(c => c.heatTreatmentRequired)
          .map(c => {
            const m = getJobCardProcessMetrics(c, movements);
            return {
              jobCardNo: c.jobCardNo,
              partyName: c.partyName,
              itemName: c.itemName,
              hardness: c.heatTreatmentDetails?.hardnessRequired || 'Awaiting Action',
              temperature: c.heatTreatmentDetails?.temperature || 'N/A',
              cycleTime: c.heatTreatmentDetails?.cycleTime || 'N/A',
              rejectionsKg: m.htRejections,
              date: c.createdAt
            };
          });
        break;
      case 'plating':
        baseData = jobCards.map(c => {
          const m = getJobCardProcessMetrics(c, movements);
          return {
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            itemName: c.itemName,
            platingType: c.platingDetails?.platingType || 'Pending',
            thickness: c.platingDetails?.micronThickness ? `${c.platingDetails.micronThickness}μm` : 'Pending',
            receivedAtPlatingKg: m.qtyReceivedAtPlating,
            routedToPackingKg: m.qtyRoutedToPacking,
            remainingAtPlatingKg: m.qtyRemainingAtPlating,
            rejectionsKg: m.platingRejections,
            date: c.createdAt
          };
        });
        break;
      case 'packing':
        baseData = jobCards.map(c => {
          const m = getJobCardProcessMetrics(c, movements);
          return {
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            itemName: c.itemName,
            boxCount: c.packingDetails?.boxCount || 0,
            packType: c.packingDetails?.packingType || 'Pending',
            receivedAtPackingKg: m.qtyReceivedAtPacking,
            routedToStoreKg: m.qtyRoutedToStore,
            remainingAtPackingKg: m.qtyRemainingAtPacking,
            rejectionsKg: m.packingRejections,
            date: c.createdAt
          };
        });
        break;
      case 'store':
        baseData = jobCards.map(c => {
          const m = getJobCardProcessMetrics(c, movements);
          return {
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            itemName: c.itemName,
            storeLocation: c.storeDetails?.locationBin || 'Pending placement',
            receivedAtStoreKg: m.qtyReceivedAtStore,
            qtyDispatchedKg: m.qtyDispatched,
            qtyInStockKg: m.qtyRemainingInStock,
            date: c.createdAt
          };
        });
        break;
      case 'dispatch':
        baseData = jobCards
          .filter(c => c.completed || c.dispatchDetails)
          .map(c => ({
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            item: c.itemName,
            orderPlacedBy: c.createdBy || 'Unknown',
            invoiceNo: c.dispatchDetails?.invoiceNo || 'INV-Pending',
            vehicleNo: c.dispatchDetails?.vehicleNo || 'Self Pick',
            dispatchQty: c.dispatchDetails?.dispatchQty || c.currentQty,
            dispatchDate: c.dispatchDetails?.dispatchDate || c.createdAt
          }));
        break;
      case 'pending':
        baseData = jobCards
          .filter(c => !c.completed)
          .map(c => ({
            jobCardNo: c.jobCardNo,
            orderNo: c.orderNo,
            partyName: c.partyName,
            itemName: c.itemName,
            orderPlacedBy: c.createdBy || 'Unknown',
            currentDepartment: c.currentDepartment,
            status: c.status,
            orderQty: c.orderQty,
            currentQty: c.currentQty,
            createdAt: c.createdAt
          }));
        break;
      case 'completed':
        baseData = jobCards
          .filter(c => c.completed)
          .map(c => ({
            jobCardNo: c.jobCardNo,
            orderNo: c.orderNo,
            partyName: c.partyName,
            itemName: c.itemName,
            orderPlacedBy: c.createdBy || 'Unknown',
            finalDepartment: c.currentDepartment,
            status: c.status,
            orderQty: c.orderQty,
            finalQty: c.currentQty,
            createdAt: c.createdAt
          }));
        break;
      case 'rejected':
        baseData = jobCards
          .filter(c => c.status === 'Rejected')
          .map(c => ({
            jobCardNo: c.jobCardNo,
            orderNo: c.orderNo,
            partyName: c.partyName,
            itemName: c.itemName,
            currentDepartment: c.currentDepartment,
            status: c.status,
            createdAt: c.createdAt
          }));
        break;
      case 'movements':
        baseData = movements.map(m => {
          const matchedCard = jobCards.find(jc => jc.jobCardNo === m.jobCardNo);
          return {
            movementId: m.movementId,
            jobCardNo: m.jobCardNo,
            orderPlacedBy: matchedCard?.createdBy || 'System',
            fromDepartment: m.fromDepartment,
            toDepartment: m.toDepartment,
            quantity: m.quantity,
            transferBy: m.transferBy,
            transferDate: m.transferDate,
            status: m.accepted ? 'Accepted' : 'Pending'
          };
        });
        break;
      case 'balance':
        // Calculate balance weight audit
        baseData = jobCards.map(c => {
          const processedWeight = c.completed ? c.currentQty : 0;
          return {
            jobCardNo: c.jobCardNo,
            partyName: c.partyName,
            itemCode: c.itemCode,
            orderPlacedBy: c.createdBy || 'Unknown',
            orderWeight: c.orderQty,
            processedWeight: processedWeight,
            scrapWeight: Math.max(0, c.orderQty - c.currentQty),
            balanceWeight: c.balanceQty,
            currentDept: c.currentDepartment,
            status: c.status
          };
        });
        break;
    }

    // 2. Filter by search filter
    if (searchTerm) {
      const match = searchTerm.toLowerCase();
      baseData = baseData.filter(d => {
        return (
          (d.jobCardNo && d.jobCardNo.toLowerCase().includes(match)) ||
          (d.partyName && d.partyName.toLowerCase().includes(match)) ||
          (d.itemName && d.itemName.toLowerCase().includes(match)) ||
          (d.operator && d.operator.toLowerCase().includes(match)) ||
          (d.itemCode && d.itemCode.toLowerCase().includes(match))
        );
      });
    }

    // 3. Filter by date bounding limits
    if (startDate) {
      const start = new Date(startDate);
      baseData = baseData.filter(d => {
        const itemDate = d.date || d.transferDate || d.createdAt || d.dispatchDate;
        if (!itemDate) return true;
        return new Date(itemDate) >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseData = baseData.filter(d => {
        const itemDate = d.date || d.transferDate || d.createdAt || d.dispatchDate;
        if (!itemDate) return true;
        return new Date(itemDate) <= end;
      });
    }

    return baseData;
  };

  const filteredData = getFilteredData();

  // Export to Excel simulation using clean download CSV encoder
  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    
    // Get headers automatically from dynamic object keys
    const headers = Object.keys(filteredData[0]);
    const csvRows = [];
    
    // Header Row
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    
    // Data Rows
    for (const row of filteredData) {
      const values = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `REPORT_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Period filters bar */}
      <div className="bg-white dark:bg-slate-900 shadow-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Label selector */}
          <div className="relative">
            <select
              value={activeReport}
              onChange={(e) => {
                setActiveReport(e.target.value as ReportType);
                setSearchTerm('');
              }}
              className="bg-slate-50 dark:bg-slate-800 border-r-8 border-transparent text-xs text-slate-700 dark:text-slate-100 font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-750 focus:outline-none focus:border-[#3B82F6] cursor-pointer"
            >
              {reportOptions.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:flex-initial min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Code, Name, Job..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-slate-850 pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-750 w-full focus:outline-none focus:border-[#3B82F6] font-sans"
            />
          </div>
        </div>

        {/* Date picking section */}
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto text-xs text-slate-500">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 focus:outline-none focus:border-[#3B82F6] font-mono text-slate-700 dark:text-slate-200"
          />
          <span className="font-mono">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 focus:outline-none focus:border-[#3B82F6] font-mono text-slate-700 dark:text-slate-200"
          />

          <div className="flex items-center gap-1.5 ml-auto md:ml-4">
            <button
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 font-bold px-3 py-2 rounded-lg transition-all"
              title="Download Microsoft Excel (CSV)"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Excel Export</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={filteredData.length === 0}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 font-bold px-3 py-2 rounded-lg transition-all"
            >
              <Printer className="h-4 w-4" />
              <span>PDF Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Report Title Description */}
      <div className="px-1.5">
        <h4 className="font-sans font-bold text-base text-slate-800 dark:text-slate-100">
          {reportOptions.find(r => r.id === activeReport)?.label}
        </h4>
        <p className="text-xs text-slate-400 italic">
          {reportOptions.find(r => r.id === activeReport)?.desc}
        </p>
      </div>

      {/* Grid records counts */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {filteredData.length === 0 ? (
            <div className="text-center p-8 space-y-2">
              <span className="text-2xl">🔍</span>
              <p className="text-sm font-semibold text-slate-500">No records found matching audit criteria</p>
              <p className="text-xs text-slate-400">Try loosening your search keywords or date range bounds</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  {Object.keys(filteredData[0]).map((h) => (
                    <th key={h} className="py-3.5 px-4 font-mono font-bold">
                      {h.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b last:border-b-0 border-slate-200 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 text-xs transition-colors"
                  >
                    {Object.values(row).map((val: any, valIdx) => {
                      // Custom formatter
                      let displayVal = String(val);
                      if (typeof val === 'boolean') {
                        displayVal = val ? 'True' : 'False';
                      }

                      // Is it date values? Formatter
                      if (typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val))) {
                        displayVal = new Date(val).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});
                      }

                      return (
                        <td key={valIdx} className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Dynamic footer tally counts */}
        {filteredData.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex justify-between font-mono">
            <span>Total Records Listed: {filteredData.length}</span>
            <span>Ref: Site-1 Operations</span>
          </div>
        )}
      </div>

    </div>
  );
}
