import React from 'react';
import { Shield, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      {/* Futuristic Cyber Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
      
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="font-display text-lg font-black text-white tracking-widest uppercase">
                SKY WAR 2D // PRIVACY POLICY
              </h3>
              <span className="font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-widest block">
                Google Play Compliant Document // Ver 1.4
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/10"
            id="btn-close-privacy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Policy Body */}
        <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-500/20 text-left space-y-5 font-sans text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div>
            <span className="font-mono text-[10px] text-cyan-400 font-bold block mb-1">EFFECTIVE DATE: JULY 27, 2026</span>
            <p>
              At <strong>Parivartya Corporation</strong>, we are committed to safeguarding your privacy. This Privacy Policy details how <strong>Sky War 2D</strong> collects, uses, and protects your information when you pilot our starships and access the game interface.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              1. Information We Collect
            </h4>
            <p>
              Sky War 2D is designed to offer an immersive, high-action arcade experience. To protect player safety, we collect minimal data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-300">Global Leaderboard Scores:</strong> If you voluntarily decide to publish your high scores, we record your custom Pilot name, score points, and optional pilot social URL link in our secure Google Cloud Firestore databases.
              </li>
              <li>
                <strong className="text-slate-300">Device Offline Cache:</strong> The MK-IV flight computer stores your single-player high scores locally on your browser or device storage (using standard <code>localStorage</code>) to enable persistent records while offline.
              </li>
              <li>
                <strong className="text-slate-300">Network Connection Diagnostics:</strong> The game reads your standard system online/offline parameters locally to disable advertising and disable cloud leaderboards when a network signal is unavailable.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              2. Third-Party Integrations & Advertising
            </h4>
            <p>
              To deliver free voluntary revives and in-game credit updates, Sky War 2D integrates the <strong>Google AdMob SDK</strong>.
            </p>
            <p className="text-slate-400">
              Google AdMob may collect and process anonymous technical identifiers (including Google Advertising ID, IDFA, and IP address) and device performance statistics. This is utilized solely to deliver and customize rewarded ads. We encourage you to consult the official <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google Privacy & Terms</a> for details regarding AdMob data practices.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              3. COPPA compliance (Children's Privacy)
            </h4>
            <p>
              Sky War 2D fully complies with the Children’s Online Privacy Protection Act (COPPA). We do not knowingly collect personal identifiers from children under 13 years of age. Custom pilot names registered on our leaderboard must not match real-world identifiers. If a parent or guardian discovers that data has been transmitted erroneously, please contact us immediately for deletion.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              4. Your Data Security & Deletion Rights
            </h4>
            <p>
              All leaderboard transmissions use secure encryption. Under standard GDPR and CCPA protocols, you have the absolute right to view, modify, or erase your high-score transmissions at any point. You can clear local high score caches directly through your standard browser/application settings.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-2">
              5. Contact & Support
            </h4>
            <p>
              If you have any questions or concern regarding data practices, reach our support desk at Parivartya Corporation via:
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
            id="btn-close-privacy-footer"
          >
            Acknowledge Protocol
          </button>
        </div>
      </div>
    </div>
  );
};
