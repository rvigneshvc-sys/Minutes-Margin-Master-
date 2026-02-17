import React from 'react';
import { Book, Printer, FileText, Shield, Zap, AlertTriangle, Check, Search, Layers, Database } from 'lucide-react';

export const UserManual: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-lg p-8 md:p-12 print:shadow-none print:p-0">
      {/* Header / Actions */}
      <div className="flex justify-between items-center mb-8 border-b pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Book className="w-6 h-6 text-fkBlue" /> User Manual
          </h1>
          <p className="text-gray-500 text-sm mt-1">Version 1.0 • Updated Oct 2023</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-fkBlue text-white rounded hover:bg-blue-600 transition-colors shadow-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Document Content */}
      <div className="prose prose-blue max-w-none text-gray-800 space-y-8 print:space-y-4">
        
        {/* Title Page Section for Print */}
        <div className="text-center border-b-2 border-gray-100 pb-8 mb-8">
           <div className="flex justify-center mb-4">
              <div className="bg-fkYellow text-white p-3 rounded-lg inline-block">
                <Zap className="w-8 h-8 fill-current" />
              </div>
           </div>
           <h1 className="text-4xl font-bold text-gray-900 mb-2">Minutes Master</h1>
           <p className="text-xl text-gray-500 italic">Enterprise Commercial Operations Guide</p>
        </div>

        {/* 1. Introduction */}
        <section>
          <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
            Introduction
          </h2>
          <p>
            <strong>Minutes Master</strong> is an enterprise-grade application designed to manage commercial data (Margins, NLC, On/Off Invoice) with strict governance. It separates duties between:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Makers:</strong> Who input or upload data (Category Managers).</li>
            <li><strong>Checkers:</strong> Who audit data, approve conflicts, and manage month-end closures (Finance/Audit).</li>
          </ul>
        </section>

        {/* 2. Getting Started */}
        <section>
          <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
             Getting Started
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-bold flex items-center gap-2 text-purple-700 mb-2">
                   <Layers className="w-4 h-4"/> Maker Workspace
                </h3>
                <p className="text-sm">For Category Managers.</p>
                <p className="text-xs text-gray-500 mt-1">No PIN required. Used for data entry and uploads.</p>
             </div>
             <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-bold flex items-center gap-2 text-fkYellow mb-2">
                   <Shield className="w-4 h-4"/> Checker Workspace
                </h3>
                <p className="text-sm">For Finance/Audit.</p>
                <p className="text-xs text-gray-500 mt-1">Requires PIN (Default: <strong>1234</strong>).</p>
             </div>
          </div>
        </section>

        {/* 3. Maker Workspace */}
        <section>
          <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
             Maker Workspace
          </h2>
          
          <h3 className="font-bold text-lg mt-4 mb-2">A. Manual Entry</h3>
          <p>Use for individual record creation. Triggers for approval include:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm bg-yellow-50 p-3 rounded border border-yellow-100 text-yellow-800">
             <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> <strong>Conflict:</strong> Overlap with existing date range.</li>
             <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> <strong>High Margin:</strong> Value &gt; 60%.</li>
          </ul>

          <h3 className="font-bold text-lg mt-4 mb-2">B. Bulk Upload</h3>
          <p>Drag and drop CSV files. Required columns: <code>FSN</code>, <code>KAM</code>, <code>StartDate</code>, <code>EndDate</code>.</p>
          <p className="mt-2 text-sm">The following rules also apply to Bulk Uploads:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm bg-yellow-50 p-3 rounded border border-yellow-100 text-yellow-800 mt-2">
             <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> <strong>Conflict:</strong> Overlap with existing date range.</li>
             <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> <strong>High Margin:</strong> Value &gt; 60%.</li>
          </ul>
          <div className="text-sm text-gray-500 italic mt-2">
             * Note: Invalid FSNs (not 16 chars) are automatically skipped. Records triggering approval are sent to Checker's queue.
          </div>
        </section>

        {/* 4. Checker Workspace */}
        <section>
          <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
             Checker Workspace
          </h2>
          
          <div className="space-y-4">
             <div>
                <h3 className="font-bold text-lg">Audit Tool</h3>
                <p>Compares system data against targets.</p>
                <ul className="list-disc pl-5 text-sm mt-1">
                   <li><strong>Percent Unit:</strong> Sums <code>Margin %</code> + <code>On Invoice %</code>.</li>
                   <li><strong>Value Unit:</strong> Checks <code>NLC Value</code> only.</li>
                </ul>
             </div>

             <div>
                <h3 className="font-bold text-lg">Approvals</h3>
                <p>Inbox for conflicts.</p>
                <ul className="list-disc pl-5 text-sm mt-1">
                   <li><strong>Approve:</strong> Overwrites old data (moves old data to Bin).</li>
                   <li><strong>Reject:</strong> Discards new request.</li>
                </ul>
             </div>

             <div>
                <h3 className="font-bold text-lg">Month End</h3>
                <p><strong>System Reset:</strong> Wipes active database and archives everything to the Bin. <strong>Export:</strong> Download CSVs before resetting.</p>
             </div>
          </div>
        </section>

        {/* 5. Data Explorer */}
        <section>
           <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">5</span>
             Data Explorer
           </h2>
           <p className="flex items-start gap-2">
              <Database className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0"/>
              <span>
                 A spreadsheet-like view of the database. Checkers can <strong>Edit</strong> or <strong>Delete</strong> records directly here using the pencil/trash icons. Makers have read-only access.
              </span>
           </p>
        </section>

        {/* 6. Commercial Logic */}
        <section className="break-inside-avoid">
           <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">6</span>
             Commercial Logic
           </h2>
           <table className="w-full text-sm border-collapse border border-gray-200">
              <thead className="bg-gray-100">
                 <tr>
                    <th className="border p-2 text-left">Scenario</th>
                    <th className="border p-2 text-left">Rule</th>
                 </tr>
              </thead>
              <tbody>
                 <tr>
                    <td className="border p-2 font-medium">Margin / NLC Overlap</td>
                    <td className="border p-2 text-red-600">Strictly Prohibited. New record requires approval to replace old.</td>
                 </tr>
                 <tr>
                    <td className="border p-2 font-medium">Invoice Discount Stacking</td>
                    <td className="border p-2 text-green-600">Allowed. Multiple discounts can run simultaneously unless exact duplicate.</td>
                 </tr>
                 <tr>
                    <td className="border p-2 font-medium">City Hierarchy</td>
                    <td className="border p-2">Specific City (e.g. BLR) &gt; PAN-INDIA.</td>
                 </tr>
              </tbody>
           </table>
        </section>

        {/* 7. Troubleshooting */}
        <section className="break-inside-avoid">
           <h2 className="text-2xl font-bold text-fkBlue mb-3 flex items-center gap-2">
             <span className="bg-blue-100 text-fkBlue w-8 h-8 rounded-full flex items-center justify-center text-sm">7</span>
             Troubleshooting
           </h2>
           <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                 <strong className="min-w-[150px]">FSN Error:</strong>
                 <span>Must be exactly 16 alphanumeric characters.</span>
              </div>
              <div className="flex gap-2">
                 <strong className="min-w-[150px]">Upload Failed:</strong>
                 <span>Check if <code>KAM</code> column exists in CSV.</span>
              </div>
              <div className="flex gap-2">
                 <strong className="min-w-[150px]">Cannot Edit:</strong>
                 <span>Ensure you are logged in as Checker/Admin.</span>
              </div>
           </div>
        </section>

      </div>
      
      <div className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400 print:mt-4 print:pt-4">
         &copy; {new Date().getFullYear()} Minutes Master Commercial Ops. Confidential Internal Document.
      </div>
    </div>
  );
};
