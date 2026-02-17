import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { CommercialRecord, User, Role, COMMERCIAL_TYPES, CommercialType } from '../types';
import { Download, Filter, RefreshCw, Trash2, Edit2, Save, X, Clock, ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface DataExplorerProps {
  user: User;
}

interface PivotRow {
  key: string;
  fsn: string;
  brand: string;
  title: string;
  vertical: string;
  kam: string;
  type: CommercialType;
  startDate: string;
  endDate: string;
  cityRecords: { [key: string]: CommercialRecord | undefined };
  values: { [key: string]: number | undefined };
  isExpiringSoon: boolean;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ user }) => {
  const [records, setRecords] = useState<CommercialRecord[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Edit State
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PivotRow> | null>(null);

  // Selection State
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  
  // Progress State for Actions (Delete/Save)
  const [processingAction, setProcessingAction] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');

  // Permission Check
  const canEdit = user.role !== Role.MAKER;

  useEffect(() => {
    let unsubscribe: () => void;

    const init = async () => {
      setLoading(true);
      try {
        const c = await db.getCities();
        setCities(c);
        unsubscribe = db.subscribeToRecords((data) => {
          setRecords(data);
          setLoading(false);
        });
      } catch (e) {
        console.error("Failed to load data", e);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const pivotData: PivotRow[] = useMemo(() => {
    const map = new Map<string, PivotRow>();
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);

    records.forEach(r => {
      const key = `${r.fsn}_${r.type}_${r.startDate}_${r.endDate}`;
      if (!map.has(key)) {
        const endDate = new Date(r.endDate);
        const isExpiringSoon = endDate >= today && endDate <= sevenDaysLater;

        map.set(key, {
          key,
          fsn: r.fsn,
          brand: r.brand,
          title: r.title,
          vertical: r.vertical || '',
          kam: r.kam || '',
          type: r.type,
          startDate: r.startDate,
          endDate: r.endDate,
          cityRecords: {},
          values: {},
          isExpiringSoon
        });
      }
      const entry = map.get(key)!;
      entry.cityRecords[r.city] = r;
      entry.values[r.city] = r.value;
      
      // Update inherited fields if needed
      if(r.vertical && !entry.vertical) entry.vertical = r.vertical;
      if(r.kam && !entry.kam) entry.kam = r.kam;
    });
    let result = Array.from(map.values());
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.fsn.toLowerCase().includes(lower) || 
        item.brand.toLowerCase().includes(lower) ||
        item.title.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [records, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(pivotData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return pivotData.slice(start, start + itemsPerPage);
  }, [pivotData, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
      // Optional: Clear selection on search? No, keep it.
  }, [searchTerm]);

  const exportCSV = () => {
    const headers = ['FSN', 'Brand', 'Title', 'Vertical', 'KAM', 'Type', 'Start', 'End', ...cities].join(',');
    const rows = pivotData.map(row => {
      const cityVals = cities.map(c => {
          const val = row.values[c];
          const pan = row.values['PAN-INDIA'];
          // Export effective value
          return val !== undefined ? val : (pan !== undefined ? pan : '');
      }).join(',');
      return `${row.fsn},${row.brand},${row.title},${row.vertical},${row.kam},${row.type},${row.startDate},${row.endDate},${cityVals}`;
    }).join('\n');
    
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mm_export_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleEditClick = (row: PivotRow) => {
    setEditingRowKey(row.key);
    setEditForm({ ...row, values: { ...row.values } });
  };

  const handleCancelEdit = () => {
    setEditingRowKey(null);
    setEditForm(null);
  };

  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          // Select all visible in current filter (all filtered rows, not just page)
          const allKeys = new Set(pivotData.map(r => r.key));
          setSelectedRowKeys(allKeys);
      } else {
          setSelectedRowKeys(new Set());
      }
  };

  const handleSelectRow = (key: string) => {
      const newSet = new Set(selectedRowKeys);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      setSelectedRowKeys(newSet);
  };

  const handleBulkDelete = async () => {
    if (!canEdit || selectedRowKeys.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRowKeys.size} selected items?`)) return;
    
    setProcessingAction(true);
    setProcessingStatus('Analyzing selection...');
    setProgress(10);

    try {
      await new Promise(resolve => setTimeout(resolve, 50));

      const selectedSet = selectedRowKeys;
      // Gather all related record IDs from the selected pivot keys
      const idsToDelete = records.filter(r => {
           const key = `${r.fsn}_${r.type}_${r.startDate}_${r.endDate}`;
           return selectedSet.has(key);
      }).map(r => r.id);
      
      if (idsToDelete.length === 0) {
          setProcessingAction(false);
          return;
      }

      setProcessingStatus(`Archiving ${idsToDelete.length} records...`);
      setProgress(30);

      // Simulate progress for visual feedback
      const interval = setInterval(() => {
          setProgress(prev => Math.min(prev + 10, 90));
      }, 150);

      await db.deleteRecords(idsToDelete, user.name);
      
      clearInterval(interval);
      setProgress(100);
      setProcessingStatus('Deletion Complete');
      
      setSelectedRowKeys(new Set()); // Clear selection
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      alert('Error deleting records');
    } finally {
      setProcessingAction(false);
      setProgress(0);
      setProcessingStatus('');
    }
  };

  const handleSaveEdit = async (originalRow: PivotRow) => {
    if (!editForm || !canEdit) return;
    
    if ((editForm.fsn || originalRow.fsn).length !== 16) {
        alert("FSN must be exactly 16 characters.");
        return;
    }

    setProcessingAction(true);
    setProcessingStatus('Validating changes...');
    setProgress(20);

    try {
      const recordsToUpdate = records.filter(r => 
          r.fsn === originalRow.fsn && r.type === originalRow.type && r.startDate === originalRow.startDate && r.endDate === originalRow.endDate
      );

      const updatePromises: Promise<void>[] = [];
      const recordsForBulkUpdate: CommercialRecord[] = [];

      setProcessingStatus('Updating active records...');
      setProgress(40);

      recordsToUpdate.forEach(r => {
        const newCityValue = editForm.values?.[r.city];
        const updatedRecord: CommercialRecord = {
          ...r,
          fsn: editForm.fsn || r.fsn,
          brand: editForm.brand || r.brand,
          title: editForm.title || r.title,
          vertical: editForm.vertical || r.vertical,
          kam: editForm.kam || r.kam,
          type: editForm.type || r.type,
          startDate: editForm.startDate || r.startDate,
          endDate: editForm.endDate || r.endDate,
          value: newCityValue !== undefined ? Number(newCityValue) : r.value,
          lastUpdatedBy: user.name,
          lastUpdatedAt: Date.now()
        };
        recordsForBulkUpdate.push(updatedRecord);
      });

      if (recordsForBulkUpdate.length > 0) updatePromises.push(db.updateRecords(recordsForBulkUpdate));

      setProgress(60);
      setProcessingStatus('Checking for new city overrides...');

      for (const city of cities) {
        const hasExisting = recordsToUpdate.some(r => r.city === city);
        const newVal = editForm.values?.[city];
        // Note: We do NOT inherit PAN-INDIA during save. Saving creates an explicit override.
        if (!hasExisting && newVal !== undefined && Number(newVal) !== 0) {
           updatePromises.push(db.addRecords([{
             id: `rec_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
             fsn: editForm.fsn!,
             brand: editForm.brand!,
             title: editForm.title!,
             vertical: editForm.vertical || '',
             kam: editForm.kam || '',
             type: editForm.type!,
             city: city,
             startDate: editForm.startDate!,
             endDate: editForm.endDate!,
             value: Number(newVal),
             lastUpdatedBy: user.name,
             lastUpdatedAt: Date.now()
           }]));
        }
      }
      
      setProgress(80);
      await Promise.all(updatePromises);
      
      setProgress(100);
      setProcessingStatus('Saved Successfully');
      await new Promise(resolve => setTimeout(resolve, 500));

      setEditingRowKey(null);
      setEditForm(null);
    } catch (e) {
      alert('Failed to save changes');
    } finally {
      setProcessingAction(false);
      setProgress(0);
      setProcessingStatus('');
    }
  };

  const refreshCities = async () => {
    setLoading(true);
    const c = await db.getCities();
    setCities(c);
    setLoading(false);
  };

  const isAllSelected = pivotData.length > 0 && selectedRowKeys.size === pivotData.length;
  const isIndeterminate = selectedRowKeys.size > 0 && selectedRowKeys.size < pivotData.length;

  return (
    <div className="space-y-4 h-full flex flex-col animate-in fade-in duration-500 relative">
      
      {/* Action Progress Overlay */}
      {processingAction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 text-lg">System Update</h3>
                      <Loader2 className="w-5 h-5 text-fkBlue animate-spin" />
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                      <div 
                        className="bg-fkBlue h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
                        style={{ width: `${progress}%` }}
                      >
                          {progress > 10 && <span className="text-[9px] text-white font-bold">{progress}%</span>}
                      </div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>{processingStatus || 'Processing...'}</span>
                      <span>{progress}%</span>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Database Explorer</h2>
           <p className="text-sm text-gray-500">Search and edit active commercial records</p>
        </div>
        <div className="flex gap-2 items-center">
           {selectedRowKeys.size > 0 && canEdit && (
               <button 
                 onClick={handleBulkDelete}
                 className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded shadow-sm text-sm font-bold transition-all animate-in zoom-in"
               >
                 <Trash2 className="h-4 w-4" /> Delete ({selectedRowKeys.size})
               </button>
           )}
           
           <div className="relative">
             <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"/>
             <input 
               className="bg-white border border-gray-300 rounded shadow-sm py-2 pl-9 pr-4 text-sm text-gray-800 focus:ring-1 focus:ring-fkBlue focus:border-fkBlue outline-none w-64 transition-shadow"
               placeholder="Filter by FSN, Brand..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <button onClick={refreshCities} className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600 shadow-sm">
             <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
           <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-fkGreen hover:bg-green-700 text-white rounded shadow-sm text-sm font-bold transition-colors">
             <Download className="h-4 w-4" /> Export CSV
           </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
        <div className="overflow-auto scrollbar-hide flex-1">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="bg-gray-50 sticky top-0 z-10 text-xs uppercase text-gray-500 font-semibold shadow-sm">
              <tr>
                {canEdit && (
                    <th className="p-4 border-b border-gray-200 bg-gray-50 w-10 text-center">
                        <input 
                            type="checkbox"
                            checked={isAllSelected}
                            ref={input => { if(input) input.indeterminate = isIndeterminate; }}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-fkBlue focus:ring-fkBlue cursor-pointer"
                        />
                    </th>
                )}
                <th className="p-4 border-b border-gray-200 min-w-[120px] bg-gray-50">FSN</th>
                <th className="p-4 border-b border-gray-200 bg-gray-50">Brand</th>
                <th className="p-4 border-b border-gray-200 bg-gray-50">Title</th>
                <th className="p-4 border-b border-gray-200 bg-gray-50">Vertical</th>
                <th className="p-4 border-b border-gray-200 bg-gray-50">KAM</th>
                <th className="p-4 border-b border-gray-200 bg-gray-50 min-w-[120px]">Type</th>
                <th className="p-4 border-b border-gray-200 text-center min-w-[200px] bg-gray-50">Dates</th>
                {cities.map(c => (
                  <th key={c} className="p-4 border-b border-gray-200 text-center min-w-[80px] bg-gray-50">{c}</th>
                ))}
                {canEdit && <th className="p-4 border-b border-gray-200 text-center sticky right-0 bg-gray-50 z-20 w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {paginatedData.map((row) => {
                const isEditing = editingRowKey === row.key;
                const isSelected = selectedRowKeys.has(row.key);

                return (
                  <tr key={row.key} className={`transition-colors group ${isEditing ? 'bg-blue-50' : isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                    {canEdit && (
                        <td className="p-4 text-center">
                            <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectRow(row.key)}
                                className="w-4 h-4 rounded border-gray-300 text-fkBlue focus:ring-fkBlue cursor-pointer"
                            />
                        </td>
                    )}
                    <td className="p-4 font-mono text-fkBlue font-semibold">
                        {isEditing ? (
                            <input className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs font-mono"
                              value={editForm?.fsn || ''} onChange={e => setEditForm(prev => ({ ...prev!, fsn: e.target.value }))} 
                              maxLength={16}
                              />
                        ) : (
                          <div className="flex items-center gap-2">
                             {row.fsn}
                             {row.isExpiringSoon && (
                               <span title="Expiring within 7 days">
                                 <Clock className="w-3 h-3 text-fkYellow animate-pulse" />
                               </span>
                             )}
                          </div>
                        )}
                    </td>
                    <td className="p-4 text-gray-700 max-w-[150px] truncate">
                        {isEditing ? (
                            <input className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs"
                              value={editForm?.brand || ''} onChange={e => setEditForm(prev => ({ ...prev!, brand: e.target.value }))} />
                        ) : row.brand}
                    </td>
                    <td className="p-4 text-gray-700 max-w-[200px] truncate" title={row.title}>
                        {isEditing ? (
                            <input className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs"
                              value={editForm?.title || ''} onChange={e => setEditForm(prev => ({ ...prev!, title: e.target.value }))} />
                        ) : row.title}
                    </td>
                    <td className="p-4 text-gray-700 max-w-[150px] truncate">
                        {isEditing ? (
                            <input className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs"
                              value={editForm?.vertical || ''} onChange={e => setEditForm(prev => ({ ...prev!, vertical: e.target.value }))} />
                        ) : row.vertical}
                    </td>
                    <td className="p-4 text-gray-700 max-w-[150px] truncate">
                        {isEditing ? (
                            <input className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs"
                              value={editForm?.kam || ''} onChange={e => setEditForm(prev => ({ ...prev!, kam: e.target.value }))} />
                        ) : row.kam}
                    </td>
                    <td className="p-4">
                      {isEditing ? (
                          <select className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs"
                             value={editForm?.type} onChange={e => setEditForm(prev => ({ ...prev!, type: e.target.value as CommercialType }))}>
                            {COMMERCIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      ) : (
                          <span className={`px-2 py-1 rounded text-[10px] border whitespace-nowrap font-medium ${
                            row.type.includes('Margin') ? 'border-purple-200 text-purple-700 bg-purple-50' : 
                            'border-blue-200 text-blue-700 bg-blue-50'
                          }`}>
                            {row.type}
                          </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-xs text-center">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                           <input type="date" className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs w-full"
                             value={editForm?.startDate || row.startDate} onChange={e => setEditForm(prev => ({ ...prev!, startDate: e.target.value }))} />
                           <input type="date" className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-xs w-full"
                             value={editForm?.endDate || row.endDate} onChange={e => setEditForm(prev => ({ ...prev!, endDate: e.target.value }))} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                           <span className="font-mono">{row.startDate}</span>
                           <span className="text-[10px] text-gray-400">to</span>
                           <span className={`font-mono ${row.isExpiringSoon ? 'text-fkYellow font-bold' : ''}`}>{row.endDate}</span>
                        </div>
                      )}
                    </td>
                    {cities.map(c => {
                      const specificVal = row.values[c];
                      const panVal = row.values['PAN-INDIA'];
                      const effectiveVal = specificVal !== undefined ? specificVal : (c !== 'PAN-INDIA' ? panVal : undefined);
                      const isInherited = specificVal === undefined && effectiveVal !== undefined;

                      return (
                        <td key={c} className={`p-2 text-center border-l border-gray-100 ${isEditing ? 'p-1' : ''}`}>
                           {isEditing ? (
                             <input type="number" className="w-16 bg-white border border-gray-300 rounded px-1 py-1 text-center text-gray-800 text-sm focus:border-fkBlue outline-none"
                               value={editForm?.values?.[c] ?? ''} placeholder={isInherited ? String(effectiveVal) : '-'}
                               onChange={e => {
                                 const val = e.target.value;
                                 setEditForm(prev => ({ ...prev!, values: { ...prev!.values, [c]: val === '' ? undefined : parseFloat(val) } }));
                               }} />
                           ) : (
                               effectiveVal !== undefined ? (
                                   <span className={isInherited ? "text-gray-400 italic" : "text-gray-800 font-bold"}>
                                     {effectiveVal}
                                     {isInherited && <span className="ml-1 text-[8px] border border-gray-200 rounded px-0.5 text-gray-400 not-italic">PAN</span>}
                                   </span>
                               ) : <span className="text-gray-300">-</span>
                           )}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="p-4 border-l border-gray-200 sticky right-0 bg-white group-hover:bg-blue-50/50 transition-colors z-10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(row)} className="p-1.5 bg-green-600 hover:bg-green-700 rounded text-white shadow-sm" title="Save">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={handleCancelEdit} className="p-1.5 bg-gray-500 hover:bg-gray-600 rounded text-white" title="Cancel">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEditClick(row)} className="p-1.5 hover:bg-blue-100 text-gray-400 hover:text-fkBlue rounded transition-colors" title="Edit Row">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {pivotData.length === 0 && !loading && (
                 <tr><td colSpan={cities.length + 7} className="p-8 text-center text-gray-500">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Bar */}
        <div className="bg-gray-50 p-3 flex justify-between items-center border-t border-gray-200 text-xs">
          <div className="text-gray-500">
             Showing {Math.min(itemsPerPage, pivotData.length)} of {pivotData.length} records.
             {selectedRowKeys.size > 0 && <span className="ml-2 font-bold text-fkBlue">{selectedRowKeys.size} selected.</span>}
          </div>
          <div className="flex items-center gap-2">
             <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
             >
                <ChevronLeft className="w-4 h-4" />
             </button>
             <span className="font-bold text-gray-700">Page {currentPage} of {Math.max(1, totalPages)}</span>
             <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
             >
                <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};