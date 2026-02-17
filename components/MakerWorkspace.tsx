import React, { useState, useEffect, useRef } from 'react';
import { CommercialRecord, CommercialType, DuplicateRequest, User, COMMERCIAL_TYPES } from '../types';
import { db } from '../services/db';
import { Plus, Upload, Save, AlertTriangle, FileText, X, Download, Check, Trash2, ArrowUpRight, ShieldAlert, User as UserIcon, Layers, Info, Loader2, Clock } from 'lucide-react';
import Papa from 'papaparse';

interface MakerProps {
  user: User;
}

export const MakerWorkspace: React.FC<MakerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'BULK'>('MANUAL');
  
  // Dynamic Cities
  const [cities, setCities] = useState<string[]>([]);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [newCityCode, setNewCityCode] = useState('');

  // Manual Form State
  const [formData, setFormData] = useState<Partial<CommercialRecord>>({
    city: 'PAN-INDIA',
    type: CommercialType.MARGIN_PERCENT,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
    vertical: '',
    kam: ''
  });
  
  // Real-time Validation State
  const [instantConflict, setInstantConflict] = useState<boolean>(false);
  const [highMarginAlert, setHighMarginAlert] = useState<boolean>(false);

  // Bulk State
  const [bulkType, setBulkType] = useState<CommercialType>(CommercialType.MARGIN_PERCENT);

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'warning' | null}>({ msg: '', type: null });

  // Progress State
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Approval Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<DuplicateRequest[]>([]);
  const [completedUploadStats, setCompletedUploadStats] = useState<{
      added: number;
      skipped: number;
      missingKam: number;
      newCities: string[];
      highMarginSent: number;
  } | null>(null);

  // Initialize Data
  useEffect(() => {
    const init = async () => {
      // 1. Load Draft
      const draft = localStorage.getItem('mm_draft_form');
      let draftData = {};
      if (draft) {
        draftData = JSON.parse(draft);
        setFormData(draftData);
      }
      
      // 2. Load Cities and Validate
      const c = await db.getCities();
      setCities(c);
      
      // Validate the city from draft or current state
      const currentCity = (draftData as any).city || formData.city || 'PAN-INDIA';
      if (!c.includes(currentCity)) {
         setFormData(prev => ({ ...prev, city: c[0] || 'PAN-INDIA' }));
      }
    };
    
    init();
  }, []);

  // Save draft & Real-time Check
  useEffect(() => {
    localStorage.setItem('mm_draft_form', JSON.stringify(formData));
    
    // High Margin Check
    if (formData.type === CommercialType.MARGIN_PERCENT && (formData.value || 0) > 60) {
        setHighMarginAlert(true);
    } else {
        setHighMarginAlert(false);
    }

    // Debounce the conflict check
    const timeoutId = setTimeout(async () => {
        if(formData.fsn && formData.fsn.length === 16 && formData.city && formData.type && formData.startDate && formData.endDate) {
            const records = await db.getRecords();
            const conflict = checkForConflict(records, formData as CommercialRecord);
            setInstantConflict(conflict);
        } else {
            setInstantConflict(false);
        }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData]);

  const checkForConflict = (existingRecords: CommercialRecord[], input: CommercialRecord): boolean => {
      return existingRecords.some(r => {
        // 1. Match FSN & Type
        if (r.fsn !== input.fsn) return false;
        if (r.type !== input.type) return false;

        // 2. Check City Logic (Exact Match OR PAN-INDIA Collision)
        // If entering specific city, check against existing specific city OR PAN-INDIA
        const cityConflict = (input.city === 'PAN-INDIA' || r.city === 'PAN-INDIA' || input.city === r.city);
        
        if (!cityConflict) return false;

        // 3. Date Logic based on Commercial Type
        const isOnOrOffInvoice = input.type === CommercialType.ON_INVOICE || input.type === CommercialType.OFF_INVOICE;

        if (isOnOrOffInvoice) {
            // SPECIAL RULE: For On/Off Invoice, overlaps are allowed (stacking).
            // Conflict ONLY if Exact Date Duplicate (Start & End match exactly).
            return input.startDate === r.startDate && input.endDate === r.endDate;
        } else {
            // STANDARD RULE: For Margin/NLC, NO overlaps allowed.
            // Check intersection: (StartA <= EndB) and (EndA >= StartB)
            return (input.startDate <= r.endDate) && (input.endDate >= r.startDate);
        }
      });
  };

  // Helper to build FSN Index for Big Data Performance
  const buildFsnIndex = (records: CommercialRecord[]) => {
      const map = new Map<string, CommercialRecord[]>();
      records.forEach(r => {
          if (!map.has(r.fsn)) map.set(r.fsn, []);
          map.get(r.fsn)!.push(r);
      });
      return map;
  };

  const refreshCities = async () => {
    const c = await db.getCities();
    setCities(c);
    return c;
  };

  const handleAddNewCity = async () => {
    if (!newCityCode) return;
    const code = newCityCode.toUpperCase().trim();
    if (code !== 'PAN-INDIA' && code.length > 3) {
       setNotification({ msg: 'City code must be 3 characters or less.', type: 'error' });
       return;
    }
    const cleanCode = code.replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) return;
    if (cities.includes(cleanCode)) {
       setNotification({ msg: `City ${cleanCode} already exists.`, type: 'warning' });
       return;
    }
    if (cleanCode) {
       await db.addCity(cleanCode);
       await refreshCities();
       setFormData(prev => ({...prev, city: cleanCode}));
       setNewCityCode('');
       setIsAddingCity(false);
       setNotification({ msg: `City ${cleanCode} added.`, type: 'success' });
    }
  };

  const handleDeleteCity = async () => {
    const cityToDelete = formData.city;
    if (!cityToDelete || cityToDelete === 'PAN-INDIA') {
        setNotification({ msg: 'Cannot delete default PAN-INDIA city.', type: 'error' });
        return;
    }
    if (window.confirm(`Delete city code "${cityToDelete}"?`)) {
        try {
            await db.deleteCity(cityToDelete);
            const updatedCities = await refreshCities();
            setFormData(prev => ({ ...prev, city: updatedCities[0] || 'PAN-INDIA' }));
            setNotification({ msg: `City ${cityToDelete} removed.`, type: 'success' });
        } catch (err) {
            setNotification({ msg: 'Failed to delete city.', type: 'error' });
        }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification({ msg: '', type: null });

    if (!formData.fsn || !formData.value || !formData.brand || !formData.title || !formData.vertical || !formData.kam) {
        setNotification({ msg: 'Please fill all fields', type: 'error' });
        return;
    }
    
    // Strict FSN Length Check
    if (formData.fsn.length !== 16) {
        setNotification({ msg: 'FSN must be exactly 16 characters.', type: 'error' });
        return;
    }

    // Validate Caps
    const isPercentage = formData.type === CommercialType.MARGIN_PERCENT || 
                         formData.type === CommercialType.NLC_PERCENT || 
                         formData.type === CommercialType.ON_INVOICE || 
                         formData.type === CommercialType.OFF_INVOICE;

    if (isPercentage && formData.value! > 100) {
        setNotification({ msg: `${formData.type} cannot exceed 100%`, type: 'error' });
        return;
    }

    if (formData.type !== CommercialType.MARGIN_PERCENT && formData.endDate! < formData.startDate!) {
        setNotification({ msg: 'End Date cannot be before Start Date', type: 'error' });
        return;
    }

    setLoading(true);
    setProcessingStatus('Saving record...');
    setProgress(50); // Fake progress for manual entry

    try {
      const records = await db.getRecords();
      
      const isConflict = checkForConflict(records, formData as CommercialRecord);
      const isHighMargin = formData.type === CommercialType.MARGIN_PERCENT && (formData.value || 0) > 60;

      const newRecord: CommercialRecord = {
        id: `rec_${Date.now()}`,
        ...formData as CommercialRecord,
        value: Number(formData.value),
        lastUpdatedBy: user.name,
        lastUpdatedAt: Date.now()
      };

      if (isConflict || isHighMargin) {
        let reason = '';
        if (isConflict) {
            const isInvoice = formData.type === CommercialType.ON_INVOICE || formData.type === CommercialType.OFF_INVOICE;
            reason = isInvoice ? 'Exact Duplicate Conflict' : 'Duplicate/Overlap Conflict';
        }
        if (isHighMargin) reason = reason ? reason + ' & High Margin (>60%)' : 'High Margin (>60%)';

        const req: DuplicateRequest = {
          id: `req_${Date.now()}`,
          originalRecordId: null, // Logic updated in DB service to find conflict by content
          payload: newRecord,
          requestedBy: user.name,
          requestedAt: Date.now(),
          status: 'PENDING',
          reason: reason
        };
        await db.createDuplicateRequest(req);
        setNotification({ msg: `Request sent to Checker: ${reason}`, type: 'warning' });
      } else {
        await db.addRecords([newRecord]);
        setNotification({ msg: 'Record saved successfully.', type: 'success' });
        setFormData(prev => ({ 
            ...prev, 
            fsn: '', 
            value: 0,
            // Reset dates to defaults
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]
        }));
      }
    } catch (err) {
      setNotification({ msg: 'Failed to save record.', type: 'error' });
    } finally {
      setLoading(false);
      setProgress(0);
      setEta(null);
    }
  };

  const showUploadNotification = (stats: { added: number, skipped: number, missingKam: number, newCities: string[] }, reqCount: number) => {
      let msg = '';
      let type: 'success' | 'warning' | 'error' = 'success';

      if (stats.newCities.length > 0) msg += `New Cities Added: ${stats.newCities.join(', ')}. `;
      if (stats.added > 0) msg += `Uploaded ${stats.added} records. `;
      if (reqCount > 0) {
          msg += `${reqCount} sent for approval. `;
          type = 'warning';
      }
      if (stats.skipped > 0) msg += `${stats.skipped} skipped (Invalid FSN). `;
      if (stats.missingKam > 0) msg += `${stats.missingKam} skipped (Missing KAM). `;

      if (stats.added === 0 && reqCount === 0 && stats.newCities.length === 0) {
          if (stats.missingKam > 0 || stats.skipped > 0) {
              type = 'error';
              if (!msg) msg = "No valid records found (check FSN or KAM).";
          } else {
              type = 'error';
              msg = "No valid records or new cities found in file.";
          }
      }
      
      setNotification({ msg, type });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProcessingStatus('Parsing CSV...');
    setProgress(0);
    setEta('Starting...');

    // Use setTimeout to allow the UI to render the loading state before parsing logic locks thread
    setTimeout(() => {
        Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        error: (err) => {
            setNotification({ msg: `CSV Parse Failed: ${err.message}`, type: 'error' });
            setLoading(false);
            setProgress(0);
            setEta(null);
            e.target.value = '';
        },
        complete: async (results) => {
            try {
                const headers = results.meta.fields || [];
                
                // Smart Header Mapping
                const headerMap: {[key: string]: string} = {};
                headers.forEach(h => {
                    const norm = h.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (norm === 'FSN') headerMap['fsn'] = h;
                    if (norm === 'BRAND') headerMap['brand'] = h;
                    if (norm === 'TITLE') headerMap['title'] = h;
                    if (norm === 'VERTICAL') headerMap['vertical'] = h;
                    if (norm === 'KAM') headerMap['kam'] = h;
                    if (norm.includes('START') && norm.includes('DATE')) headerMap['startDate'] = h;
                    if (norm.includes('END') && norm.includes('DATE')) headerMap['endDate'] = h;
                    if (norm === 'VALUE') headerMap['value'] = h;
                    if (norm === 'UNIT' || norm === 'TYPE') headerMap['unit'] = h;
                });

                // Validation
                if (!headerMap['kam']) {
                    setNotification({ msg: "Upload Failed: 'KAM' column is missing in the CSV file.", type: 'error' });
                    setLoading(false);
                    e.target.value = ''; 
                    return;
                }

                // 2. Identify and Add New Cities from Headers
                setProcessingStatus('Validating Cities...');
                const staticFieldNames = Object.values(headerMap);
                let currentCities = await db.getCities();
                const potentialNewCities = headers.filter(h => !staticFieldNames.includes(h));
                
                const newlyAddedCities: string[] = [];

                for (const h of potentialNewCities) {
                    const cleanCode = h.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
                    // Basic check to assume it's a city if it's not one of our known columns and length is <=3
                    if (cleanCode.length > 0 && cleanCode.length <= 3 && !currentCities.includes(cleanCode)) {
                        await db.addCity(cleanCode);
                        newlyAddedCities.push(cleanCode);
                    }
                }

                if (newlyAddedCities.length > 0) {
                    currentCities = await db.getCities();
                    setCities(currentCities); 
                }

                // 3. Prepare Data for Optimized Batch Processing
                const newRecords: CommercialRecord[] = [];
                const conflictRequests: DuplicateRequest[] = [];
                const highMarginRequests: DuplicateRequest[] = [];
                
                setProcessingStatus('Indexing Database...');
                const existingRecords = await db.getRecords();
                
                // OPTIMIZATION: Build Index Maps for O(1) Lookups instead of O(N) scans
                // Index of existing DB records by FSN
                const dbIndex = buildFsnIndex(existingRecords);
                // Index of records currently being processed in this batch (to catch internal dupes)
                const batchIndex = new Map<string, CommercialRecord[]>();

                let skipped = 0;
                let missingKam = 0;
                let detectedPercentageInNlcValue = false;
                let maxRecordValue = 0;
                
                // Chunk Processing for Progress Bar
                const BATCH_SIZE = 500;
                const totalRows = results.data.length;
                const startTime = Date.now();
                
                setProcessingStatus(`Processing ${totalRows} records...`);

                // Helper function to process batch
                const processBatch = async () => {
                    for (let i = 0; i < totalRows; i++) {
                        // Yield to UI every BATCH_SIZE iterations
                        if (i % BATCH_SIZE === 0 && i > 0) {
                            const percent = Math.round((i / totalRows) * 100);
                            const elapsed = (Date.now() - startTime) / 1000;
                            const rate = i / elapsed;
                            const remainingSeconds = (totalRows - i) / rate;
                            
                            setProgress(percent);
                            setEta(remainingSeconds < 60 ? `${Math.ceil(remainingSeconds)}s` : `${Math.ceil(remainingSeconds/60)}m`);
                            
                            // Allow UI to render
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }

                        const row: any = results.data[i];
                        const fsn = row[headerMap['fsn']] || row['FSN']; // Fallback
                        
                        if(!fsn) continue;
                        
                        if(fsn.length !== 16) {
                            skipped++;
                            continue;
                        }

                        const kamValue = row[headerMap['kam']]; 
                        if (!kamValue || !kamValue.trim()) {
                            missingKam++;
                            continue; 
                        }
                        
                        // NLC Value check logic
                        // If file has explicit unit column, check it
                        const rowUnit = headerMap['unit'] ? String(row[headerMap['unit']]).toUpperCase() : '';
                        if (bulkType === CommercialType.NLC_VALUE) {
                            if (rowUnit.includes('PERCENT') || rowUnit.includes('%')) {
                                detectedPercentageInNlcValue = true;
                            }
                        }

                        // Defaults for dates
                        const defaultStart = new Date().toISOString().split('T')[0];
                        const defaultEnd = new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0];

                        const extractedStartDate = headerMap['startDate'] ? row[headerMap['startDate']] : defaultStart;
                        const extractedEndDate = headerMap['endDate'] ? row[headerMap['endDate']] : defaultEnd;

                        Object.keys(row).forEach(key => {
                            // Skip if this key maps to a known static field (like FSN, KAM, Dates etc)
                            // EXCEPT if it is 'VALUE' column, which maps to PAN-INDIA
                            if (staticFieldNames.includes(key) && key !== headerMap['value']) return;

                            const upperKey = key.toUpperCase();
                            const cleanKey = upperKey.trim().replace(/[^A-Z0-9]/g, '');
                            
                            let targetCity = '';
                            if (key === headerMap['value'] || upperKey === 'VALUE') {
                                targetCity = 'PAN-INDIA';
                            } else if (currentCities.includes(cleanKey)) {
                                targetCity = cleanKey;
                            } else if (currentCities.includes(key)) {
                                targetCity = key;
                            }

                            if (!targetCity) return;

                            let val = parseFloat(row[key]);
                            if (isNaN(val)) return;

                            // Track max value for heuristic check
                            if (val > maxRecordValue) maxRecordValue = val;

                            const isPercentage = bulkType === CommercialType.MARGIN_PERCENT || 
                                                bulkType === CommercialType.NLC_PERCENT || 
                                                bulkType === CommercialType.ON_INVOICE || 
                                                bulkType === CommercialType.OFF_INVOICE;

                            if (isPercentage && val > 100) val = 100;
                            if (isPercentage && val <= 1 && val > 0) val = val * 100;

                            const rec: CommercialRecord = {
                            id: `rec_${Math.random().toString(36).substr(2,9)}_${Math.random()}`,
                            fsn: fsn,
                            brand: row[headerMap['brand']] || 'Unknown',
                            title: row[headerMap['title']] || 'Bulk Upload Item',
                            vertical: row[headerMap['vertical']] || 'Unknown',
                            kam: kamValue,
                            city: targetCity,
                            startDate: extractedStartDate || defaultStart,
                            endDate: extractedEndDate || defaultEnd,
                            type: bulkType,
                            value: val,
                            lastUpdatedBy: user.name,
                            lastUpdatedAt: Date.now()
                            };

                            // Optimized Check using Map Indexes
                            const dbCandidates = dbIndex.get(rec.fsn) || [];
                            const batchCandidates = batchIndex.get(rec.fsn) || [];
                            
                            // We only check against candidates with same FSN, reducing complexity from O(TotalRecords) to O(1)
                            const isConflict = checkForConflict(dbCandidates, rec) || checkForConflict(batchCandidates, rec);
                            // IMPORTANT: High Margin logic is separated from duplicates if it's NOT a conflict
                            const isHighMargin = bulkType === CommercialType.MARGIN_PERCENT && val > 60;

                            if (isConflict) {
                                let reason = '';
                                const isInvoice = bulkType === CommercialType.ON_INVOICE || bulkType === CommercialType.OFF_INVOICE;
                                reason = isInvoice ? 'Exact Duplicate' : 'Duplicate/Overlap';
                                
                                // It's a duplicate, we track it for the modal choice
                                // We can also note if it was high margin in the reason
                                if (isHighMargin) reason += ' & High Margin';

                                const req: DuplicateRequest = {
                                    id: `req_${Math.random().toString(36).substr(2,9)}_${Math.random()}`,
                                    originalRecordId: null,
                                    payload: rec,
                                    requestedBy: user.name,
                                    requestedAt: Date.now(),
                                    status: 'PENDING',
                                    reason: reason
                                };
                                conflictRequests.push(req);
                            } else if (isHighMargin) {
                                // High Margin but NOT a conflict. Directly send for approval.
                                const req: DuplicateRequest = {
                                    id: `req_${Math.random().toString(36).substr(2,9)}_${Math.random()}`,
                                    originalRecordId: null,
                                    payload: rec,
                                    requestedBy: user.name,
                                    requestedAt: Date.now(),
                                    status: 'PENDING',
                                    reason: 'High Margin (>60%)'
                                };
                                highMarginRequests.push(req);
                            } else {
                                newRecords.push(rec);
                                // Add to batch index so subsequent rows in this same file detect conflict
                                if(!batchIndex.has(rec.fsn)) batchIndex.set(rec.fsn, []);
                                batchIndex.get(rec.fsn)!.push(rec);
                            }
                        });
                    }
                };

                // Run the batch processing
                await processBatch();

                // POST PROCESSING VALIDATION for NLC VALUE
                if (detectedPercentageInNlcValue) {
                    setNotification({ msg: "Upload Rejected: File contains 'Percent' unit but 'NLC Value' type was selected.", type: 'error' });
                    setLoading(false); setProgress(0); setEta(null);
                    return;
                }
                // Heuristic check: If NLC Value is selected, but MAX value is <= 100, assume it's percentage data uploaded by mistake
                // Only apply this heuristic if NO explicit unit column was found (to avoid blocking small absolute values if correctly labeled)
                if (bulkType === CommercialType.NLC_VALUE && !headerMap['unit'] && maxRecordValue <= 100 && maxRecordValue > 0) {
                    setNotification({ msg: "Upload Rejected: Values seem to be percentages (all ≤ 100). For NLC Value, use absolute amounts or add 'Unit' column with 'Value'.", type: 'error' });
                    setLoading(false); setProgress(0); setEta(null);
                    return;
                }

                setProcessingStatus('Finalizing Database...');
                setProgress(95);

                // 1. Add Valid Records
                if (newRecords.length > 0) {
                await db.addRecords(newRecords);
                }

                // 2. Auto-send High Margin (No Conflict) requests
                if (highMarginRequests.length > 0) {
                    await db.createDuplicateRequests(highMarginRequests);
                }

                const stats = {
                    added: newRecords.length,
                    skipped,
                    missingKam,
                    newCities: newlyAddedCities,
                    highMarginSent: highMarginRequests.length
                };

                // 3. Handle Duplicates (Conflicting requests)
                if (conflictRequests.length > 2) {
                    setPendingRequests(conflictRequests);
                    setCompletedUploadStats(stats);
                    setShowApprovalModal(true);
                    setLoading(false); 
                    setProgress(100);
                } else {
                    if (conflictRequests.length > 0) {
                        await db.createDuplicateRequests(conflictRequests);
                    }
                    
                    const totalSent = highMarginRequests.length + conflictRequests.length;
                    showUploadNotification(stats, totalSent);
                    
                    setProgress(100);
                    setTimeout(() => {
                        setLoading(false);
                        setProgress(0);
                        setEta(null);
                    }, 500);
                }
            } catch (err: any) {
                console.error("Upload error:", err);
                setNotification({ msg: `Upload Failed: ${err.message || 'Unknown error occurred during processing'}`, type: 'error' });
                setLoading(false);
                setProgress(0);
                setEta(null);
            } finally {
                e.target.value = '';
            }
        }
        });
    }, 100); // 100ms delay for UI render
  };

  const handleApprovalChoice = async (choice: 'PROCEED' | 'IGNORE') => {
      setShowApprovalModal(false);
      setLoading(true);
      setProcessingStatus(choice === 'PROCEED' ? 'Submitting Requests...' : 'Cleaning up...');
      setProgress(50);
      
      let reqCount = completedUploadStats?.highMarginSent || 0;
      
      if (choice === 'PROCEED') {
          await db.createDuplicateRequests(pendingRequests);
          reqCount += pendingRequests.length;
      }
      
      if (completedUploadStats) {
          showUploadNotification(completedUploadStats, reqCount);
      }
      
      setPendingRequests([]);
      setCompletedUploadStats(null);
      
      setProgress(100);
      setTimeout(() => {
          setLoading(false);
          setProgress(0);
          setEta(null);
      }, 500);
  };

  const downloadTemplate = () => {
    // Dynamically Add 'Unit' column to template if it's NLC type to guide user
    const extraCols = [];
    if (bulkType === CommercialType.NLC_VALUE || bulkType === CommercialType.NLC_PERCENT) {
        extraCols.push('Unit');
    }

    const headers = ['FSN', 'Brand', 'Title', 'Vertical', 'KAM', 'StartDate', 'EndDate', ...extraCols, ...cities];
    const isNLC = bulkType === CommercialType.NLC_VALUE;
    const exampleVal = isNLC ? '50000' : '10';
    const exampleUnit = isNLC ? 'Value' : 'Percent';

    const dummyRows = [
        ['MOBEXAMPLE123456', 'BrandX', 'Sample Product 1', 'Mobiles', 'John Doe', '2024-01-01', '2024-03-31', ...(extraCols.length ? [exampleUnit] : []), ...cities.map(() => exampleVal)],
    ];
    const csvContent = [headers.join(','), ...dummyRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${bulkType.replace(/\s/g, '')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto relative">
      
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

      {/* Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border-t-4 border-fkYellow animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-yellow-100 p-3 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-fkYellow" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Excessive Duplicates</h3>
                        <p className="text-sm text-gray-500">Action Required</p>
                    </div>
                </div>
                
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    You are attempting to create <strong>{pendingRequests.length}</strong> duplicate requests (conflicts). 
                    {completedUploadStats?.highMarginSent ? <span className="block mt-2 text-fkBlue font-medium">Note: {completedUploadStats.highMarginSent} high margin requests have already been sent for approval.</span> : null}
                    <br/><br/>
                    Do you want to send these duplicates to the Checker for approval, or ignore them?
                </p>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => handleApprovalChoice('IGNORE')}
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded font-medium transition-colors"
                    >
                        Ignore Duplicates
                    </button>
                    <button 
                        onClick={() => handleApprovalChoice('PROCEED')}
                        className="px-4 py-2 bg-fkYellow hover:bg-yellow-500 text-white rounded font-bold shadow-sm transition-colors"
                    >
                        Proceed to Approval
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Maker Workspace</h2>
           <p className="text-sm text-gray-500">Manage commercials and offers</p>
        </div>
        <div className="flex bg-white rounded shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setActiveTab('MANUAL')}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${activeTab === 'MANUAL' ? 'bg-fkBlue text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab('BULK')}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${activeTab === 'BULK' ? 'bg-fkBlue text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Bulk Upload
          </button>
        </div>
      </div>

      {notification.msg && (
        <div className={`p-4 rounded border flex items-center gap-3 shadow-sm ${
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
          notification.type === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' :
          'bg-green-50 border-green-200 text-green-700'
        }`}>
          {notification.type === 'error' ? <AlertTriangle className="h-5 w-5"/> : <FileText className="h-5 w-5"/>}
          <span className="font-medium">{notification.msg}</span>
          <button onClick={() => setNotification({msg:'', type:null})} className="ml-auto hover:bg-white/50 rounded p-1"><X className="h-4 w-4"/></button>
        </div>
      )}

      {/* Alerts */}
      <div className="space-y-2">
          {instantConflict && activeTab === 'MANUAL' && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="text-red-500 w-6 h-6" />
                <div>
                    <p className="font-bold text-gray-800 text-sm">Conflict Detected!</p>
                    <p className="text-xs text-gray-600">
                        {(formData.type === CommercialType.ON_INVOICE || formData.type === CommercialType.OFF_INVOICE) 
                         ? 'Exact duplicate date range exists. Saving triggers approval.' 
                         : 'Overlap with existing record. Saving triggers approval.'}
                    </p>
                </div>
            </div>
          )}
          {highMarginAlert && activeTab === 'MANUAL' && (
            <div className="p-3 bg-yellow-50 border-l-4 border-fkYellow rounded shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="text-fkYellow w-6 h-6" />
                <div>
                    <p className="font-bold text-gray-800 text-sm">High Margin Alert!</p>
                    <p className="text-xs text-gray-600">Margin &gt; 60% requires checker approval.</p>
                </div>
            </div>
          )}
      </div>

      {activeTab === 'MANUAL' ? (
        <form id="tour-maker-manual" onSubmit={handleManualSubmit} className="fk-card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">FSN (Product ID) <span className="text-red-500">*</span></label>
            <div className="relative">
                <input 
                  className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-colors" 
                  value={formData.fsn || ''}
                  onChange={e => setFormData({...formData, fsn: e.target.value})}
                  placeholder="16 Characters Required"
                  maxLength={16}
                />
                <div className={`text-[10px] text-right mt-1 font-mono ${formData.fsn?.length === 16 ? 'text-green-600' : 'text-gray-400'}`}>
                    {formData.fsn?.length || 0}/16
                </div>
            </div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Brand <span className="text-red-500">*</span></label>
            <input 
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-colors" 
              value={formData.brand || ''}
              onChange={e => setFormData({...formData, brand: e.target.value})}
              placeholder="e.g. Samsung"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title <span className="text-red-500">*</span></label>
            <input 
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-colors" 
              value={formData.title || ''}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Product Title"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Layers className="w-3 h-3"/> Vertical <span className="text-red-500">*</span></label>
            <input 
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-colors" 
              value={formData.vertical || ''}
              onChange={e => setFormData({...formData, vertical: e.target.value})}
              placeholder="e.g. Mobiles"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><UserIcon className="w-3 h-3"/> KAM <span className="text-red-500">*</span></label>
            <input 
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-colors" 
              value={formData.kam || ''}
              onChange={e => setFormData({...formData, kam: e.target.value})}
              placeholder="Account Manager Name"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">City <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {isAddingCity ? (
                <div className="flex-1 flex gap-1">
                   <input 
                     className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 uppercase"
                     placeholder="XXX"
                     autoFocus
                     value={newCityCode}
                     maxLength={3}
                     onChange={e => setNewCityCode(e.target.value)}
                   />
                   <button 
                     type="button" 
                     onClick={handleAddNewCity}
                     className="bg-fkGreen px-3 rounded text-white hover:bg-green-700"
                   >
                     <Check className="h-4 w-4" />
                   </button>
                   <button 
                     type="button" 
                     onClick={() => setIsAddingCity(false)}
                     className="bg-gray-200 px-3 rounded text-gray-700 hover:bg-gray-300"
                   >
                     <X className="h-4 w-4" />
                   </button>
                </div>
              ) : (
                <div className="flex-1 flex gap-2">
                  <select 
                    className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  >
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  
                  <button 
                    type="button" 
                    onClick={() => setIsAddingCity(true)}
                    className="px-3 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-600 transition-colors"
                    title="Add New City"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <button 
                    type="button"
                    onClick={handleDeleteCity}
                    disabled={formData.city === 'PAN-INDIA'}
                    className={`px-3 rounded border transition-colors ${formData.city === 'PAN-INDIA' ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Type <span className="text-red-500">*</span></label>
            <select 
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as CommercialType})}
            >
              <option value={CommercialType.MARGIN_PERCENT}>Margin %</option>
              <option value={CommercialType.NLC_VALUE}>NLC Value (Amount)</option>
              <option value={CommercialType.NLC_PERCENT}>NLC %</option>
              <option value={CommercialType.ON_INVOICE}>On Invoice %</option>
              <option value={CommercialType.OFF_INVOICE}>Off Invoice %</option>
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Value <span className="text-red-500">*</span></label>
            <input 
              type="number"
              className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none font-mono" 
              value={formData.value || ''}
              onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})}
              placeholder="0.00"
            />
            {/* Helper Text for Caps */}
            {formData.type?.includes('%') && (
                <p className="text-[10px] text-gray-400 mt-1">Capped at 100%</p>
            )}
          </div>

          {formData.type !== CommercialType.MARGIN_PERCENT && (
            <>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Start Date</label>
                <input 
                  type="date"
                  className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none" 
                  value={formData.startDate}
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">End Date</label>
                <input 
                  type="date"
                  className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-900 focus:border-fkBlue outline-none" 
                  value={formData.endDate}
                  onChange={e => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </>
          )}

          {/* Helper for Dates */}
          {(formData.type === CommercialType.ON_INVOICE || formData.type === CommercialType.OFF_INVOICE) && (
              <div className="col-span-full -mt-2 mb-2">
                  <p className="text-[10px] text-blue-600 flex items-center gap-1 bg-blue-50 w-fit px-2 py-1 rounded">
                      <Info className="w-3 h-3"/> 
                      Overlapping dates allowed for this type. Only exact duplicates require approval.
                  </p>
              </div>
          )}

          <div className="col-span-full flex justify-end pt-6 border-t border-gray-100">
             <button
               type="submit"
               disabled={loading}
               className="bg-fkYellow hover:bg-yellow-500 text-white font-bold py-2.5 px-8 rounded shadow-md hover:shadow-lg transition-all flex items-center gap-2"
             >
               {loading ? <span className="animate-spin">⌛</span> : <Save className="h-5 w-5" />}
               Save Record
             </button>
          </div>
        </form>
      ) : (
        <div id="tour-maker-bulk" className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <label className="block text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">Select Upload Type</label>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               {COMMERCIAL_TYPES.map(type => (
                 <button
                   key={type}
                   onClick={() => setBulkType(type)}
                   className={`p-4 rounded border text-sm font-semibold transition-all ${
                     bulkType === type 
                     ? 'bg-fkBlue text-white border-fkBlue shadow-md' 
                     : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                   }`}
                 >
                   {type}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-fkBlue font-medium rounded border border-gray-300 shadow-sm transition-colors text-sm"
            >
              <Download className="h-4 w-4" /> 
              Download Template
            </button>
          </div>

          <div className="fk-card border-dashed border-2 border-gray-300 p-12 flex flex-col items-center justify-center text-center hover:border-fkBlue hover:bg-blue-50/30 transition-all group cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              key={bulkType}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="bg-blue-50 p-5 rounded-full mb-4 group-hover:scale-110 transition-transform">
               <Upload className="h-10 w-10 text-fkBlue" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Upload {bulkType} CSV</h3>
            <p className="text-gray-500 mt-2">
              Drag and drop or click to upload
            </p>
          </div>
        </div>
      )}
    </div>
  );
};