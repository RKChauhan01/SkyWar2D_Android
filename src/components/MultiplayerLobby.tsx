import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  ArrowRight, 
  ChevronLeft, 
  Play, 
  Check, 
  Compass, 
  ShieldAlert, 
  Gamepad2, 
  Zap, 
  Trophy,
  Loader2
} from 'lucide-react';
import { 
  createRoom, 
  joinRoom, 
  setPlayerReady, 
  listenToPlayers, 
  listenToRoom, 
  startMultiplayerGame, 
  exitRoom, 
  MultiplayerPlayer, 
  RoomState 
} from '../utils/multiplayer';
import { getOrCreateVisitorId } from '../utils/leaderboard';

interface MultiplayerLobbyProps {
  onLaunchMultiplayer: (roomId: string, myId: string, isHost: boolean) => void;
  onBack: () => void;
  initialPilotName: string;
  lobbyMode?: 'pvp' | 'coop';
}

export default function MultiplayerLobby({ 
  onLaunchMultiplayer, 
  onBack, 
  initialPilotName,
  lobbyMode = 'pvp'
}: MultiplayerLobbyProps) {
  // Pilot Details
  const [pilotName, setPilotName] = useState(initialPilotName);
  const [myId] = useState(() => getOrCreateVisitorId());
  
  // Interaction states
  const [lobbyView, setLobbyView] = useState<'home' | 'waiting_host' | 'waiting_joiner'>('home');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  
  // Real-time states
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Persistence
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.substring(0, 15);
    setPilotName(val);
    localStorage.setItem('space_shooter_pilot_name', val);
  };

  const cleanInputCode = (val: string) => {
    setInputCode(val.trim().toUpperCase().substring(0, 4));
  };

  // Create room flow
  const handleCreateRoom = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const Code = await createRoom(pilotName || 'Pilot Alpha', myId, lobbyMode);
      setRoomCode(Code);
      setIsReady(true); // Host is pre-ready
      setLobbyView('waiting_host');
    } catch (err: any) {
      console.warn(err);
      setErrorText(err.message || 'Failed to initialize squadron broadcast.');
    } finally {
      setLoading(false);
    }
  };

  // Join room flow
  const handleJoinRoom = async () => {
    if (!inputCode || inputCode.length !== 4) {
      setErrorText('Please enter a valid 4-character squad code.');
      return;
    }
    setLoading(true);
    setErrorText(null);
    try {
      await joinRoom(inputCode, pilotName || 'Pilot Bravo', myId);
      setRoomCode(inputCode);
      setIsReady(false); // Joiner starts not ready
      setLobbyView('waiting_joiner');
    } catch (err: any) {
      console.warn(err);
      setErrorText(err.message || 'Squad connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // Manage ready state for joiner
  const toggleReady = async () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    try {
      await setPlayerReady(roomCode, myId, nextReady);
    } catch (err: any) {
      console.warn(err);
    }
  };

  // Host triggers match launch
  const handleLaunchMatch = async () => {
    const allReady = players.every(p => p.status === 'ready');
    if (!allReady) {
      setErrorText('All squad pilots must toggle ready states prior to hyperjump.');
      return;
    }
    setLoading(true);
    try {
      await startMultiplayerGame(roomCode);
    } catch (err: any) {
      console.warn(err);
      setErrorText(err.message || 'Failed to trigger match launch.');
    } finally {
      setLoading(false);
    }
  };

  // Real-time synchronization listeners
  useEffect(() => {
    if (!roomCode) return;

    // Listen to Room updates
    const unsubscribeRoom = listenToRoom(roomCode, (roomData) => {
      if (!roomData) {
        // Room was destroyed or host left
        setErrorText('Squad transmission lost. Room has been terminated.');
        exitActiveRoom();
        return;
      }
      setRoom(roomData);
      
      // If room status became playing, transition into active GameCanvas!
      if (roomData.status === 'playing') {
        const isHost = roomData.hostId === myId;
        onLaunchMultiplayer(roomCode, myId, isHost);
      }
    });

    // Listen to players subcollection
    const unsubscribePlayers = listenToPlayers(roomCode, (playersData) => {
      setPlayers(playersData);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomCode]);

  const exitActiveRoom = async () => {
    if (roomCode) {
      const isHost = lobbyView === 'waiting_host';
      await exitRoom(roomCode, myId, isHost);
    }
    setRoomCode('');
    setRoom(null);
    setPlayers([]);
    setIsReady(false);
    setLobbyView('home');
  };

  const handleBackToHome = async () => {
    setLoading(true);
    try {
      if (roomCode) {
        const isHost = lobbyView === 'waiting_host';
        await exitRoom(roomCode, myId, isHost);
      }
    } catch (err) {
      console.warn("Error exiting room: ", err);
    } finally {
      setRoomCode('');
      setRoom(null);
      setPlayers([]);
      setIsReady(false);
      setLobbyView('home');
      setLoading(false);
      onBack();
    }
  };

  const handleBackOut = () => {
    if (roomCode) {
      exitActiveRoom();
    } else {
      onBack();
    }
  };

  const allPlayersReady = players.length > 0 && players.every(p => p.status === 'ready');

  return (
    <div className="min-h-screen bg-[#020617] text-[#f1f5f9] flex flex-col justify-center items-center px-4 py-8 select-none font-sans relative overflow-hidden" id="multiplayer-lobby-panel">
      {/* Reticle grid decorative backgrounds */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.35)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />
      <div className="absolute top-0 right-[-20%] w-96 h-96 rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-20%] w-96 h-96 rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />

      {/* Top Header Back utility */}
      <div className="w-full max-w-xl flex items-center justify-between mb-8 relative z-10">
        <button 
          onClick={handleBackToHome}
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-white/5 hover:border-white/10 rounded-xl text-xs text-slate-300 hover:text-white transition-all font-mono"
          id="btn-back-to-home"
        >
          <ChevronLeft className="h-4 w-4 text-cyan-400" />
          <span>BACK TO HOME</span>
        </button>
        <span className="font-mono text-[9px] text-cyan-400 font-bold bg-cyan-950/20 border border-cyan-500/20 px-2.5 py-1 rounded-md tracking-wider">
          CO-OP SECTOR // LIVE COCKPIT
        </span>
      </div>

      <div className="w-full max-w-xl bg-slate-950/40 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-md relative z-10 shadow-[0_15px_40px_rgba(2,6,23,0.7)] flex flex-col justify-between">
        <div id="lobby-card-header">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
              <Users className="h-5.5 w-5.5 animate-pulse" />
            </div>
            <div>
              <span className="font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-widest block">
                {lobbyMode === 'coop' ? 'CO-OP TEAMPLAY' : 'SQUADRON MATCHMAKING'}
              </span>
              <h2 className="font-display font-black text-xl sm:text-2xl text-slate-100 tracking-tight uppercase">
                {lobbyMode === 'coop' ? 'Play with Bro' : 'PvP Mode'}
              </h2>
            </div>
          </div>

          {/* SQUADRON COMMAND CENTER OVERVIEW */}
          {errorText && (
            <div className="mb-6 p-4 bg-rose-950/25 border border-rose-500/30 rounded-2xl flex items-start gap-3 animate-headshake">
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-mono text-[9px] font-bold text-rose-400 tracking-wider block">TRANSMISSION OVERFLOW ERROR</span>
                <p className="font-sans text-[11px] text-rose-300/90 leading-relaxed leading-normal mt-0.5">{errorText}</p>
              </div>
            </div>
          )}
        </div>

        {/* VIEW 1: HOME BASE (CREATE OR JOIN CO-OP LOBBY) */}
        {lobbyView === 'home' && (
          <div className="space-y-6" id="view-home">
            {/* Pilot Identity Selection Card */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
              <label className="font-mono text-[9px] text-cyan-300 font-semibold uppercase tracking-widest block mb-2">
                YOUR PILOT CALLSIGN
              </label>
              <input 
                type="text" 
                value={pilotName} 
                onChange={handleNameChange}
                className="w-full text-sm font-mono font-bold bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-cyan-200 uppercase tracking-widest focus:outline-none focus:border-cyan-500/50 transition-colors"
                placeholder="PILOT CALLSIGN"
              />
              <span className="font-mono text-[7.5px] text-slate-500 uppercase tracking-wider block mt-1.5">
                Maximum 15 alphanumeric indicators. Will persist on server rankings.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Box A: Host New Squadron */}
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="cursor-pointer border border-white/5 hover:border-cyan-500/35 bg-slate-900/20 hover:bg-slate-900/40 rounded-2xl p-5 text-left transition-all duration-300 group hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px]"
              >
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  <Plus className="h-4.5 w-4.5" />
                </div>
                <div className="mt-4">
                  <h4 className="font-display font-extrabold text-[12px] text-[#f1f5f9] uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
                    Deploy Squadron
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 mt-1 leading-snug">
                    Become the Host. Command and coordinate the squad, and trigger the deep-space hyperjump together.
                  </p>
                </div>
              </button>

              {/* Box B: Join Existing Flight */}
              <div className="border border-white/5 bg-slate-900/20 rounded-2xl p-5 text-left flex flex-col justify-between min-h-[140px]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => cleanInputCode(e.target.value)}
                    placeholder="SQUAD CODE"
                    className="w-full font-mono text-center font-bold text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-400 uppercase tracking-[0.5em] focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={loading || inputCode.length !== 4}
                    className="cursor-pointer bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-900 font-bold px-3 py-2 rounded-xl text-black uppercase tracking-wider text-xs transition-colors flex items-center justify-center shrink-0 disabled:text-slate-600 disabled:cursor-not-allowed border border-cyan-400/20 disabled:border-transparent"
                  >
                    <ArrowRight className="h-4.5 w-4.5" />
                  </button>
                </div>
                <div className="mt-4">
                  <h4 className="font-display font-extrabold text-[12px] text-[#f1f5f9] uppercase tracking-wider">
                    Secure Pilot Seat
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 mt-1 leading-snug">
                    Enter the 4-digit holographic squad broadcast transmission code provided by your Wingman host.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleBackToHome}
              className="cursor-pointer w-full font-bold font-mono py-3 px-5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 mt-4"
              id="btn-home-back"
            >
              <ChevronLeft className="h-4 w-4 text-cyan-400" />
              <span>RETURN TO MAIN BRIEFING</span>
            </button>
          </div>
        )}

        {/* VIEW 2: HOST WAITING LOBBY */}
        {lobbyView === 'waiting_host' && (
          <div className="space-y-6" id="view-waiting-host">
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 text-center relative overflow-hidden">
              <span className="font-mono text-[9px] text-[#22d3ee] font-bold tracking-[0.25em] uppercase block mb-1">
                SQUADRON CO-OP CODE
              </span>
              <div className="font-mono text-4xl font-extrabold text-white tracking-[0.3em] uppercase select-text cursor-pointer hover:text-cyan-300 transition-colors my-2.5" title="Copy room code">
                {roomCode}
              </div>
              <span className="font-mono text-[8px] text-slate-400 uppercase tracking-widest block">
                SHARE THIS CODE WITH YOUR WINGMAN PILOTS TO CONNECT
              </span>
            </div>

            {/* Squadron Pilots List */}
            <div className="space-y-2.5">
              <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                SQUADRON DEPLOYMENT LOG ({players.length}/4)
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                {players.map((p, idx) => (
                  <div key={p.id} className="bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-600">#0{idx + 1}</span>
                      <span className="font-bold text-slate-200 uppercase text-xs truncate max-w-[150px]">
                        {p.name}
                      </span>
                      {p.id === myId && (
                        <span className="text-[7.5px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/20 text-cyan-400 rounded uppercase font-semibold">
                          YOU (HOST)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        SQUAD PILOT ACTIVE
                      </span>
                    </div>
                  </div>
                ))}
                {players.length < 2 && (
                  <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                    <span>WAITING FOR WINGMAN TO LAUNCH COCKPIT...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Start flight controller */}
            <div className="pt-2 space-y-3">
              <button
                onClick={handleLaunchMatch}
                disabled={loading || players.length < 2 || !allPlayersReady}
                className="cursor-pointer w-full font-extrabold font-display py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-600 hover:from-cyan-400 hover:via-sky-300 hover:to-indigo-500 text-white text-xs uppercase tracking-widest shadow-[0_10px_25px_rgba(6,182,212,0.3)] hover:shadow-[0_15px_35px_rgba(6,182,212,0.45)] transform hover:-translate-y-0.5 disabled:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4" />
                <span>INITIATE SQUADRON FLIGHT</span>
              </button>

              <button
                onClick={handleBackToHome}
                className="cursor-pointer w-full font-bold font-mono py-3 px-6 rounded-2xl border border-rose-500/20 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2"
                id="btn-host-back-home"
              >
                <ChevronLeft className="h-4 w-4 text-rose-400" />
                <span>LEAVE ROOM & BACK TO HOME</span>
              </button>

              <span className="font-mono text-[7px] text-slate-500 text-center uppercase tracking-widest mt-2 block">
                {!allPlayersReady ? "ALL JOINED PILOTS MUST SQUAD READY FIRST" : "READY FOR LAUNCH SEQUENCE"}
              </span>
            </div>
          </div>
        )}

        {/* VIEW 3: JOINER WAITING LOBBY */}
        {lobbyView === 'waiting_joiner' && (
          <div className="space-y-6" id="view-waiting-joiner">
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 text-center">
              <span className="font-mono text-[9px] text-[#818cf8] font-bold tracking-[0.25em] uppercase block mb-1">
                SQUADRON CO-OP CONNECTED
              </span>
              <div className="font-mono text-4xl font-extrabold text-[#f1f5f9] tracking-[0.3em] uppercase select-text my-2.5">
                {roomCode}
              </div>
              <span className="font-mono text-[8px] text-slate-400 uppercase tracking-widest block">
                SQUADRON COMMANDER (HOST) DIRECTS DEPLOYMENT TIMELINE
              </span>
            </div>

            {/* Squadron Pilots List */}
            <div className="space-y-2.5">
              <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                SQUADRON PILOT COMPLEMENT ({players.length}/4)
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                {players.map((p, idx) => (
                  <div key={p.id} className="bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-600">#0{idx + 1}</span>
                      <span className="font-bold text-slate-200 uppercase text-xs truncate max-w-[150px]">
                        {p.name}
                      </span>
                      {p.id === myId && (
                        <span className="text-[7.5px] px-1.5 py-0.5 bg-indigo-950 border border-indigo-500/20 text-indigo-400 rounded uppercase font-semibold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'ready' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                            PILOT READY
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                            PREPARING PODS...
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Toggle ready button */}
            <div className="pt-2 space-y-3">
              <button
                onClick={toggleReady}
                className={`cursor-pointer w-full font-extrabold font-display py-4 px-6 rounded-2xl text-xs uppercase tracking-widest transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg border ${
                  isReady 
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-[#22d3ee] hover:bg-[#06b6d4] text-neutral-950 border-[#22d3ee]/20 hover:border-[#22d3ee]/30'
                }`}
              >
                {isReady ? <Check className="h-4.5 w-4.5" /> : <Play className="h-4 w-4" />}
                <span>{isReady ? 'SQUAD READY ACTIVE' : 'TOGGLE READY CHECK'}</span>
              </button>

              <button
                onClick={handleBackToHome}
                className="cursor-pointer w-full font-bold font-mono py-3 px-6 rounded-2xl border border-rose-500/20 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2"
                id="btn-joiner-back-home"
              >
                <ChevronLeft className="h-4 w-4 text-rose-400" />
                <span>LEAVE ROOM & BACK TO HOME</span>
              </button>

              <span className="font-mono text-[7px] text-slate-500 text-center uppercase tracking-widest mt-2 block">
                {isReady ? "Awaiting Commander's ignition protocol" : "Confirm systems ready to jump"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
