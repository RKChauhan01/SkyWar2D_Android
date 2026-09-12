import React from 'react';
import { Lock, X } from 'lucide-react';

interface TermsConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsConditionsModal: React.FC<TermsConditionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      {/* Futuristic Cyber Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
      
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="font-display text-lg font-black text-white tracking-widest uppercase">
                SKY WAR 2D // TERMS & CONDITIONS
              </h3>
              <span className="font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-widest block">
                Player Flight License Agreement // Ver 1.4
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/10"
            id="btn-close-terms"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Terms Body */}
        <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-500/20 text-left space-y-5 font-sans text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div>
            <span className="font-mono text-[10px] text-cyan-400 font-bold block mb-1">LAST REVISED: JULY 27, 2026</span>
            <p>
              Welcome pilot! This document represents a legally binding Terms of Service agreement between you ("Pilot" or "User") and <strong>Parivartya Corporation</strong>. By launching the Sky War 2D software, you signify your compliance with these terms.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              1. Limited Pilot License
            </h4>
            <p>
              Parivartya Corporation grants you a non-transferable, non-exclusive, revocable, and limited pilot license to access and play the Sky War 2D application solely for your personal entertainment. Any attempt to modify, decompile, resell, or distribute the application's binary package is strictly prohibited.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              2. Player Code of Conduct
            </h4>
            <p>
              Sky War 2D hosts a shared global leaderboard tracking high score telemetry across sectors. As a pilot, you agree:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Not to manipulate game state memory, inject false packets, or employ cheat clients to forge scores.</li>
              <li>Not to register offensive, profane, or derogatory pilot names on the transmission boards.</li>
              <li>Not to interfere with or damage the cloud servers managing the global scoreboards.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              3. Rewarded Advertising Mechanics
            </h4>
            <p>
              The game permits pilots to watch AdMob tactical broadcasts in exchange for system revives and bonus credits. These ads are served "as is" by Google. Players understand that carrier data charges may apply, and we are not liable for external content delivered during the video feed streams.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              4. Intellectual Property
            </h4>
            <p>
              All audio tracks, voice acting cues, MK-IV space interceptor model sprites, UI layout configurations, particle visual effects, and source scripts are the sole intellectual property of <strong>Parivartya Corporation</strong>. No trademark, design copyright, or trade dress may be duplicated without prior written authorization.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              5. No Warranties & Limitation of Liability
            </h4>
            <p>
              This space shooter simulation is provided on an "as is" and "as available" basis. Parivartya Corporation makes no warranties, either express or implied, regarding application stability or continuous leaderboard operation. Under no circumstances will the developers be held liable for any data loss, device overheating, or auxiliary hardware damages resulting from gameplay.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              6. Contact Info
            </h4>
            <p>
              Support requests, legal inquiries, or compliance notices can be directed to:
            </p>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-cyan-500/10 font-mono text-xs text-cyan-300">
              <div>EMAIL: parivartyacorporation@gmail.com</div>
              <div className="mt-1">WEBSITE: https://parivartya.in</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-white/10 pt-4 mt-6 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="cursor-pointer font-mono font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all transform active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            id="btn-close-terms-footer"
          >
            Accept Galactic Mandate
          </button>
        </div>
      </div>
    </div>
  );
};
