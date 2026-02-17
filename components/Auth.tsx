import React, { useState } from 'react';
import { db } from '../services/db';
import { User, Role } from '../types';
import { ShieldCheck, Loader2, Briefcase, ArrowRight, Zap } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleRoleLogin = async (role: Role) => {
    let empId = '';
    if (role === Role.MAKER) empId = 'maker1';
    else if (role === Role.CHECKER) empId = 'checker1';
    else if (role === Role.ADMIN) empId = 'admin1';

    setLoading(empId);
    
    try {
      const user = await db.login(empId);
      if (user) {
        onLogin(user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f3f6] p-4 font-sans">
      <div className="bg-white p-8 rounded shadow-lg w-full max-w-lg border border-gray-200">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-fkBlue text-white p-3 rounded-full mb-4 shadow-lg shadow-blue-200">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-3xl font-bold mb-1 text-gray-800">Minutes<span className="text-fkBlue italic">Master</span></h1>
          <p className="text-gray-500">Commercial Operations Portal</p>
        </div>

        <div className="space-y-4">
           {/* Maker Login */}
           <button
             onClick={() => handleRoleLogin(Role.MAKER)}
             disabled={!!loading}
             className="w-full group relative flex items-center p-5 bg-white border border-gray-200 hover:border-fkBlue rounded-lg transition-all duration-300 text-left shadow-sm hover:shadow-md"
           >
             <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center mr-5 border border-purple-100">
               <Briefcase className="w-6 h-6 text-purple-600" />
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-lg text-gray-800 group-hover:text-fkBlue transition-colors">Maker Workspace</h3>
               <p className="text-sm text-gray-500">Data Entry & Bulk Uploads</p>
             </div>
             <div className="text-gray-400 group-hover:text-fkBlue group-hover:translate-x-1 transition-all">
                {loading === 'maker1' ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
             </div>
           </button>

           {/* Checker Login */}
           <button
             onClick={() => handleRoleLogin(Role.CHECKER)}
             disabled={!!loading}
             className="w-full group relative flex items-center p-5 bg-white border border-gray-200 hover:border-fkYellow rounded-lg transition-all duration-300 text-left shadow-sm hover:shadow-md"
           >
             <div className="h-12 w-12 bg-yellow-50 rounded-lg flex items-center justify-center mr-5 border border-yellow-100">
               <ShieldCheck className="w-6 h-6 text-fkYellow" />
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-lg text-gray-800 group-hover:text-fkYellow transition-colors">Checker Workspace</h3>
               <p className="text-sm text-gray-500">Audits & Approvals</p>
             </div>
             <div className="text-gray-400 group-hover:text-fkYellow group-hover:translate-x-1 transition-all">
                {loading === 'checker1' ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
             </div>
           </button>
        </div>
      </div>
    </div>
  );
};

interface PinProps {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinVerification: React.FC<PinProps> = ({ user, onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const isValid = await db.verifyPin(user.id, pin);
    setLoading(false);
    
    if (isValid) {
      onSuccess();
    } else {
      setError('Invalid PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white p-8 rounded shadow-2xl w-full max-w-sm relative animate-in fade-in zoom-in duration-200 border border-gray-200">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
        
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-3">
             <ShieldCheck className="text-fkYellow w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Security Check</h2>
          <p className="text-sm text-gray-500">Enter PIN to access Checker Workspace</p>
        </div>

        <form onSubmit={verify} className="space-y-4">
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center text-3xl tracking-[1em] font-bold bg-gray-50 border border-gray-300 rounded py-3 text-gray-800 focus:border-fkBlue focus:ring-1 focus:ring-fkBlue outline-none transition-all"
            autoFocus
          />
          {error && <p className="text-red-500 text-center text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-fkYellow hover:bg-yellow-500 text-white font-bold py-3 rounded shadow-md transition-colors flex justify-center"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Unlock Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
};