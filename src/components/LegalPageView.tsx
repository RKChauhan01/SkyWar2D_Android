import React from 'react';
import { Shield, Lock, ArrowLeft, Globe, Mail } from 'lucide-react';

interface LegalPageViewProps {
  type: 'privacy' | 'terms';
  onBackToGame: () => void;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({ type, onBackToGame }) => {
  return (
    <div className="relative min-h-screen w-full bg-[#020617] text-slate-100 flex flex-col items-center p-4 sm:p-8 select-text overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Space Shooter Galaxy Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none z-0" />
      
      {/* Cyberpunk Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%),linear-gradient(90deg,rgba(6,182,212,0.03),rgba(0,0,0,0),rgba(59,130,246,0.03))] bg-[size:100%_4px,12px_100%] pointer-events-none z-0" />

      {/* Decorative stars / nebulas */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl flex flex-col flex-grow">
        
        {/* Navigation / Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8 mt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToGame}
              className="group flex items-center justify-center h-10 w-10 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              title="Return to Flight Deck"
              id="btn-legal-back"
            >
              <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                {type === 'privacy' ? (
                  <Shield className="h-5 w-5 text-cyan-400 animate-pulse" />
                ) : (
                  <Lock className="h-5 w-5 text-cyan-400 animate-pulse" />
                )}
                <h1 className="font-display text-xl sm:text-2xl font-black text-white tracking-widest uppercase">
                  {type === 'privacy' ? 'PRIVACY POLICY' : 'TERMS & CONDITIONS'}
                </h1>
              </div>
              <p className="font-mono text-[10px] text-cyan-400/80 font-bold uppercase tracking-widest mt-0.5">
                SKY WAR 2D // OFFICIAL PILOT ARCHIVE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
            <span className="font-mono text-[9px] font-extrabold text-slate-400 tracking-wider uppercase bg-white/5 px-3 py-1 rounded-full border border-white/10">
              SECURE TRANSCEIVER ACTIVE
            </span>
          </div>
        </header>

        {/* Document Content Box */}
        <main className="flex-grow bg-slate-900/60 border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md mb-8">
          {type === 'privacy' ? (
            <div className="space-y-6 font-sans text-sm sm:text-base text-slate-300 leading-relaxed text-left">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold block mb-1">EFFECTIVE DATE: JULY 27, 2026</span>
                <p>
                  At <strong>Parivartya Corporation</strong>, we are committed to safeguarding your privacy. This Privacy Policy details how <strong>Sky War 2D</strong> collects, uses, and protects your information when you pilot our starships and access the game interface.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  1. Information We Collect
                </h2>
                <p>
                  Sky War 2D is designed to offer an immersive, high-action arcade experience. To protect player safety, we collect minimal data:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Global Leaderboard Scores:</strong> If you voluntarily decide to publish your high scores, we record your custom Pilot name, score points, and optional pilot social URL link in our secure Google Cloud Firestore databases.
                  </li>
                  <li>
                    <strong className="text-slate-200">Device Offline Cache:</strong> The MK-IV flight computer stores your single-player high scores locally on your browser or device storage (using standard <code>localStorage</code>) to enable persistent records while offline.
                  </li>
                  <li>
                    <strong className="text-slate-200">Network Connection Diagnostics:</strong> The game reads your standard system online/offline parameters locally to disable advertising and disable cloud leaderboards when a network signal is unavailable.
                  </li>
                </ul>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  2. Third-Party Integrations & Advertising
                </h2>
                <p>
                  To deliver free voluntary revives and in-game credit updates, Sky War 2D integrates the <strong>Google AdMob SDK</strong>.
                </p>
                <p className="text-slate-400">
                  Google AdMob may collect and process anonymous technical identifiers (including Google Advertising ID, IDFA, and IP address) and device performance statistics. This is utilized solely to deliver and customize rewarded ads. We encourage you to consult the official <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google Privacy & Terms</a> for details regarding AdMob data practices.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  3. COPPA compliance (Children's Privacy)
                </h2>
                <p>
                  Sky War 2D fully complies with the Children’s Online Privacy Protection Act (COPPA). We do not knowingly collect personal identifiers from children under 13 years of age. Custom pilot names registered on our leaderboard must not match real-world identifiers. If a parent or guardian discovers that data has been transmitted erroneously, please contact us immediately for deletion.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  4. Your Data Security & Deletion Rights
                </h2>
                <p>
                  All leaderboard transmissions use secure encryption. Under standard GDPR and CCPA protocols, you have the absolute right to view, modify, or erase your high-score transmissions at any point. You can clear local high score caches directly through your standard browser/application settings.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  5. Contact & Support
                </h2>
                <p>
                  If you have any questions or concern regarding data practices, reach our support desk at Parivartya Corporation via:
                </p>
                <div className="mt-4 bg-slate-950/60 p-4 rounded-2xl border border-cyan-500/10 font-mono text-xs sm:text-sm text-cyan-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-400" />
                    <span>EMAIL: parivartyacorporation@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <span>WEBSITE: <a href="https://parivartya.in" target="_blank" rel="noopener noreferrer" className="hover:underline">https://parivartya.in</a></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 font-sans text-sm sm:text-base text-slate-300 leading-relaxed text-left">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold block mb-1">LAST REVISED: JULY 27, 2026</span>
                <p>
                  Welcome pilot! This document represents a legally binding Terms of Service agreement between you ("Pilot" or "User") and <strong>Parivartya Corporation</strong>. By launching the Sky War 2D software, you signify your compliance with these terms.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  1. Limited Pilot License
                </h2>
                <p>
                  Parivartya Corporation grants you a non-transferable, non-exclusive, revocable, and limited pilot license to access and play the Sky War 2D application solely for your personal entertainment. Any attempt to modify, decompile, resell, or distribute the application's binary package is strictly prohibited.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  2. Player Code of Conduct
                </h2>
                <p>
                  Sky War 2D hosts a shared global leaderboard tracking high score telemetry across sectors. As a pilot, you agree:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-400">
                  <li>Not to manipulate game state memory, inject false packets, or employ cheat clients to forge scores.</li>
                  <li>Not to register offensive, profane, or derogatory pilot names on the transmission boards.</li>
                  <li>Not to interfere with or damage the cloud servers managing the global scoreboards.</li>
                </ul>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  3. Rewarded Advertising Mechanics
                </h2>
                <p>
                  The game permits pilots to watch AdMob tactical broadcasts in exchange for system revives and bonus credits. These ads are served "as is" by Google. Players understand that carrier data charges may apply, and we are not liable for external content delivered during the video feed streams.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  4. Intellectual Property
                </h2>
                <p>
                  All audio tracks, voice acting cues, MK-IV space interceptor model sprites, UI layout configurations, particle visual effects, and source scripts are the sole intellectual property of <strong>Parivartya Corporation</strong>. No trademark, design copyright, or trade dress may be duplicated without prior written authorization.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  5. No Warranties & Limitation of Liability
                </h2>
                <p>
                  This space shooter simulation is provided on an "as is" and "as available" basis. Parivartya Corporation makes no warranties, either express or implied, regarding application stability or continuous leaderboard operation. Under no circumstances will the developers be held liable for any data loss, device overheating, or auxiliary hardware damages resulting from gameplay.
                </p>
              </div>

              <hr className="border-white/5" />

              <div className="space-y-3">
                <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider border-l-3 border-cyan-500 pl-3">
                  6. Contact Info
                </h2>
                <p>
                  Support requests, legal inquiries, or compliance notices can be directed to:
                </p>
                <div className="mt-4 bg-slate-950/60 p-4 rounded-2xl border border-cyan-500/10 font-mono text-xs sm:text-sm text-cyan-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-400" />
                    <span>EMAIL: parivartyacorporation@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <span>WEBSITE: <a href="https://parivartya.in" target="_blank" rel="noopener noreferrer" className="hover:underline">https://parivartya.in</a></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-500 gap-4 pb-8">
          <span>&copy; {new Date().getFullYear()} Parivartya Corporation.Inc. All Rights Reserved.</span>
          <button 
            onClick={onBackToGame}
            className="cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors uppercase font-bold"
            id="btn-footer-back-text"
          >
            RETURN TO FLIGHT DECK
          </button>
        </footer>

      </div>
    </div>
  );
};
