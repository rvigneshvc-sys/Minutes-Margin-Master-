import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import { db } from './services/db';
import { Login, PinVerification } from './components/Auth';
import { MakerWorkspace } from './components/MakerWorkspace';
import { CheckerWorkspace } from './components/CheckerWorkspace';
import { DataExplorer } from './components/DataExplorer';
import { UserManual } from './components/UserManual';
import { Tour, TourStep } from './components/Tour';
import { Shield, Briefcase, Menu, Zap, Book, PlayCircle, Search as SearchIcon, User as UserIcon, ChevronDown, Home, Database, FileText, LogOut } from 'lucide-react';

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
    tab: 'BULK' 
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
    localStorage.removeItem('mm_session_user');
    localStorage.removeItem('mm_pin_verified');
    setView('WORKSPACE');
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
     if (!user) {
         const demoUser: User = { id: 'demo', name: 'Demo User', role: Role.MAKER, employeeId: 'demo' };
         setUser(demoUser);
         setIsCheckerVerified(true);
     }
  };

  const handleSwitchRole = async (targetRole: Role) => {
    if (targetRole === user?.role) return;
    
    let empId = 'maker1';
    if (targetRole === Role.CHECKER) empId = 'checker1';
    
    const newUser = await db.login(empId);
    if (newUser) {
      handleLogin(newUser);
      setView('WORKSPACE');
      // If switching to a restricted role, reset verification to simulate real login flow
      if (targetRole === Role.CHECKER) {
        setIsCheckerVerified(false); 
      }
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Guard Clause for Checker Access
  const renderWorkspace = () => {
    const effectiveRole = isTourOpen ? TOUR_STEPS[currentStepIndex].role : user.role;

    if (effectiveRole === Role.MAKER) return <MakerWorkspace user={user} />;
    
    // For Checker
    if (!isCheckerVerified && !isTourOpen) {
       return (
         <div className="h-full flex flex-col items-center justify-center text-center space-y-6 bg-white rounded shadow p-8 max-w-xl mx-auto mt-10">
            <div className="p-4 bg-blue-50 rounded-full">
                <Shield className="w-12 h-12 text-fkBlue" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-gray-800">Restricted Access</h2>
              <p className="text-gray-500 mt-2 text-sm">Checker workspace contains sensitive auditing tools. Security verification is required.</p>
            </div>
            <button 
              onClick={() => setShowPin(true)}
              className="bg-fkYellow text-white px-10 py-3 rounded-sm shadow hover:shadow-lg transition-all font-medium uppercase text-sm tracking-wide"
            >
              Verify Identity
            </button>
         </div>
       );
    }
    return <CheckerWorkspace user={user} />;
  };

  return (
    <div className="flex flex-col h-screen bg-[#f1f3f6] text-fkText overflow-hidden font-sans">
      
      {/* Flipkart-style Navbar */}
      <header className="bg-fkBlue text-white h-16 flex items-center shadow-md z-50 print:hidden shrink-0">
        <div className="container mx-auto max-w-[1400px] px-4 md:px-6 flex justify-between items-center h-full">
          
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1">
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Logo */}
            <div 
              className="flex flex-col items-end cursor-pointer group select-none"
              onClick={() => setView('WORKSPACE')}
            >
              <div className="flex items-center gap-1">
                 <span className="font-bold text-lg md:text-xl italic tracking-tight">Flipkart</span>
                 <div className="bg-fkYellow text-white p-0.5 rounded-sm">
                    <Zap className="w-3 h-3 md:w-4 md:h-4 fill-current text-white" />
                 </div>
              </div>
              <span className="text-[10px] md:text-xs font-medium text-gray-200 hover:text-white flex items-center gap-0.5 -mt-1 tracking-wide">
                Minutes<span className="text-fkYellow font-bold">Master</span>
              </span>
            </div>
          </div>

          {/* Search Bar (Mock) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
             <input 
               type="text" 
               placeholder="Search for Products, FSNs or Brands" 
               className="w-full py-2 px-4 rounded-sm text-gray-800 text-sm focus:outline-none shadow-sm"
             />
             <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-fkBlue" />
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-6 md:gap-8 text-sm font-medium">
             
             {/* Role Switcher Dropdown */}
             <div className="relative group hidden md:block">
                 <button className="flex items-center gap-1 cursor-pointer bg-white text-fkBlue px-5 py-1 rounded-sm border border-[#dbdbdb] hover:bg-blue-50 transition-colors">
                    <span>{user.role}</span>
                    <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                 </button>
                 
                 <div className="absolute top-full right-0 mt-1 bg-white text-gray-800 w-32 rounded-sm shadow-lg border border-gray-100 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                     {Object.values(Role).map((roleValue) => (
                         <button 
                            key={roleValue}
                            onClick={() => handleSwitchRole(roleValue)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-xs ${user.role === roleValue ? 'font-bold text-fkBlue bg-blue-50' : 'text-gray-600'}`}
                         >
                            {roleValue}
                         </button>
                     ))}
                 </div>
             </div>

             {/* Standalone Tour Button (Moved from Dropdown) */}
             <button 
                onClick={startTour} 
                className="flex items-center gap-2 hover:text-fkYellow transition-colors group" 
                title="Start Tour"
             >
                <PlayCircle className="w-4 h-4 group-hover:fill-fkYellow" />
                <span className="hidden lg:inline group-hover:underline">Tour Guide</span>
             </button>

             {/* User Name (Static, No Dropdown) */}
             <div className="flex items-center gap-2 cursor-default select-none">
                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                    {user.name.charAt(0)}
                </div>
                <span className="hidden md:inline">{user.name}</span>
             </div>

             <button 
                onClick={handleLogout}
                className="flex items-center gap-1 cursor-pointer hover:text-gray-100 transition-colors group"
                title="Logout"
             >
                <LogOut className="w-4 h-4 group-hover:text-red-300" />
                <span className="hidden md:inline group-hover:text-red-100">Logout</span>
             </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden container mx-auto max-w-[1400px]">
        
        {/* Sidebar (Desktop) - Like My Account Sidebar */}
        <aside className={`fixed md:relative z-40 w-64 bg-white md:bg-transparent h-full transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:block shrink-0 md:py-4 print:hidden`}>
           <div className="bg-white md:shadow-card md:rounded-sm h-full md:h-auto overflow-hidden">
              
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                 <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-fkBlue" />
                 </div>
                 <div>
                    <div className="text-xs text-gray-500">Hello,</div>
                    <div className="font-bold text-gray-800">{user.name}</div>
                 </div>
              </div>

              <div className="py-2">
                 
                 {/* Home Button */}
                 <div className="px-4 mb-2">
                    <button 
                      onClick={() => { setView('WORKSPACE'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-4 text-sm font-medium hover:bg-blue-50 hover:text-fkBlue transition-colors rounded-sm flex items-center gap-3 ${view === 'WORKSPACE' ? 'text-fkBlue bg-blue-50 font-bold' : 'text-gray-600'}`}
                    >
                      <Home className="w-4 h-4" />
                      Home
                    </button>
                 </div>

                 <div className="px-4 py-3 border-t border-gray-50">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                       <Briefcase className="w-3 h-3 text-fkBlue" /> Operations
                    </div>
                    {/* Data Explorer */}
                    <button 
                      onClick={() => { setView('EXPLORER'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-4 text-sm font-medium hover:bg-blue-50 hover:text-fkBlue transition-colors rounded-sm flex items-center gap-3 ${view === 'EXPLORER' ? 'text-fkBlue bg-blue-50 font-bold' : 'text-gray-600'}`}
                    >
                      <Database className="w-4 h-4" />
                      Data Explorer
                    </button>
                 </div>

                 <div className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                       <Book className="w-3 h-3 text-fkBlue" /> Resources
                    </div>
                    <button 
                      onClick={() => { setView('MANUAL'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-4 text-sm font-medium hover:bg-blue-50 hover:text-fkBlue transition-colors rounded-sm flex items-center gap-3 ${view === 'MANUAL' ? 'text-fkBlue bg-blue-50 font-bold' : 'text-gray-600'}`}
                    >
                      <FileText className="w-4 h-4" />
                      User Manual
                    </button>
                 </div>
              </div>
           </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {mobileMenuOpen && (
           <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Main Content View */}
        <main className="flex-1 overflow-auto p-4 md:py-4 md:px-6 relative print:p-0 print:overflow-visible no-scrollbar">
           {view === 'WORKSPACE' && renderWorkspace()}
           {view === 'EXPLORER' && <DataExplorer user={user} />}
           {view === 'MANUAL' && <UserManual />}
        </main>

      </div>

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