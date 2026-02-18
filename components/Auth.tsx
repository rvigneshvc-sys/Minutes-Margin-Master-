import React, { useState } from 'react';
import { db } from '../services/db';
import { User, Role } from '../types';
import { ShieldCheck, Loader2, Zap } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleRoleLogin = async (role: Role) => {
    let empId = '';
    if (role === Role.MAKER) empId = 'maker1';
    else if (role === Role.CHECKER) empId = 'checker1';

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
      <div className="bg-white rounded-sm shadow-md w-full max-w-4xl flex overflow-hidden min-h-[500px]">
        {/* Left Panel - Blue Branding */}
        <div className="hidden md:flex w-2/5 bg-fkBlue p-10 flex-col justify-between text-white relative overflow-hidden">
          <div className="z-10">
            <h2 className="text-3xl font-medium mb-4">Login</h2>
            <p className="text-lg text-blue-100 font-light leading-relaxed">
              Get access to Commercial Operations, Audits and Approval Workflows
            </p>
          </div>
          
          <div className="z-10 mt-auto mb-10">
             <div className="flex items-center gap-2 mb-2">
                <div className="bg-white/20 p-2 rounded">
                   <Zap className="w-8 h-8 text-fkYellow fill-current" />
                </div>
                <span className="text-2xl font-bold italic tracking-tighter">Minutes Master</span>
             </div>
          </div>

          {/* Decorative Circle */}
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500 rounded-full opacity-50 blur-3xl"></div>
          <div className="absolute top-20 -right-20 w-40 h-40 bg-blue-400 rounded-full opacity-30 blur-2xl"></div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 p-10 flex flex-col justify-center">
          
          <div className="md:hidden text-center mb-8">
             <h1 className="text-2xl font-bold text-fkBlue italic">Minutes Master</h1>
             <p className="text-gray-500 text-sm">Commercial Operations Portal</p>
          </div>

          <div className="space-y-6 max-w-md mx-auto w-full">
             
             {/* Maker Login */}
             <div className="relative group">
                <button
                  onClick={() => handleRoleLogin(Role.MAKER)}
                  disabled={!!loading}
                  className="w-full bg-fkYellow text-white font-medium py-3 rounded-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3"
                >
                  {loading === 'maker1' ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                  <span>Login as Maker (Category Manager)</span>
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Access for data entry and bulk uploads</p>
             </div>

             <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">OR</span>
                <div className="flex-grow border-t border-gray-200"></div>
             </div>

             {/* Checker Login */}
             <div className="relative group">
                <button
                  onClick={() => handleRoleLogin(Role.CHECKER)}
                  disabled={!!loading}
                  className="w-full bg-white border border-gray-200 text-fkBlue font-medium py-3 rounded-sm shadow-sm hover:shadow hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                >
                  {loading === 'checker1' ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                  <span>Login as Checker (Finance/Audit)</span>
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Requires PIN verification for audit access</p>
             </div>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-sm shadow-lg w-full max-w-sm relative animate-in fade-in zoom-in duration-200">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        
        <div className="text-center mb-8 mt-2">
          <h2 className="text-lg font-medium text-gray-800">Verify Identity</h2>
          <p className="text-xs text-gray-500 mt-1">Enter PIN to access Checker Workspace</p>
        </div>

        <form onSubmit={verify} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-2xl tracking-[0.5em] font-medium border-b-2 border-gray-300 py-2 text-gray-800 focus:border-fkBlue outline-none transition-colors"
              autoFocus
              placeholder="••••"
            />
            <label className="absolute -top-3 left-0 w-full text-center text-[10px] text-gray-400 uppercase tracking-widest">Security PIN</label>
          </div>
          
          {error && <p className="text-red-500 text-center text-xs font-medium">{error}</p>}
          
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-fkBlue hover:bg-blue-600 text-white font-medium py-3 rounded-sm shadow-sm transition-colors flex justify-center uppercase text-sm tracking-wide"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
};