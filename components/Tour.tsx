import React from 'react';
import { X, ChevronRight, ChevronLeft, Zap } from 'lucide-react';

export interface TourStep {
  title: string;
  content: string;
  targetId?: string; // ID of the element to highlight
  view: 'WORKSPACE' | 'EXPLORER' | 'MANUAL';
  role: 'MAKER' | 'CHECKER' | 'ADMIN';
  tab?: string; // Optional internal tab state to mention
}

interface TourProps {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const Tour: React.FC<TourProps> = ({ step, currentStepIndex, totalSteps, onNext, onPrev, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto transition-opacity" onClick={onClose} />

      {/* Spotlight Effect (Visual only, simple highlight box) */}
      {step.targetId && (() => {
         const el = document.getElementById(step.targetId);
         if (!el) return null;
         const rect = el.getBoundingClientRect();
         return (
           <div 
             className="absolute border-4 border-fkYellow rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out pointer-events-none z-[90]"
             style={{
               top: rect.top - 8,
               left: rect.left - 8,
               width: rect.width + 16,
               height: rect.height + 16,
             }}
           />
         );
      })()}

      {/* Card */}
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl pointer-events-auto relative z-[101] flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300 border-t-4 border-fkBlue">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
             <div className="bg-blue-50 text-fkBlue p-2 rounded-lg">
                <Zap className="w-5 h-5 fill-current" />
             </div>
             <h3 className="text-xl font-bold text-gray-800">{step.title}</h3>
          </div>
          
          <p className="text-gray-600 text-sm leading-relaxed mb-6 min-h-[60px]">
            {step.content}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-400">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            
            <div className="flex gap-2">
              <button 
                onClick={onPrev}
                disabled={currentStepIndex === 0}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={onNext}
                className="flex items-center gap-2 px-5 py-2 bg-fkBlue hover:bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md transition-colors"
              >
                {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
                {currentStepIndex !== totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
