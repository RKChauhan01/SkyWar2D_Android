import React, { useEffect, useState } from 'react';
import { 
  Compass, 
  Trophy, 
  Zap, 
  Cpu, 
  Smartphone, 
  Shield, 
  ArrowRight,
  Sparkles,
  Volume2,
  Gamepad2,
  Lock,
  Target,
  Maximize,
  Info,
  ExternalLink,
  Users
} from 'lucide-react';
import { getTopScores } from '../utils/leaderboard';

interface GameLandingProps {
  onPlayGame: () => void;
}

export default function GameLanding({ onPlayGame }: GameLandingProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);

  useEffect(() => {
    // Obtain high score
    try {
      const stored = localStorage.getItem('space_shooter_highscore');
      if (stored) {
        setHighScore(parseInt(stored, 10));
      }
    } catch (err) {
      console.warn('Failed to read highscore', err);
    }

    // Fetch live leaderboard for visual engagement
    const fetchLeaderboard = async () => {
      try {
        setIsLoadingLeaderboard(true);
        const scores = await getTopScores();
        setLeaderboard(scores.slice(0, 10));
        setLeaderboardError(false);
      } catch (err) {
        console.warn('Failed to fetch leaderboard in landing', err);
        setLeaderboardError(true);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative">
      {/* Immersive Space Nebula Atmosphere */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[120%] h-[100%] bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,transparent_70%)] opacity-80" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[80%] bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,transparent_70%)] opacity-50" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.6 }} />
      </div>

      {/* Decorative Floating Space Dust Particles */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-pulse" />
        <div className="absolute top-3/4 right-1/3 w-1 h-1 rounded-full bg-indigo-500/30" />
        <div className="absolute top-1/3 right-12 w-2 h-2 rounded-full bg-rose-500/20" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-10 sm:py-16 flex flex-col min-h-screen">
        
        {/* TOP LEVEL NAVIGATION HEADER */}
        <header className="flex items-center justify-between border-b border-white/5 pb-6 mb-12 sm:mb-16" id="landing-header">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)] border border-cyan-400/20 bg-slate-950">
              <img 
                src="https://space-shooter-752118499017.asia-south1.run.app/assets/SkyWar2D-DIRZHyKY.png" 
                alt="Sky War 2D Logo" 
                className="h-full w-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-display font-black text-[#f8fafc] tracking-widest uppercase text-base xs:text-lg">
                SKY WAR <span className="text-cyan-400">2D</span>
              </h1>
              <p className="font-mono text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">
                Space Shooting Arena // Ver 2.5.2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden xs:flex items-center gap-2 bg-slate-950/55 border border-white/10 rounded-xl px-4 py-2 font-mono text-[10px] sm:text-xs shadow-sm shadow-black/80 backdrop-blur-sm">
              <Trophy className="h-4 w-4 text-cyan-400" />
              <span className="text-slate-400">COMMANDER MAX SCORE:</span>
              <span className="text-cyan-300 font-bold tracking-wider">{highScore}</span>
            </div>
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" title="Space Network Live" />
          </div>
        </header>

        {/* HERO SECTION WITH DUAL COLUMN CONFIGURATION */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16 items-center flex-grow">
          
          {/* LEFT COLUMN: HERO INFORMATION & TELEMETRY SHIELD */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left" id="hero-showcase">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-400/20 rounded-full text-cyan-300 font-mono text-[10px] font-semibold tracking-wider uppercase mb-5 self-start">
              <Sparkles className="h-3 w-3 animate-pulse text-cyan-400" />
              <span>Next-Generation Space Core Simulator</span>
            </div>

            <h2 className="font-display font-extrabold text-4xl sm:text-[3.25rem] text-slate-100 tracking-tight leading-none uppercase mb-6 drop-shadow-[0_4px_16px_rgba(2,6,23,0.6)]">
              SKY WAR 2D
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">SPACE SHOOTING ARENA</span>
            </h2>

            <p className="font-sans text-sm sm:text-base text-slate-300 leading-relaxed mb-8 max-w-xl">
              Command the experimental MK-IV interceptor spacecraft, initiate lightning-fast evasive maneuvers, and blast relentless enemy swarms. Collect high-yield electromagnetic power-ups to activate spread-wave defense systems in the ultimate 2D galactic arena.
            </p>

            {/* BENTO-STYLE FEATURES LOGS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 hover:bg-slate-950/65 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl p-4 flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-display text-[12px] font-bold text-slate-200 uppercase tracking-widest mb-1">
                    Fluid Joystick Controls
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 leading-snug">
                    Seamless virtual touch joysticks adapt dynamic coordinates perfectly on any orientation.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 hover:border-indigo-500/30 hover:bg-slate-950/65 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl p-4 flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-display text-[12px] font-bold text-slate-200 uppercase tracking-widest mb-1">
                    Tactical Power-Ups
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 leading-snug">
                    Harness Rapid Fire speed and wide Spread laser matrix arrays. Engage auto-recharging active energy.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 hover:border-violet-500/30 hover:bg-slate-950/65 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl p-4 flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center shrink-0">
                  <Cpu className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h4 className="font-display text-[12px] font-bold text-slate-200 uppercase tracking-widest mb-1">
                    Hostile Adversaries
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 leading-snug">
                    Combat agile scout probes, armored elite cruisers, and capital ships with seeking projectile targeting guidance.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 hover:border-cyan-500/35 hover:bg-slate-950/65 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl p-4 flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-display text-[12px] font-bold text-slate-200 uppercase tracking-widest mb-1">
                    Pilot Global Ranks
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 leading-snug">
                    Transmit high score telemetry directly to the persistent cloud network and secure elite positions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: DEDICATED PREVIEW CABINET & TRIGGER CONSOLE */}
          <div className="lg:col-span-5 flex justify-center">
            
            <div className="w-full max-w-sm bg-slate-950/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-[0_15px_50px_-15px_rgba(6,182,212,0.25)] hover:shadow-[0_20px_60px_-10px_rgba(6,182,212,0.35)] transition-all duration-500 group flex flex-col justify-between min-h-[460px] backdrop-blur-md">
              
              {/* Dynamic decorative visual glow behind simulation */}
              <div className="absolute top-0 right-[-30%] w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all" />
              <div className="absolute bottom-[-10%] left-[-20%] w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

              {/* CARD CONTAINER METADATA HEADER */}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <span className="font-mono text-[9px] text-cyan-400 font-bold tracking-[0.25em] uppercase">SYSTEM SIMULATOR</span>
                    <h3 className="font-display text-xl font-black text-[#f1f5f9] tracking-tight uppercase mt-0.5">
                      COCKPIT ACCESS
                    </h3>
                  </div>
                  <div className="px-2.5 py-1 bg-cyan-950/20 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] font-bold uppercase rounded-md flex items-center gap-1.5 shadow-[0_0_8px_rgba(6,182,212,0.1)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    ONLINE
                  </div>
                </div>

                {/* GAME ICON / IMAGE BADGE - Interactive glowing representation of the game ship */}
                <div className="w-full aspect-video bg-slate-900/60 border border-white/5 rounded-2xl relative flex flex-col items-center justify-center p-4 shadow-inner mb-6 group/badge overflow-hidden">
                  
                  {/* Decorative cockpit scanner lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(34,211,238,0.06)_95%)] bg-[size:100%_16px] pointer-events-none" />
                  <div className="absolute inset-0 bg-[#020617]/25 pointer-events-none" />

                  {/* Ship graphic */}
                  <div className="relative z-10 transition-all duration-500 group-hover/badge:scale-[1.03] flex flex-col items-center">
                    
                    {/* Glowing Logo Circle */}
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.25)] bg-slate-950">
                      <img 
                        src="https://space-shooter-752118499017.asia-south1.run.app/assets/SkyWar2D-DIRZHyKY.png" 
                        alt="Sky War 2D Interceptor" 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <span className="font-mono text-[8px] tracking-[0.3em] font-extrabold text-cyan-300 uppercase mt-3">
                      MK-IV ADVANCED interceptor
                    </span>
                  </div>

                  {/* Glass background details */}
                  <div className="absolute bottom-2 inset-x-3 flex justify-between font-mono text-[7.5px] text-slate-400 z-10 border-t border-slate-800 pt-1.5">
                    <span>SECTOR: GRID-A9</span>
                    <span>SHIELD: 100%</span>
                    <span>MODULE: ACTIVE</span>
                  </div>
                </div>

                {/* QUICK INSTRUCTIONS BANNER */}
                <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 mb-6">
                  <span className="text-[10px] font-extrabold text-slate-300 tracking-widest uppercase block mb-2.5 flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-cyan-400" /> CONTROLLER CONFIGS
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-left font-mono">
                    <div className="bg-slate-900/40 rounded-xl p-2.5 border border-white/5">
                      <span className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">Desktop Pilot</span>
                      <span className="text-[10px] text-slate-300 font-sans">WASD Keys + Mouse Click</span>
                    </div>
                    <div className="bg-slate-900/40 rounded-xl p-2.5 border border-white/5">
                      <span className="text-[8px] text-orange-400 font-bold uppercase tracking-wider block mb-1">Mobile Pilot</span>
                      <span className="text-[10px] text-slate-300 font-sans">Fluid Dual Touch Sticks</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AUTOMATIC LANDING INGRESS TRIGGER BUTTONS */}
              <div className="relative z-10 space-y-2.5">
                <button
                  onClick={onPlayGame}
                  className="cursor-pointer font-extrabold font-display w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-600 hover:from-cyan-400 hover:via-sky-300 hover:to-indigo-500 text-white text-xs sm:text-sm uppercase tracking-widest shadow-[0_10px_25px_rgba(6,182,212,0.3)] hover:shadow-[0_15px_35px_rgba(6,182,212,0.45)] transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2.5"
                  id="btn-play-landing"
                >
                  <Maximize className="h-4 w-4 text-white" />
                  <span>ENGAGE FLIGHT INTERFACE</span>
                  <ArrowRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-1" />
                </button>

                <span className="font-mono text-[7px] text-slate-500 text-center uppercase tracking-widest mt-1 block">
                  Launches Interactive Arena Core Screen
                </span>
              </div>

            </div>

          </div>

        </main>

        {/* TOP TEN PILOT SCORES IN DATABASE */}
        <section className="mt-16 pt-8 border-t border-slate-900 relative z-10" id="top-ten-ranks">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
            <span className="font-sans text-xs font-bold text-[#e2e8f0] uppercase tracking-wider">
              Secure Transmissions // Top 10 Pilot Rankings
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {isLoadingLeaderboard ? (
              Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="bg-slate-950/20 border border-white/5 animate-pulse rounded-xl h-16" />
              ))
            ) : leaderboardError ? (
              <div className="col-span-2 sm:col-span-5 py-8 text-center text-slate-500 font-mono text-xs">
                LEADERBOARD NETWORK OFFLINE
              </div>
            ) : leaderboard.length > 0 ? (
              leaderboard.map((scoreItem, idx) => {
                const rawUrl = (scoreItem.socialUrl || '').trim();
                const hasSocial = rawUrl.length > 0;
                
                // Formulate valid URL schema
                let pilotHref = "";
                if (hasSocial) {
                  pilotHref = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
                }

                if (hasSocial) {
                  return (
                    <a
                      key={scoreItem.id || idx}
                      href={pilotHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Visit ${scoreItem.playerName || 'Anonymous'}'s pilot profile`}
                      className="group/card bg-slate-950/50 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col text-left font-mono relative overflow-hidden text-[10px] hover:border-cyan-400 hover:bg-cyan-950/25 transition-all duration-300 hover:translate-y-[-2px] backdrop-blur-sm shadow-[0_0_12px_rgba(34,211,238,0.1)] block"
                    >
                      <span className="absolute top-1 right-2.5 font-bold text-slate-700 group-hover/card:text-cyan-400/70 transition-colors">
                        #0{idx + 1}
                      </span>
                      <span className="font-bold text-slate-300 truncate max-w-[80%] uppercase text-[10px] flex items-center gap-1 group-hover/card:text-cyan-300 transition-colors">
                        {scoreItem.playerName || 'Anonymous'}
                        <ExternalLink className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                      </span>
                      <span className="font-bold text-[#22d3ee] text-xs mt-1.5 font-sans">
                        {scoreItem.score.toLocaleString()} pts
                      </span>
                      <span className="text-[7.5px] text-cyan-400/80 uppercase tracking-tight mt-1 font-mono flex items-center gap-0.5 group-hover/card:text-cyan-300 transition-colors">
                        PILOT LINK ACTIVE
                      </span>
                    </a>
                  );
                }

                return (
                  <div 
                    key={scoreItem.id || idx}
                    className="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col text-left font-mono relative overflow-hidden text-[10px] hover:border-cyan-500/30 transition-all duration-300 hover:translate-y-[-1px] backdrop-blur-sm"
                  >
                    <span className="absolute top-1 right-2.5 font-bold text-slate-700">
                      #0{idx + 1}
                    </span>
                    <span className="font-bold text-slate-300 truncate max-w-[80%] uppercase text-[10px]">
                      {scoreItem.playerName || 'Anonymous'}
                    </span>
                    <span className="font-bold text-[#22d3ee] text-xs mt-1.5 font-sans">
                      {scoreItem.score.toLocaleString()} pts
                    </span>
                    <span className="text-[7.5px] text-slate-500 uppercase tracking-tight mt-1 font-mono">
                      LINK SECURED
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 sm:col-span-5 py-8 text-center text-slate-500 font-mono text-xs">
                NO PILOT RECORDS FOUND
              </div>
            )}
          </div>
        </section>

        {/* BACK COMMAND COPYRIGHT FOOTER */}
        <footer className="mt-16 sm:mt-24 border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-500 gap-4">
          <span><a href="https://parivartya.in" className="text-decoration: none" target="_blank">&copy; Parivartya Corporation.Inc. All Right Reserved.</a></span>
          <div className="flex gap-4">
            <span>SECURE LINK // TRANSCEIVER PERSISTENT</span>
            <span>AUTOROTATE COMPATIBLE</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
