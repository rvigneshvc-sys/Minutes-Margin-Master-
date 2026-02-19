import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { DuplicateRequest, User, CommercialType, CommercialRecord } from '../types';
import { Check, X, Search, BarChart3, TrendingUp, AlertCircle, FileDown, Calendar, Trash2, Database, Clock, ChevronDown, User as UserIcon, Layers, Upload, FileText, RefreshCw, Loader2, CheckSquare } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import Papa from 'papaparse';

interface CheckerProps {
  user: User;
}

export const CheckerWorkspace: React.FC<CheckerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'APPROVALS' | 'CLOSURE'>('AUDIT');
  const [requests, setRequests] = useState<DuplicateRequest[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  
  // Selection State for Approvals
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [approvalSearchTerm, setApprovalSearchTerm] = useState('');
  
  // Audit State (Single)
  const [auditMode, setAuditMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [auditQuery, setAuditQuery] = useState({ fsn: '', city: 'BLR', targetMargin: 0, unit: 'PERCENT' });
  const [auditResult, setAuditResult] = useState<any>(null);
  
  // Audit State (Bulk)
  const [bulkAuditData, setBulkAuditData] = useState<any[]>([]);
  const [bulkAuditCity, setBulkAuditCity] = useState('BLR');
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);
  const [bulkFile, setBulkFile] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  
  // Progress State
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  // Autocomplete State
  const [allFsns, setAllFsns] = useState<string[]>([]);
  const [filteredFsns, setFilteredFsns] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Closure/Export State
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [exportLoading, setExportLoading] = useState(false);
  
  // Safety Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');

  useEffect(() => {
    loadRequests();
    loadCities();
    loadUniqueFsns();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync selection with requests list (cleanup ghosts)
  useEffect(() => {
      const currentIds = new Set(requests.map(r => r.id));
      setSelectedRequestIds(prev => {
          const next = new Set<string>();
          let changed = false;
          prev.forEach(id => {
              if (currentIds.has(id)) next.add(id);
              else changed = true;
          });
          return changed ? next : prev;
      });
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!approvalSearchTerm.trim()) return requests;
    const lowerTerm = approvalSearchTerm.toLowerCase();
    return requests.filter(req => 
      req.payload.fsn.toLowerCase().includes(lowerTerm) ||
      req.payload.title.toLowerCase().includes(lowerTerm) ||
      req.requestedBy.toLowerCase().includes(lowerTerm) ||
      (req.payload.kam && req.payload.kam.toLowerCase().includes(lowerTerm))
    );
  }, [requests, approvalSearchTerm]);

  const loadCities = async () => {
    const c = await db.getCities();
    setCities(c);
    if (!c.includes(auditQuery.city)) {
       setAuditQuery(prev => ({ ...prev, city: c.includes('BLR') ? 'BLR' : c[0] || '' }));
    }
  };

  const loadUniqueFsns = async () => {
    const records = await db.getRecords();
    const unique = Array.from(new Set(records.map(r => r.fsn)));
    setAllFsns(unique);
  };

  const loadRequests = async () => {
    const reqs = await db.getDuplicateRequests();
    setRequests(reqs.filter(r => r.status === 'PENDING'));
  };

  const handleFsnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAuditQuery({ ...auditQuery, fsn: val });
    
    if (val.length > 0) {
        const matches = allFsns.filter(f => f.toLowerCase().includes(val.toLowerCase()));
        setFilteredFsns(matches.slice(0, 5)); // Limit to 5 suggestions
        setShowSuggestions(true);
    } else {
        setShowSuggestions(false);
    }
  };

  const selectSuggestion = (fsn: string) => {
      setAuditQuery({ ...auditQuery, fsn });
      setShowSuggestions(false);
  };

  // SINGLE AUDIT Logic
  const handleAudit = async () => {
    if (!auditQuery.fsn) return;
    
    if (auditQuery.fsn.length !== 16) {
        alert("FSN must be exactly 16 characters.");
        return;
    }

    setLoading(true);
    setProcessingStatus('Analyzing FSN...');
    setProgress(50);
    setShowSuggestions(false); 
    
    const records = await db.getRecords();
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Filter relevant records (Active & City Match/PAN)
    const activeRecords = records.filter(r => 
      r.fsn === auditQuery.fsn && 
      (r.city === auditQuery.city || r.city === 'PAN-INDIA') &&
      r.startDate <= today && r.endDate >= today
    );

    let baseVal = 0;
    let baseType = '-';
    let onInvVal = 0;
    let onInvSource = '-';
    let systemTotal = 0;

    const getRec = (type: CommercialType) => 
        activeRecords.find(r => r.type === type && r.city === auditQuery.city) ||
        activeRecords.find(r => r.type === type && r.city === 'PAN-INDIA');

    if (auditQuery.unit === 'PERCENT') {
        // Logic: Margin % > NLC %
        const marginRec = getRec(CommercialType.MARGIN_PERCENT);
        if (marginRec) {
            baseVal = marginRec.value;
            baseType = 'Margin %';
        } else {
            const nlcRec = getRec(CommercialType.NLC_PERCENT);
            if (nlcRec) {
                baseVal = nlcRec.value;
                baseType = 'NLC %';
            }
        }

        // On Invoice Logic
        const onRec = getRec(CommercialType.ON_INVOICE);
        if (onRec) {
            onInvVal = onRec.value;
            onInvSource = onRec.city === 'PAN-INDIA' ? 'PAN' : 'City';
        }

        systemTotal = baseVal + onInvVal;
    } else {
        // Logic: NLC Value (Amount)
        const nlcValRec = getRec(CommercialType.NLC_VALUE);
        if (nlcValRec) {
            baseVal = nlcValRec.value;
            baseType = 'NLC Value';
        }

        // On Invoice (For display only, not added to total)
        const onRec = getRec(CommercialType.ON_INVOICE);
        if (onRec) {
            onInvVal = onRec.value;
            onInvSource = onRec.city === 'PAN-INDIA' ? 'PAN' : 'City';
        }

        systemTotal = baseVal;
    }

    const variance = auditQuery.targetMargin - systemTotal;
    const variancePercent = auditQuery.targetMargin ? ((variance / auditQuery.targetMargin) * 100) : 0;

    setAuditResult({
      data: [
        { name: 'System', base: baseVal, onInv: auditQuery.unit === 'PERCENT' ? onInvVal : 0, total: systemTotal },
        { name: 'Target', target: auditQuery.targetMargin }
      ],
      systemTotal,
      targetTotal: auditQuery.targetMargin,
      variance,
      variancePercent: variancePercent.toFixed(2),
      status: Math.abs(variance) < 0.01 ? 'MATCH' : 'MISMATCH',
      details: activeRecords,
      baseType,
      onInvVal,
      onInvSource
    });
    setLoading(false);
    setProgress(100);
    setTimeout(() => { setProgress(0); }, 500);
  };

  // BULK AUDIT Handlers
  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setBulkFile(file.name);
      
      setLoading(true);
      setProcessingStatus('Parsing CSV...');
      setProgress(0);
      setEta('Starting...');

      // Wrap in setTimeout to ensure UI updates before heavy parsing
      setTimeout(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setBulkAuditData(results.data as any[]);
                setBulkResults(null);
                setLoading(false);
                setProgress(100);
                setTimeout(() => setProgress(0), 500);
            }
        });
      }, 100);
  };

  const downloadAuditTemplate = () => {
    const headers = ['FSN', 'Margin Value', 'Margin Rule', 'Margin Value Unit'];
    const dummyRow = ['MOBEXAMPLE123456', '20.5', 'MRP_GROSS_OF_TAXES', 'PERCENT'];
    const csvContent = [headers.join(','), dummyRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const runBulkAudit = async () => {
      if (bulkAuditData.length === 0) return;
      setLoading(true);
      setProcessingStatus('Building Search Index...');
      setProgress(0);
      setEta('Calculating...');

      const records = await db.getRecords();
      const today = new Date().toISOString().split('T')[0];
      
      // OPTIMIZATION: Build Index for O(1) lookup
      const fsnIndex = new Map<string, CommercialRecord[]>();
      records.forEach(r => {
          if(!fsnIndex.has(r.fsn)) fsnIndex.set(r.fsn, []);
          fsnIndex.get(r.fsn)!.push(r);
      });
      
      const BATCH_SIZE = 200;
      const totalItems = bulkAuditData.length;
      const startTime = Date.now();
      const resultsAccumulator: any[] = [];

      setProcessingStatus('Starting Bulk Audit...');

      const processBatch = async () => {
          for (let i = 0; i < totalItems; i++) {
               // Update Progress
               if (i % BATCH_SIZE === 0 && i > 0) {
                   const percent = Math.round((i / totalItems) * 100);
                   const elapsed = (Date.now() - startTime) / 1000;
                   const rate = i / elapsed;
                   const remainingSeconds = (totalItems - i) / rate;
                   
                   setProgress(percent);
                   setEta(remainingSeconds < 60 ? `${Math.ceil(remainingSeconds)}s` : `${Math.ceil(remainingSeconds/60)}m`);
                   setProcessingStatus(`Auditing row ${i}/${totalItems}`);
                   
                   await new Promise(resolve => setTimeout(resolve, 0));
               }

               const row = bulkAuditData[i] as Record<string, any>;
               if (!row) continue;

               // Fix: Ensure FSN is treated as a string
               const fsnRaw = row['FSN'] as any;
               const fsn = fsnRaw ? String(fsnRaw) : '';
               
               // Fix: Ensure value is string before passing to parseFloat to avoid 'unknown' type error
               const marginValRaw = row['Margin Value'] as any;
               const marginValStr = (marginValRaw !== undefined && marginValRaw !== null) ? String(marginValRaw) : '0';
               const targetVal = parseFloat(marginValStr);

               const unitRaw = row['Margin Value Unit'] as any;
               const unit = (unitRaw ? String(unitRaw) : '').toUpperCase();
               
               if (!fsn) continue;

               // OPTIMIZATION: Use Map Index instead of array.filter
               const candidates = fsnIndex.get(fsn as string) || [];
               const activeRecords = candidates.filter(r => 
                   (r.city === bulkAuditCity || r.city === 'PAN-INDIA') &&
                   r.startDate <= today && r.endDate >= today
               );

               let baseVal = 0;
               let baseType = '-';
               let onInvVal = 0;
               let onInvSource = '-';
               
               const getRec = (type: CommercialType) => 
                     activeRecords.find(r => r.type === type && r.city === bulkAuditCity) ||
                     activeRecords.find(r => r.type === type && r.city === 'PAN-INDIA');

               if (unit.includes('PERCENT')) {
                  const marginRec = getRec(CommercialType.MARGIN_PERCENT);
                  if (marginRec) {
                      baseVal = marginRec.value;
                      baseType = 'Margin %';
                  } else {
                      const nlcRec = getRec(CommercialType.NLC_PERCENT);
                      if (nlcRec) {
                          baseVal = nlcRec.value;
                          baseType = 'NLC %';
                      }
                  }
               } else {
                  const nlcValRec = getRec(CommercialType.NLC_VALUE);
                  if (nlcValRec) {
                      baseVal = nlcValRec.value;
                      baseType = 'NLC Value';
                  }
               }

               const onRec = getRec(CommercialType.ON_INVOICE);
               if (onRec) {
                   onInvVal = onRec.value;
                   onInvSource = onRec.city === 'PAN-INDIA' ? 'PAN' : 'City';
               }

               let systemTotal = 0;
               let variance = 0;

               if (unit.includes('PERCENT')) {
                   systemTotal = baseVal + onInvVal;
                   variance = targetVal - systemTotal;
               } else {
                   systemTotal = baseVal;
                   variance = targetVal - systemTotal;
               }
               
               const status = Math.abs(variance) < 0.01 ? 'MATCH' : 'MISMATCH';
               const title = activeRecords[0]?.title || 'Unknown Title';

               resultsAccumulator.push({
                   fsn,
                   title,
                   targetVal,
                   unit,
                   baseVal,
                   baseType,
                   onInvVal,
                   onInvSource,
                   systemTotal,
                   variance,
                   status
               });
          }
      };

      await processBatch();

      setBulkResults(resultsAccumulator);
      setProgress(100);
      setLoading(false);
      setTimeout(() => {
          setProgress(0);
          setEta(null);
      }, 500);
  };

  const handleRequestAction = async (reqId: string, action: 'APPROVED' | 'REJECTED') => {
    await db.resolveDuplicateRequest(reqId, action, user.id);
    loadRequests();
    loadUniqueFsns();
  };

  // Selection Handlers
  const toggleSelectRequest = (id: string) => {
      setSelectedRequestIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const toggleSelectAllRequests = () => {
      const allSelected = filteredRequests.length > 0 && filteredRequests.every(r => selectedRequestIds.has(r.id));
      
      setSelectedRequestIds(prev => {
          const next = new Set(prev);
          if (allSelected) {
              filteredRequests.forEach(r => next.delete(r.id));
          } else {
              filteredRequests.forEach(r => next.add(r.id));
          }
          return next;
      });
  };

  const handleBulkAction = async (action: 'APPROVED' | 'REJECTED') => {
      if (selectedRequestIds.size === 0) return;
      
      setLoading(true);
      setProcessingStatus(action === 'APPROVED' ? 'Processing approvals...' : 'Rejecting requests...');
      setProgress(50); // Indeterminate busy state
      
      const ids = Array.from(selectedRequestIds);
      
      // Use optimized batch processing method
      await db.resolveDuplicateRequestsBatch(ids, action, user.id);
      
      await loadRequests();
      await loadUniqueFsns();
      setSelectedRequestIds(new Set());
      setLoading(false);
      setProgress(0);
      setProcessingStatus('');
  };

  const handleExport = async (mode: 'MONTH' | 'FULL') => {
    setExportLoading(true);
    setProcessingStatus('Generating Export...');
    setLoading(true);
    setProgress(30);

    try {
        const records = await db.getRecords();
        let dataToExport = records;

        if (mode === 'MONTH') {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
            dataToExport = records.filter(r => r.startDate <= endOfMonth && r.endDate >= startOfMonth);
        }

        setProgress(70);

        const csv = Papa.unparse(dataToExport.map(r => ({
            ID: r.id,
            FSN: r.fsn,
            Brand: r.brand,
            Title: r.title,
            Vertical: r.vertical,
            KAM: r.kam,
            City: r.city,
            Type: r.type,
            Value: r.value,
            StartDate: r.startDate,
            EndDate: r.endDate,
            LastUpdatedBy: r.lastUpdatedBy,
            LastUpdatedAt: new Date(r.lastUpdatedAt).toISOString()
        })));

        setProgress(100);

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mm_export_${mode.toLowerCase()}_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert('Export failed');
    } finally {
        setExportLoading(false);
        setLoading(false);
        setProgress(0);
    }
  };

  const initiateClearDB = () => {
      setClearConfirmationText('');
      setShowClearModal(true);
  };

  const confirmClearDB = async () => {
    setShowClearModal(false);
    setLoading(true);
    setProcessingStatus('Permanently deleting all active records...');
    setProgress(10);
    
    try {
        // Simulate progress for heavy DB op
        const interval = setInterval(() => {
            setProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        await db.clearAllRecords(user.name);
        
        clearInterval(interval);
        setProgress(100);
        
        alert("Database reset. Records permanently deleted.");
        setAuditResult(null);
        setRequests([]);
        setAllFsns([]);
        setBulkResults(null);
    } catch (e) {
        alert("Failed.");
    } finally {
        setLoading(false);
        setProgress(0);
        setClearConfirmationText('');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded shadow-lg text-xs">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
               <span className="text-gray-500">{entry.name}:</span>
               <span className="text-gray-900 font-mono font-bold">{Number(entry.value).toFixed(2)}</span>
            </div>
          ))}
          {label === 'System' && (
             <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between gap-4">
                <span className="text-gray-600 font-bold">Total:</span>
                <span className="text-gray-900 font-mono font-bold">{payload.reduce((acc: number, cur: any) => acc + (cur.value || 0), 0).toFixed(2)}</span>
             </div>
          )}
          {label === 'System' && auditResult && (
              <div className="mt-1 pt-1 border-t border-gray-50 text-[10px] text-gray-500 space-y-0.5">
                   <div className="flex justify-between"><span>Base ({auditResult.baseType}):</span> <span>{auditResult.data[0].base}</span></div>
                   {auditQuery.unit === 'PERCENT' && (
                       <div className="flex justify-between"><span>On Inv %:</span> <span>{auditResult.onInvVal}</span></div>
                   )}
                   {auditResult.onInvSource === 'PAN' && <div className="text-gray-400 italic text-[9px]">* On Inv from PAN-INDIA</div>}
              </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 relative">
      
      {/* Progress Overlay */}
      {loading && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 text-lg">Processing Task</h3>
                      {eta && (
                          <span className="text-xs font-mono bg-blue-50 text-fkBlue px-2 py-1 rounded flex items-center gap-1">
                             <Clock className="w-3 h-3"/> {eta} remaining
                          </span>
                      )}
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                      <div 
                        className="bg-fkBlue h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
                        style={{ width: `${progress}%` }}
                      >
                          {progress > 10 && <span className="text-[9px] text-white font-bold">{progress}%</span>}
                      </div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin"/> {processingStatus || 'Please wait...'}
                      </span>
                      <span>{progress}%</span>
                  </div>
              </div>
          </div>
      )}

      {/* Safety Modal for DB Clear */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-red-100 animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <div className="bg-red-100 p-2 rounded-full">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">System Reset Confirmation</h3>
                </div>
                
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    This action will <strong>permanently delete all active records</strong> and reset the workspace for the new month. This cannot be undone.
                </p>
                
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Type "DELETE" to confirm
                </label>
                <input 
                    type="text" 
                    value={clearConfirmationText}
                    onChange={(e) => setClearConfirmationText(e.target.value)}
                    className="w-full border border-gray-300 rounded p-3 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-mono mb-6"
                    placeholder="DELETE"
                    autoFocus
                />
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setShowClearModal(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmClearDB}
                        disabled={clearConfirmationText !== 'DELETE'}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" /> Confirm Reset
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               Checker Workspace
            </h2>
            <p className="text-sm text-gray-500">Audit commercial logic and approvals</p>
        </div>
        <div className="flex gap-1 bg-white p-1 rounded border border-gray-200">
          <button onClick={() => setActiveTab('AUDIT')} className={`px-4 py-2 rounded text-sm font-semibold transition-all ${activeTab === 'AUDIT' ? 'bg-fkBlue text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Audit Tool</button>
          <button onClick={() => setActiveTab('APPROVALS')} className={`px-4 py-2 rounded text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'APPROVALS' ? 'bg-fkBlue text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            Approvals
            {requests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.length}</span>}
          </button>
          <button onClick={() => setActiveTab('CLOSURE')} className={`px-4 py-2 rounded text-sm font-semibold transition-all ${activeTab === 'CLOSURE' ? 'bg-fkYellow text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            Month End
          </button>
        </div>
      </div>

      {activeTab === 'AUDIT' && (
        <div id="tour-checker-audit" className="space-y-6">
           <div className="flex gap-4">
              <button 
                onClick={() => setAuditMode('SINGLE')} 
                className={`flex-1 p-4 border rounded-lg text-center font-bold transition-all ${auditMode === 'SINGLE' ? 'border-fkBlue bg-blue-50 text-fkBlue' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                 Single FSN Audit
              </button>
              <button 
                onClick={() => setAuditMode('BULK')} 
                className={`flex-1 p-4 border rounded-lg text-center font-bold transition-all ${auditMode === 'BULK' ? 'border-fkBlue bg-blue-50 text-fkBlue' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                 Bulk File Audit
              </button>
           </div>

          {auditMode === 'SINGLE' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <div className="fk-card p-6">
                  <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 tracking-wider">Run Audit</h3>
                  <div className="space-y-3 relative">
                    <div className="relative">
                        <input 
                        className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none" 
                        placeholder="Enter FSN"
                        value={auditQuery.fsn}
                        onChange={handleFsnChange}
                        onFocus={() => { if(auditQuery.fsn) setShowSuggestions(true); }}
                        maxLength={16}
                        />
                        <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                    </div>
                    
                    {/* Autocomplete Suggestions */}
                    {showSuggestions && filteredFsns.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg mt-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            {filteredFsns.map(fsn => (
                                <button 
                                    key={fsn}
                                    onClick={() => selectSuggestion(fsn)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-fkBlue transition-colors border-b border-gray-50 last:border-0"
                                >
                                    {fsn}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <select 
                          className="flex-1 bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none"
                          value={auditQuery.city}
                          onChange={e => setAuditQuery({...auditQuery, city: e.target.value})}
                        >
                          {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                          className="w-24 bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none text-sm"
                          value={auditQuery.unit}
                          onChange={e => setAuditQuery({...auditQuery, unit: e.target.value})}
                        >
                          <option value="PERCENT">Percent</option>
                          <option value="VALUE">Value</option>
                        </select>
                    </div>

                    <input 
                      type="number"
                      className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none" 
                      placeholder="Expected Total Value"
                      value={auditQuery.targetMargin || ''}
                      onChange={e => setAuditQuery({...auditQuery, targetMargin: parseFloat(e.target.value)})}
                    />
                    <button 
                      onClick={handleAudit}
                      disabled={loading}
                      className="w-full bg-fkBlue hover:bg-blue-600 text-white font-bold py-2.5 rounded shadow-sm transition-colors"
                    >
                      Analyze Variance
                    </button>
                  </div>
                </div>
                
                {auditResult && (
                  <div className={`p-5 rounded-lg border shadow-sm animate-in zoom-in duration-300 ${auditResult.status === 'MATCH' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className={`text-lg font-bold flex items-center gap-2 ${auditResult.status === 'MATCH' ? 'text-green-700' : 'text-red-700'}`}>
                            {auditResult.status === 'MATCH' ? <Check className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                            {auditResult.status}
                        </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Variance Val</p>
                            <p className={`text-xl font-mono font-bold ${auditResult.variance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {auditResult.variance > 0 ? '+' : ''}{auditResult.variance.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Variance %</p>
                            <div className="flex items-center gap-1">
                                <TrendingUp className={`w-4 h-4 ${parseFloat(auditResult.variancePercent) > 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <p className="text-xl font-mono font-bold text-gray-800">
                                    {Math.abs(Number(auditResult.variancePercent))}%
                                </p>
                            </div>
                        </div>
                    </div>
                    {auditResult.baseType && (
                        <div className="mt-3 bg-white/50 p-2 rounded text-[10px] text-gray-600 border border-gray-100">
                            <strong>Calculation Logic:</strong> {auditResult.baseType} + On Inv %
                        </div>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 fk-card p-6 min-h-[400px]">
                {auditResult ? (
                  <div className="h-full w-full">
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={auditResult.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                            <XAxis dataKey="name" stroke="#9e9e9e" tick={{fill: '#424242', fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis stroke="#9e9e9e" tick={{fill: '#424242', fontSize: 12}} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f5f5f5'}} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            
                            <Bar dataKey="base" stackId="system" name={auditResult.baseType} fill="#2874f0" radius={[0, 0, 4, 4]}>
                              <LabelList dataKey="base" position="center" className="fill-white font-bold text-[10px]" formatter={(v: number) => v > 0 ? v.toFixed(0) : ''} />
                            </Bar>
                            {auditQuery.unit === 'PERCENT' && (
                                <Bar dataKey="onInv" stackId="system" name="On Invoice %" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                                  <LabelList dataKey="onInv" position="center" className="fill-white font-bold text-[10px]" formatter={(v: number) => v > 0 ? v.toFixed(0) : ''} />
                                </Bar>
                            )}
                            
                            <Bar dataKey="target" stackId="target" name="User Target" fill={auditResult.status === 'MATCH' ? '#388e3c' : '#ff9f00'} radius={[4, 4, 4, 4]}>
                                <LabelList dataKey="target" position="top" className="fill-gray-600 font-bold text-xs" formatter={(v: number) => v.toFixed(2)} />
                            </Bar>

                            {auditResult.status === 'MISMATCH' && (
                                <ReferenceLine 
                                    y={auditResult.targetTotal} 
                                    stroke="#ff9f00" 
                                    strokeDasharray="3 3" 
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
                    <p>Run analysis to view chart</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // BULK AUDIT UI
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 fk-card p-6 space-y-4">
                         <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-fkBlue hover:bg-blue-50 transition-colors relative cursor-pointer">
                             <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleBulkUpload} />
                             <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                             <p className="text-sm font-bold text-gray-600">{bulkFile || 'Upload Audit CSV'}</p>
                             <p className="text-xs text-gray-400">FSN, Margin Value, Margin Value Unit</p>
                         </div>
                         
                         <div className="flex gap-2">
                             <button onClick={downloadAuditTemplate} className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                                 <FileDown className="w-3 h-3"/> Template
                             </button>
                         </div>

                         {bulkAuditData.length > 0 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Audit City</label>
                                    <select 
                                        className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800"
                                        value={bulkAuditCity}
                                        onChange={(e) => setBulkAuditCity(e.target.value)}
                                    >
                                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <button 
                                  onClick={runBulkAudit}
                                  disabled={loading}
                                  className="w-full bg-fkBlue hover:bg-blue-600 text-white font-bold py-3 rounded shadow-md flex items-center justify-center gap-2"
                                >
                                  Run Bulk Audit
                                </button>
                                <p className="text-xs text-gray-400 text-center">
                                    Auditing against current date ({new Date().toISOString().split('T')[0]})
                                </p>
                            </div>
                         )}
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 fk-card p-0 overflow-hidden flex flex-col">
                        <div className="bg-gray-50 border-b border-gray-200 p-4 font-bold text-gray-700 flex justify-between">
                            <span>Audit Results</span>
                            {bulkResults && <span className="text-xs font-normal bg-white border px-2 py-1 rounded">{bulkResults.length} records processed</span>}
                        </div>
                        <div className="flex-1 overflow-auto max-h-[500px]">
                            {bulkResults ? (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-3">FSN / Details</th>
                                            <th className="p-3 text-right">Target</th>
                                            <th className="p-3 text-right">System Base</th>
                                            <th className="p-3 text-right">On Inv %</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 text-right">Var</th>
                                            <th className="p-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bulkResults.map((res, i) => (
                                            <tr key={i} className="hover:bg-blue-50/30">
                                                <td className="p-3">
                                                    <div className="font-mono font-bold text-fkBlue text-xs">{res.fsn}</div>
                                                    <div className="text-[10px] text-gray-500 truncate max-w-[150px]" title={res.title}>{res.title}</div>
                                                </td>
                                                <td className="p-3 text-right font-medium">
                                                    {res.targetVal}
                                                    <div className="text-[9px] text-gray-400">{res.unit}</div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {res.baseVal}
                                                    <div className="text-[9px] text-gray-400">{res.baseType}</div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {res.onInvVal > 0 ? (
                                                        <span className="text-purple-600 font-bold">{res.onInvVal}%</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-800">
                                                    {res.systemTotal.toFixed(2)}
                                                </td>
                                                <td className={`p-3 text-right font-bold ${res.variance > 0 ? 'text-green-600' : res.variance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {res.variance.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {res.status === 'MATCH' ? (
                                                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">MATCH</span>
                                                    ) : (
                                                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">MISMATCH</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-10">
                                    <FileText className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Upload CSV and Run Audit to see results</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'APPROVALS' && (
        <div id="tour-checker-approvals" className="space-y-4">
           {requests.length > 0 && (
               <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 mb-4">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input 
                        className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                        placeholder="Search by FSN, Title, KAM, or User..."
                        value={approvalSearchTerm}
                        onChange={(e) => setApprovalSearchTerm(e.target.value)}
                    />
                    {approvalSearchTerm && (
                        <button onClick={() => setApprovalSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
               </div>
           )}

           {filteredRequests.length > 0 && (
                <div className="sticky top-0 z-10 bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <input 
                            type="checkbox"
                            checked={filteredRequests.length > 0 && filteredRequests.every(r => selectedRequestIds.has(r.id))}
                            onChange={toggleSelectAllRequests}
                            className="w-5 h-5 rounded border-gray-300 text-fkBlue focus:ring-fkBlue cursor-pointer"
                        />
                        <span className="font-semibold text-gray-700">
                            {selectedRequestIds.size === 0 ? 'Select All' : `${selectedRequestIds.size} Selected`}
                        </span>
                    </div>
                    {selectedRequestIds.size > 0 && (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleBulkAction('REJECTED')}
                                className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded text-sm font-bold transition-colors"
                            >
                                Reject ({selectedRequestIds.size})
                            </button>
                            <button 
                                onClick={() => handleBulkAction('APPROVED')}
                                className="px-4 py-2 bg-fkGreen hover:bg-green-700 text-white rounded text-sm font-bold shadow-sm transition-colors"
                            >
                                Approve ({selectedRequestIds.size})
                            </button>
                        </div>
                    )}
                </div>
           )}

          {requests.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
              <Check className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="text-gray-500 font-medium">No pending approvals.</p>
            </div>
          ) : filteredRequests.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No requests match "{approvalSearchTerm}".</p>
             </div>
          ) : (
            filteredRequests.map(req => (
              <div key={req.id} className={`fk-card p-5 flex flex-col md:flex-row gap-4 border-l-4 border-l-fkYellow transition-colors ${selectedRequestIds.has(req.id) ? 'bg-blue-50/30' : ''}`}>
                <div className="flex items-start gap-4 flex-1">
                     <input 
                        type="checkbox"
                        checked={selectedRequestIds.has(req.id)}
                        onChange={() => toggleSelectRequest(req.id)}
                        className="mt-1.5 w-5 h-5 rounded border-gray-300 text-fkBlue focus:ring-fkBlue cursor-pointer flex-shrink-0"
                     />
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded font-bold">ACTION REQUIRED</span>
                            <h4 className="font-bold text-gray-800 text-lg">{req.payload.title} <span className="text-gray-400 font-normal">({req.payload.fsn})</span></h4>
                        </div>
                        <div className="text-sm text-gray-500 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 mb-2">
                            <span>City: <b className="text-gray-800">{req.payload.city}</b></span>
                            <span>Type: <b className="text-gray-800">{req.payload.type}</b></span>
                            <span>New Value: <b className="text-fkBlue">{req.payload.value}</b></span>
                            <span>By: {req.requestedBy}</span>
                        </div>
                        <div className="text-xs flex gap-4 text-gray-400">
                            <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> {req.payload.vertical || 'N/A'}</span>
                            <span className="flex items-center gap-1"><UserIcon className="w-3 h-3"/> {req.payload.kam || 'N/A'}</span>
                        </div>
                        {req.reason && (
                            <div className="mt-2 bg-red-50 text-red-600 text-xs px-2 py-1 rounded inline-block font-semibold">
                                Reason: {req.reason}
                            </div>
                        )}
                     </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto self-start md:self-center pl-9 md:pl-0">
                  <button 
                    onClick={() => handleRequestAction(req.id, 'REJECTED')}
                    className="flex-1 md:flex-none px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => handleRequestAction(req.id, 'APPROVED')}
                    className="flex-1 md:flex-none px-4 py-2 rounded bg-fkGreen hover:bg-green-700 text-white font-bold text-sm shadow transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'CLOSURE' && (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Section */}
                <div className="fk-card p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <FileDown className="w-6 h-6 text-fkBlue" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Export Data</h3>
                            <p className="text-sm text-gray-500">Download data for records and auditing.</p>
                        </div>
                    </div>
                    
                    <div className="pt-4 space-y-4 border-t border-gray-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2 uppercase">
                                <Calendar className="w-3 h-3" /> Select Month
                            </label>
                            <input 
                                type="month"
                                className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleExport('MONTH')}
                                disabled={exportLoading}
                                className="w-full py-2 bg-fkBlue hover:bg-blue-600 rounded text-white text-sm font-bold shadow-sm transition-colors"
                            >
                                Export {selectedMonth} Data
                            </button>
                            <button 
                                onClick={() => handleExport('FULL')}
                                disabled={exportLoading}
                                className="w-full py-2 border border-gray-300 hover:bg-gray-50 rounded text-gray-600 text-sm font-medium transition-colors"
                            >
                                Export Full Database
                            </button>
                        </div>
                    </div>
                </div>

                {/* Clear Section */}
                <div className="fk-card p-6 space-y-4 border-red-100 bg-red-50/30">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-red-100 p-3 rounded-lg">
                            <Database className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-600">System Reset</h3>
                            <p className="text-sm text-gray-500">Clear database for new operational cycle.</p>
                        </div>
                    </div>

                    <div className="pt-4 space-y-4 border-t border-red-100">
                        <div className="bg-red-50 border border-red-100 p-4 rounded text-sm text-red-700">
                            <p className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>
                                    <strong>Warning:</strong> This deletes ALL active records. Export data first.
                                </span>
                            </p>
                        </div>
                        
                        <button 
                            onClick={initiateClearDB}
                            disabled={loading}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded text-white font-bold shadow-md flex items-center justify-center gap-2 transition-all"
                        >
                            <Trash2 className="w-4 h-4" /> Clear Database
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};