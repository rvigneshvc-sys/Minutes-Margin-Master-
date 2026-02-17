import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import { Login, PinVerification } from './components/Auth';
import { MakerWorkspace } from './components/MakerWorkspace';
import { CheckerWorkspace } from './components/CheckerWorkspace';
import { DataExplorer } from './components/DataExplorer';
import { UserManual } from './components/UserManual';
import { Tour, TourStep } from './components/Tour';
import { Database, LogOut, Shield, Briefcase, Menu, Zap, Book, PlayCircle } from 'lucide-react';

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Minutes Master",
    content: "This application streamlines commercial operations by separating duties between Makers (Entry) and Checkers (Audit). Let's take a quick tour of the key features.",
    view: 'WORKSPACE',
    role: 'MAKER'
  },
  {
    title: "Maker: Manual Entry",
    content: "Category Managers use this form to create individual records. The system automatically detects conflicts (overlaps) and high margin values (>60%) to trigger approval workflows.",
    targetId: 'tour-maker-manual',
    view: 'WORKSPACE',
    role: 'MAKER'
  },
  {
    title: "Maker: Bulk Upload",
    content: "For high volume updates, Makers can upload CSV files. The system validates headers, detects new cities automatically, and processes records in optimized batches.",
    targetId: 'tour-maker-bulk',
    view: 'WORKSPACE',
    role: 'MAKER',
    tab: 'BULK' // Hint: The user might need to click Bulk, or we explain it conceptually if we don't force tab state.
  },
  {
    title: "Checker: Audit Tool",
    content: "Finance teams use this workspace. The Audit Tool allows comparison of System Data vs Target Margins (Value or %), instantly highlighting variances.",
    targetId: 'tour-checker-audit',
    view: 'WORKSPACE',
    role: 'CHECKER'
  },
  {
    title: "Checker: Approvals",
    content: "Any data entry that flagged a conflict or high margin appears here. Checkers can bulk approve or reject changes. Approved conflicts automatically archive the old record.",
    targetId: 'tour-checker-approvals',
    view: 'WORKSPACE',
    role: 'CHECKER'
  },
  {
    title: "Data Explorer",
    content: "A unified view of the active database. Checkers can edit or delete records directly in this grid view for quick corrections.",
    view: 'EXPLORER',
    role: 'CHECKER'
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'WORKSPACE' | 'EXPLORER' | 'MANUAL'>('WORKSPACE');
  const [showPin, setShowPin] = useState(false);
  const [isCheckerVerified, setIsCheckerVerified] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Check persisted session
  useEffect(() => {
    const savedUser = localStorage.getItem('mm_session_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    
    // Check PIN cache
    const pinCache = localStorage.getItem('mm_pin_verified');
    if (pinCache) {
       const { expiry } = JSON.parse(pinCache);
       if (new Date().getTime() < expiry) setIsCheckerVerified(true);
    }
  }, []);

  // Tour Logic: Automatically switch views/roles based on step
  useEffect(() => {
    if (isTourOpen) {
      const step = TOUR_STEPS[currentStepIndex];
      setView(step.view);
      
      // Temporary override for visual purposes during tour
      // We don't change the actual logged in user state deeply, just enough for rendering
      if (user) {
         if (step.role === 'CHECKER') setIsCheckerVerified(true);
      }
    }
  }, [currentStepIndex, isTourOpen]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('mm_session_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    setIsCheckerVerified(false);
    setIsTourOpen(false);
    localStorage.removeItem('mm_session_user');
    localStorage.removeItem('mm_pin_verified');
  };

  const verifyPin = () => {
    setIsCheckerVerified(true);
    setShowPin(false);
    // 30 Days Expiry
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    localStorage.setItem('mm_pin_verified', JSON.stringify({ expiry: expiry.getTime() }));
  };

  const startTour = () => {
     setIsTourOpen(true);
     setCurrentStepIndex(0);
     setMobileMenuOpen(false);
     // Ensure we have a valid user context for rendering, default to Admin for tour capabilities if needed
     if (!user) {
         const demoUser: User = { id: 'demo', name: 'Demo User', role: Role.ADMIN, employeeId: 'demo' };
         setUser(demoUser);
         setIsCheckerVerified(true);
     }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Guard Clause for Checker Access
  const renderWorkspace = () => {
    // During Tour, we force render based on step role requirement
    const effectiveRole = isTourOpen ? TOUR_STEPS[currentStepIndex].role : user.role;

    if (effectiveRole === Role.MAKER) return <MakerWorkspace user={user} />;
    
    // For Checker/Admin
    if (!isCheckerVerified && !isTourOpen) {
       return (
         <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-6 bg-white rounded-full shadow-lg">
                <Shield className="w-16 h-16 text-fkBlue" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Restricted Access</h2>
            <p className="text-gray-500 max-w-md">Checker workspace contains sensitive auditing tools. Security verification is required.</p>
            <button 
              onClick={() => setShowPin(true)}
              className="bg-fkBlue text-white px-8 py-3 rounded shadow-md hover:bg-blue-600 transition-all font-semibold"
            >
              Verify Identity
            </button>
         </div>
       );
    }
    return <CheckerWorkspace user={user} />;
  };

  return (
    <div className="flex h-screen bg-[#f1f3f6] text-fkText overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 shadow-sm transform transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:flex flex-col print:hidden`}>
        <div className="h-20 flex items-center px-6 border-b border-gray-100">
          {/* Flipkart-ish Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-fkYellow text-white p-1 rounded">
               <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-lg font-bold text-fkBlue italic tracking-tighter">Minutes</span>
                <span className="text-xs text-gray-400 font-medium tracking-wide">Master</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
           <button 
             onClick={() => { setView('WORKSPACE'); setMobileMenuOpen(false); }}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded transition-all ${view === 'WORKSPACE' ? 'bg-fkBlue/10 text-fkBlue font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
           >
             <Briefcase className="w-5 h-5" />
             <span>Workspace</span>
           </button>
           
           <button 
             onClick={() => { setView('EXPLORER'); setMobileMenuOpen(false); }}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded transition-all ${view === 'EXPLORER' ? 'bg-fkBlue/10 text-fkBlue font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
           >
             <Database className="w-5 h-5" />
             <span>Data Explorer</span>
           </button>

           <button 
             onClick={() => { setView('MANUAL'); setMobileMenuOpen(false); }}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded transition-all ${view === 'MANUAL' ? 'bg-fkBlue/10 text-fkBlue font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
           >
             <Book className="w-5 h-5" />
             <span>User Manual</span>
           </button>
           
           <div className="pt-4 mt-4 border-t border-gray-100">
             <button 
                onClick={startTour}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded transition-all bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow hover:shadow-lg hover:scale-[1.02]"
             >
                <PlayCircle className="w-5 h-5" />
                <span className="font-bold">Start Walkthrough</span>
             </button>
           </div>
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${user.role === 'MAKER' ? 'bg-purple-600' : 'bg-fkGreen'}`}>
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 bg-white rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#f1f3f6] print:bg-white print:overflow-visible">
        {/* Mobile Header */}
        <header className="h-16 md:hidden flex items-center justify-between px-4 bg-fkBlue text-white shadow-md print:hidden">
          <span className="font-bold italic">MinutesMaster</span>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 relative print:p-0 print:overflow-visible">
           {view === 'WORKSPACE' && renderWorkspace()}
           {view === 'EXPLORER' && <DataExplorer user={user} />}
           {view === 'MANUAL' && <UserManual />}
        </div>
      </main>

      {showPin && (
        <PinVerification 
          user={user} 
          onSuccess={verifyPin} 
          onCancel={() => setShowPin(false)} 
        />
      )}

      {/* Tour Overlay */}
      {isTourOpen && (
        <Tour 
           step={TOUR_STEPS[currentStepIndex]}
           currentStepIndex={currentStepIndex}
           totalSteps={TOUR_STEPS.length}
           onNext={() => {
             if (currentStepIndex < TOUR_STEPS.length - 1) {
               setCurrentStepIndex(currentStepIndex + 1);
             } else {
               setIsTourOpen(false);
             }
           }}
           onPrev={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
           onClose={() => setIsTourOpen(false)}
        />
      )}
    </div>
  );
};

export default App;