/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Pause, 
  Sparkles, 
  Compass, 
  ShieldAlert, 
  Cpu,
  Trophy,
  Zap,
  Home,
  Target,
  Smartphone,
  Maximize,
  Minimize,
  Settings,
  Users,
  WifiOff,
  Tv
} from 'lucide-react';
import { Player, Enemy, Bullet, Particle, Star, PowerUp, GameStateStatus, Wave, Brick } from '../types';
import { audio } from '../utils/audio';
import MultiplayerLobby from './MultiplayerLobby';
import LandscapeNotice from './LandscapeNotice';
import { auth } from '../utils/firebase';
import { submitScore, getTopScores, getOrCreateVisitorId } from '../utils/leaderboard';
import { 
  updatePlayerState, 
  listenToRoom, 
  listenToPlayers, 
  setRoomGameOver, 
  updateRoomWave, 
  exitRoom,
  damagePlayer,
  syncPlayerHealth,
  resetRoomForRematch,
  requestRematch,
  respondToRematch,
  clearRematchState,
  syncBrick,
  deleteBrick,
  listenToBricks,
  syncPowerUp,
  deletePowerUp,
  listenToPowerUps,
  clearMultiplayerEntities
} from '../utils/multiplayer';

const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 675;

// Deterministic seedable pseudo-random generator to ensure exact brick movement synchronization without database overhead!
function createSeededRandom(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return function() {
    state >>>= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDeterministicRandom(seedNum: number): number {
  const x = Math.sin(seedNum) * 10000;
  return x - Math.floor(x);
}

// Circle to Box intersection test for Brick collisions
function collidesCircleWithRect(
  circle: { x: number; y: number; radius: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  
  const closestX = Math.max(rect.x - halfW, Math.min(circle.x, rect.x + halfW));
  const closestY = Math.max(rect.y - halfH, Math.min(circle.y, rect.y + halfH));
  
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  
  const distSq = dx * dx + dy * dy;
  return distSq < circle.radius * circle.radius;
}

interface GameCanvasProps {
  onExitBack?: () => void;
  onBackToLobby?: () => void;
  onPlayWithFriends?: () => void;
  multiplayerRoomId?: string;
  multiplayerMyId?: string;
  multiplayerIsHost?: boolean;
}

export default function GameCanvas({ 
  onExitBack,
  onBackToLobby,
  onPlayWithFriends,
  multiplayerRoomId,
  multiplayerMyId,
  multiplayerIsHost
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sound Muted state
  const [muted, setMuted] = useState(false);

  // Rewarded Ad & AdMob Integration States
  const [networkOnline, setNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [adRewardClaimed, setAdRewardClaimed] = useState(false);

  // Listen to network status changes
  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => setNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize AdMob if in Capacitor
  useEffect(() => {
    const initAdMob = async () => {
      try {
        const anyWindow = window as any;
        if (anyWindow.Capacitor && anyWindow.Capacitor.isPluginAvailable('AdMob')) {
          const { AdMob } = await import('@capacitor-community/admob');
          await AdMob.initialize({
            initializeForTesting: true,
          });
          console.log("AdMob initialized successfully under Capacitor.");
        }
      } catch (err) {
        console.warn("AdMob initialization skipped/failed: ", err);
      }
    };
    initAdMob();
  }, []);

  // Revive the player and grant reward credits
  const handleRevivePlayer = () => {
    if (playerRef.current) {
      playerRef.current.health = playerRef.current.maxHealth;
      playerRef.current.isInvulnerable = true;
      playerRef.current.invulnerableTime = 180; // 3 seconds at 60 FPS
      
      // Clear out any nearby enemies to give player breathing room!
      if (enemiesRef.current) {
        enemiesRef.current = enemiesRef.current.filter(enemy => {
          const dx = enemy.x - playerRef.current.x;
          const dy = enemy.y - playerRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 250) {
            spawnExplosion(enemy.x, enemy.y, '#38bdf8', 12, false);
            return false;
          }
          return true;
        });
      }
    }

    // Reward credits
    setScore(prev => prev + 500);
    stateRef.current.score += 500;

    setGameState('playing');
    stateRef.current.gameState = 'playing';
    setAdRewardClaimed(true);
    
    // Clear any submission states if they wanted to submit
    setHasSubmitted(false);
    setSubmittingError(null);

    audio.play('powerup');
    triggerFloatingText("REINFORCEMENTS ARRIVED - HYPER CHARGED", LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 40, '#22c55e');
  };

  // Launch the rewarded ad flow (AdMob or simulated fallback)
  const startAdWatch = async () => {
    if (!navigator.onLine) {
      return;
    }
    setIsAdLoading(true);
    try {
      const anyWindow = window as any;
      if (anyWindow.Capacitor && anyWindow.Capacitor.isPluginAvailable('AdMob')) {
        const { AdMob } = await import('@capacitor-community/admob');
        
        // Prepare the reward ad
        await AdMob.prepareRewardVideoAd({
          adId: 'ca-app-pub-3940256099942544/5224354917', // Test rewarded ad ID
        });
        
        setIsAdLoading(false);
        setIsWatchingAd(true);
        setAdCountdown(5); // Show a transition/fallback countdown just in case
        
        const rewardItem = await AdMob.showRewardVideoAd();
        if (rewardItem) {
          // Reward earned!
          handleRevivePlayer();
        }
        setIsWatchingAd(false);
      } else {
        // Browser / Web fallback simulator
        setTimeout(() => {
          setIsAdLoading(false);
          setIsWatchingAd(true);
          setAdCountdown(5); // 5 seconds ad simulation
        }, 400);
      }
    } catch (error) {
      console.error("AdMob Error, falling back to Simulator: ", error);
      // Fallback to Web simulation
      setIsAdLoading(false);
      setIsWatchingAd(true);
      setAdCountdown(5);
    }
  };

  // Ad countdown timer logic
  useEffect(() => {
    let timerId: any;
    if (isWatchingAd && adCountdown > 0) {
      timerId = setInterval(() => {
        setAdCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerId);
            // End of ad, claim the reward!
            handleRevivePlayer();
            setIsWatchingAd(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isWatchingAd, adCountdown]);

  // Primary gameplay states
  const [gameState, setGameState] = useState<GameStateStatus>('start');
  const [multiplayerWon, setMultiplayerWon] = useState<boolean>(false);
  const hasHadRemotePlayersRef = useRef<boolean>(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('space_shooter_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });

  // Firebase Live Leaderboard States
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [pilotName, setPilotName] = useState(() => {
    return localStorage.getItem('space_shooter_pilot_name') || 'Pilot Alpha';
  });
  const [socialUrl, setSocialUrl] = useState(() => {
    return localStorage.getItem('space_shooter_social_url') || '';
  });
  const [startOverlayTab, setStartOverlayTab] = useState<'home' | 'leaderboard'>('home');
  const [submittingError, setSubmittingError] = useState<string | null>(null);

  // Rematch and popup states
  const [rematchRequesterId, setRematchRequesterId] = useState<string | null>(null);
  const [rematchStatus, setRematchStatus] = useState<'pending' | 'accepted' | 'declined' | null>(null);
  const [declineMessage, setDeclineMessage] = useState<string | null>(null);

  // Local multiplayer state that updates inside the game interface overlay
  const [localRoomId, setLocalRoomId] = useState<string | undefined>(undefined);
  const [localMyId, setLocalMyId] = useState<string | undefined>(undefined);
  const [localIsHost, setLocalIsHost] = useState<boolean | undefined>(undefined);
  const [showInnerLobby, setShowInnerLobby] = useState(false);
  const [lobbyMode, setLobbyMode] = useState<'pvp' | 'coop'>('pvp');

  const activeRoomId = multiplayerRoomId || localRoomId;
  const activeMyId = multiplayerMyId || localMyId;
  const activeIsHost = multiplayerIsHost !== undefined ? multiplayerIsHost : localIsHost;

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const scores = await getTopScores();
      setLeaderboard(scores);
    } catch (err) {
      console.warn("Failed to fetch custom leaderboard: ", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // On mount, auto sign in anonymously (non-blocking) and fetch scores
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const { ensureSignedIn } = await import('../utils/firebase');
        await ensureSignedIn();
        fetchLeaderboard();
      } catch (err) {
        console.warn("Firebase auto sign-in initialization failed: ", err);
      }
    };
    initFirebase();
  }, []);
  const [waveNum, setWaveNum] = useState(1);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(100);
  const [enemiesKilled, setEnemiesKilled] = useState(0);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, any>>({});
  const [waveBanner, setWaveBanner] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  // Synchronization refs for the game loop to avoid stale closures on props/state
  const activeRoomIdRef = useRef<string | undefined>(undefined);
  const activeMyIdRef = useRef<string | undefined>(undefined);
  const activeIsHostRef = useRef<boolean | undefined>(undefined);
  const pilotNameRef = useRef<string>(pilotName);

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { activeMyIdRef.current = activeMyId; }, [activeMyId]);
  useEffect(() => { activeIsHostRef.current = activeIsHost; }, [activeIsHost]);
  useEffect(() => { pilotNameRef.current = pilotName; }, [pilotName]);

  // Touch and Mobile compatibility states
  const [isTouchCapable, setIsTouchCapable] = useState(false);
  const [leftJoystickState, setLeftJoystickState] = useState({
    active: false,
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 }
  });
  const [rightJoystickState, setRightJoystickState] = useState({
    active: false,
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 }
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // Sync fullscreen change events
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
      );
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  const requestAppFullscreen = () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request failed safely:", err);
        });
      } else if ((elem as any).webkitRequestFullscreen) {
        try {
          const res = (elem as any).webkitRequestFullscreen();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {}
      } else if ((elem as any).mozRequestFullScreen) {
        try {
          const res = (elem as any).mozRequestFullScreen();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {}
      } else if ((elem as any).msRequestFullscreen) {
        try {
          const res = (elem as any).msRequestFullscreen();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Fullscreen request failed safely:", err);
    }
  };

  const toggleFullscreen = () => {
    try {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isCurrentlyFs) {
        requestAppFullscreen();
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  // References for the loop logic to avoid stale closures
  const stateRef = useRef({
    gameState: 'start' as GameStateStatus,
    score: 0,
    waveNum: 1,
    enemiesKilled: 0,
    mousePos: { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 },
    keys: {} as Record<string, boolean>,
    globalEnemyFireCooldown: 0,
    activePowerUp: null as string | null,
    powerUpTimer: 0,
    waveActive: false,
    enemiesRemainingToSpawn: 0,
    enemySpawnTimer: 0,
    // Mobile touch tracking properties
    isTouchCapable: false,
    
    // Left joystick tracking
    leftJoystickActive: false,
    leftJoystickStart: { x: 0, y: 0 },
    leftJoystickCurrent: { x: 0, y: 0 },
    leftJoystickVector: { x: 0, y: 0 },
    leftTouchId: null as number | null,

    // Right joystick tracking
    rightJoystickActive: false,
    rightJoystickStart: { x: 0, y: 0 },
    rightJoystickCurrent: { x: 0, y: 0 },
    rightJoystickVector: { x: 0, y: 0 },
    rightTouchId: null as number | null,
    mobileFireActive: false,
    
    // PvP matching and moving protection triggers
    pvpPowerupTimer: 0,
    lastSpawnedBrickInterval: 0,
    lastSpawnedPowerupTick: 0,
    roomCreatedAt: 0,
    gameStartTime: 0,
    roomGameMode: 'pvp' as 'pvp' | 'coop',
  });

  // Handle dynamic touch capability detection
  useEffect(() => {
    const detectTouch = () => {
      const capable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchCapable(capable);
      stateRef.current.isTouchCapable = capable;
    };
    detectTouch();

    const handleInitialTouch = () => {
      setIsTouchCapable(true);
      stateRef.current.isTouchCapable = true;
    };
    window.addEventListener('touchstart', handleInitialTouch, { once: true });
    return () => {
      window.removeEventListener('touchstart', handleInitialTouch);
    };
  }, []);

  // Track entity arrays
  const playerRef = useRef<Player>({
    x: LOGICAL_WIDTH / 2,
    y: LOGICAL_HEIGHT / 2,
    radius: 18,
    speed: 5.5,
    health: 100,
    maxHealth: 100,
    score: 0,
    kills: 0,
    angle: 0,
    isInvulnerable: false,
    invulnerableTime: 0,
    dashCooldown: 0,
    shootCooldown: 0,
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const bricksRef = useRef<Brick[]>([]);

  // Multiplayer position and action tracking references
  const remotePlayersRef = useRef<Record<string, any>>({});
  const remoteShootCooldownsRef = useRef<Record<string, number>>({});
  const lastSyncTimeRef = useRef<number>(0);
  const lerpRemotePlayersRef = useRef<Record<string, { x: number; y: number; angle: number }>>({});
  const hasReceivedInitialAliveSyncRef = useRef<boolean>(false);

  // Sound action toggle
  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    audio.setMuted(nextMuted);
  };

  // Helper inside loop to update local React states
  const updateReactStates = () => {
    setScore(stateRef.current.score);
    setWaveNum(stateRef.current.waveNum);
    setPlayerHealth(Math.max(0, playerRef.current.health));
    setPlayerMaxHealth(playerRef.current.maxHealth);
    setEnemiesKilled(stateRef.current.enemiesKilled);
  };

  // Initialize scrolling stars background
  const initStars = () => {
    const list: Star[] = [];
    for (let i = 0; i < 120; i++) {
      list.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.2,
        alpha: Math.random() * 0.8 + 0.2
      });
    }
    starsRef.current = list;
  };

  // Trigger text particle drifts (+100 points, level up, etc)
  interface FloatingText {
    text: string;
    x: number;
    y: number;
    color: string;
    alpha: number;
    timer: number;
  }
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const triggerFloatingText = (text: string, x: number, y: number, color = '#38bdf8') => {
    floatingTextsRef.current.push({
      text,
      x,
      y,
      color,
      alpha: 1,
      timer: 45
    });
  };

  // Explode effect with glowing star particles
  const spawnExplosion = (x: number, y: number, color: string, count = 18, premiumGlow = true) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        id: Math.random().toString(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.015,
        glow: premiumGlow
      });
    }
  };

  // Thrust particle puff behind player
  const spawnThrustParticle = (x: number, y: number, angle: string | number) => {
    const targetAngle = Number(angle) + Math.PI + (Math.random() * 0.4 - 0.2);
    const speed = Math.random() * 2 + 1;
    particlesRef.current.push({
      id: Math.random().toString(),
      x,
      y,
      vx: Math.cos(targetAngle) * speed + (Math.random() * 0.5 - 0.25),
      vy: Math.sin(targetAngle) * speed + (Math.random() * 0.5 - 0.25),
      color: Math.random() > 0.4 ? '#38bdf8' : '#f43f5e', // blue flame/orange core
      size: Math.random() * 3 + 1.5,
      alpha: 0.8,
      decay: 0.04,
      glow: false
    });
  };

  // Setup game start parameters
  const startGame = () => {
    // Deterministic starting positions based on ID to avoid overlapping in Multiplayer
    const idNum = activeMyId ? activeMyId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
    const startX = activeRoomId ? (300 + (idNum % 600)) : LOGICAL_WIDTH / 2;
    const startY = activeRoomId ? (200 + ((idNum * 13) % 300)) : LOGICAL_HEIGHT / 2;

    playerRef.current = {
      x: startX,
      y: startY,
      radius: 18,
      speed: 6.0,
      health: 100,
      maxHealth: 100,
      score: 0,
      kills: 0,
      angle: startX > LOGICAL_WIDTH / 2 ? Math.PI : 0, // Face center
      color: '#38bdf8', // Always blue for local player
      isInvulnerable: false,
      invulnerableTime: 0,
      dashCooldown: 0,
      shootCooldown: 0,
    };

    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
    bricksRef.current = [];
    floatingTextsRef.current = [];

    if (activeRoomId && activeIsHost) {
      clearMultiplayerEntities(activeRoomId).catch(console.warn);
    }
    
    stateRef.current.score = 0;
    stateRef.current.waveNum = 1;
    stateRef.current.enemiesKilled = 0;
    stateRef.current.globalEnemyFireCooldown = 0;
    stateRef.current.activePowerUp = null;
    stateRef.current.powerUpTimer = 0;
    stateRef.current.lastSpawnedBrickInterval = 0;
    stateRef.current.lastSpawnedPowerupTick = 0;
    stateRef.current.pvpPowerupTimer = 0;
    stateRef.current.gameStartTime = Date.now();
    stateRef.current.roomGameMode = lobbyMode;
    
    setMultiplayerWon(false);
    hasHadRemotePlayersRef.current = false;
    hasReceivedInitialAliveSyncRef.current = false;
    initStars();
    setAdRewardClaimed(false);
    setGameState('playing');
    stateRef.current.gameState = 'playing';
    
    setHasSubmitted(false);
    setSubmittingError(null);
    fetchLeaderboard();
    
    updateReactStates();
    startWave(1);
  };

  // Synchronized exit handler that removes player doc and exits the component entirely
  const handleCleanExit = async () => {
    if (activeRoomId && activeMyId) {
      try {
        const deleteRoom = stateRef.current.roomGameMode === 'pvp' ? (activeIsHost || false) : false;
        await exitRoom(activeRoomId, activeMyId, deleteRoom);
      } catch (e) {
        console.warn("Error leaving room in database:", e);
      }
    }
    if (onExitBack) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {}
      onExitBack();
    } else {
      // For local room state
      setLocalRoomId(undefined);
      setLocalMyId(undefined);
      setLocalIsHost(undefined);
      setGameState('start');
      stateRef.current.gameState = 'start';
    }
  };

  // New handler to exit a match and return to the game's main interface (Lobby or Start Menu)
  const handleExitMatch = async () => {
    // 1. Cleanup room state in database if in any multiplayer mode
    if (activeRoomId && activeMyId) {
      try {
        const deleteRoom = stateRef.current.roomGameMode === 'pvp' ? (activeIsHost || false) : false;
        await exitRoom(activeRoomId, activeMyId, deleteRoom);
      } catch (e) {
        console.warn("Error leaving room in database:", e);
      }
    }

    // 2. If it was a global multiplayer match from App props, return to the standalone lobby
    if (multiplayerRoomId && onBackToLobby) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {}
      onBackToLobby();
      return;
    }

    // 3. For Solo or Local Inner Lobby, just return to the internal start menu
    setLocalRoomId(undefined);
    setLocalMyId(undefined);
    setLocalIsHost(undefined);
    setGameState('start');
    stateRef.current.gameState = 'start';
  };

  // Set end-game parameters
  const triggerPlayerGameOver = () => {
    if (activeRoomIdRef.current && stateRef.current.roomGameMode === 'coop') {
      const otherAlive = Object.values(remotePlayersRef.current).some((rp: any) => rp.health > 0);
      if (otherAlive) {
        // Just declare local death/wreckage state, do not end the match!
        playerRef.current.health = 0;
        audio.play('player_death');
        spawnExplosion(playerRef.current.x, playerRef.current.y, '#f43f5e', 24, true);
        triggerFloatingText("SHIP DESTROYED - SPECTATING", playerRef.current.x, playerRef.current.y - 30, '#f43f5e');
        return;
      }
    }

    // In multiplayer PVP, if either player goes down, the room transitions to GAMEOVER
    if (activeRoomIdRef.current) {
      setRoomGameOver(activeRoomIdRef.current).catch(() => {});
    }

    audio.play('player_death');
    setGameState('gameover');
    stateRef.current.gameState = 'gameover';
    
    // Update high score locally
    const currentScore = stateRef.current.score;
    if (currentScore > highScore) {
      setHighScore(currentScore);
      try {
        localStorage.setItem('space_shooter_highscore', currentScore.toString());
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Start specific enemy numerical wave
  const startWave = (num: number) => {
    stateRef.current.waveNum = num;
    setWaveNum(num);

    if (activeRoomId && stateRef.current.roomGameMode === 'pvp') {
      // PvP special parameters (No wave spawns of enemies)
      stateRef.current.enemiesRemainingToSpawn = 0;
      stateRef.current.waveActive = false;
      setWaveBanner("DUEL LIVE");
      setTimeout(() => {
        setWaveBanner(null);
      }, 2500);
      audio.play('wave_start');
      triggerFloatingText("DUEL COMMENCED! ELIMINATE OPPONENT!", LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 80, '#fb7185');
      return;
    }

    const totalEnemies = 4 + num * 3;
    stateRef.current.enemiesRemainingToSpawn = totalEnemies;
    stateRef.current.waveActive = true;
    stateRef.current.enemySpawnTimer = 30; // Quick initial spawn wait
    
    // Auto-revive local player on new wave if other player carried them!
    if (activeRoomId && playerRef.current.health <= 0) {
      playerRef.current.health = 50; 
      playerRef.current.x = LOGICAL_WIDTH / 2;
      playerRef.current.y = LOGICAL_HEIGHT / 2;
      triggerFloatingText("REINFORCEMENTS ARRIVED", playerRef.current.x, playerRef.current.y - 40, '#22c55e');
    }
    
    // Display wave alert banner
    setWaveBanner(`WAVE ${num}`);
    setTimeout(() => {
      setWaveBanner(null);
    }, 2500);

    audio.play('wave_start');
    triggerFloatingText(`WAVE ${num} INCOMING!`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 80, '#22c55e');
  };

  // Fire bullet function
  const firePlayerBullet = () => {
    const p = playerRef.current;
    if (p.shootCooldown > 0) return;

    audio.play('player_shoot');
    const bulletSpeed = 12;

    const hasSpread = stateRef.current.activePowerUp === 'spread';
    const hasRapid = stateRef.current.activePowerUp === 'rapid';

    const baseDmg = 15;
    const cooldownPeriod = hasRapid ? 7 : 17; // Faster firing with rapid fire powerup
    const bulletColor = '#38bdf8'; // Blue bullets for local player

    if (hasSpread) {
      // Fire 3-way spread lasers
      const spreadAngles = [-0.18, 0, 0.18];
      spreadAngles.forEach((offset) => {
        const finalAngle = p.angle + offset;
        bulletsRef.current.push({
          id: Math.random().toString(),
          x: p.x + Math.cos(p.angle) * p.radius,
          y: p.y + Math.sin(p.angle) * p.radius,
          vx: Math.cos(finalAngle) * bulletSpeed,
          vy: Math.sin(finalAngle) * bulletSpeed,
          radius: 4,
          damage: baseDmg,
          isPlayer: true,
          color: bulletColor,
          isLocalPlayerBullet: true
        });
      });
    } else {
      // Normal single laser
      bulletsRef.current.push({
        id: Math.random().toString(),
        x: p.x + Math.cos(p.angle) * p.radius,
        y: p.y + Math.sin(p.angle) * p.radius,
        vx: Math.cos(p.angle) * bulletSpeed,
        vy: Math.sin(p.angle) * bulletSpeed,
        radius: 4.5,
        damage: baseDmg,
        isPlayer: true,
        color: bulletColor,
        isLocalPlayerBullet: true
      });
    }

    p.shootCooldown = cooldownPeriod;
  };

  // Spawn an enemy with random vector boundaries and clever tracking attributes
  const spawnSingleEnemy = () => {
    const wave = stateRef.current.waveNum;
    
    // Seeded random for deterministic enemy coordinates/types in Co-op
    let rnd = Math.random;
    if (activeRoomIdRef.current) {
      const seed = `${activeRoomIdRef.current}_enemy_${stateRef.current.waveNum}_${stateRef.current.enemiesRemainingToSpawn}`;
      rnd = createSeededRandom(seed);
    }

    // Spawn off-screen randomly
    let x = 0;
    let y = 0;
    const padding = 40;
    const side = Math.floor(rnd() * 4); // 0: top, 1: right, 2: bottom, 3: left

    if (side === 0) {
      x = rnd() * LOGICAL_WIDTH;
      y = -padding;
    } else if (side === 1) {
      x = LOGICAL_WIDTH + padding;
      y = rnd() * LOGICAL_HEIGHT;
    } else if (side === 2) {
      x = rnd() * LOGICAL_WIDTH;
      y = LOGICAL_HEIGHT + padding;
    } else {
      x = -padding;
      y = rnd() * LOGICAL_HEIGHT;
    }

    // Diverse type selection
    const types: ('chaser' | 'evader' | 'kamikaze' | 'ranger')[] = ['chaser'];
    if (wave >= 2) types.push('evader');
    if (wave >= 3) types.push('kamikaze');
    if (wave >= 4) types.push('ranger');

    const type = types[Math.floor(rnd() * types.length)];
    let radius = 15;
    let health = 20 + wave * 5;
    let speed = 2.0 + rnd() * 0.8;
    let color = '#ef4444'; // Red chaser
    let scoreValue = 100;

    if (type === 'evader') {
      radius = 16;
      health = 25 + wave * 4;
      speed = 2.4 + rnd() * 0.6;
      color = '#f97316'; // Orange evader
      scoreValue = 150;
    } else if (type === 'kamikaze') {
      radius = 12;
      health = 15 + wave * 3;
      speed = 3.6 + rnd() * 1.0; // Very rapid charging speed
      color = '#eab308'; // Yellow rush
      scoreValue = 200;
    } else if (type === 'ranger') {
      radius = 20;
      health = 40 + wave * 8;
      speed = 1.5 + rnd() * 0.4;
      color = '#a855f7'; // Purple heavy sniper ranged shooter
      scoreValue = 250;
    }

    enemiesRef.current.push({
      id: activeRoomIdRef.current ? `enemy_${stateRef.current.waveNum}_${stateRef.current.enemiesRemainingToSpawn}` : Math.random().toString(),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      health,
      maxHealth: health,
      angle: 0,
      speed,
      color,
      scoreValue,
      shootCooldown: rnd() * 60 + 40,
      state: 'chase',
      stateTimer: 0
    });
  };

  // Keyboard and click interactions tracker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default keys for clean arcade control
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      stateRef.current.keys[e.code] = true;

      // Handle direct pause shortcut (KeyP or Escape)
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (stateRef.current.gameState === 'playing') {
          setGameState('paused');
          stateRef.current.gameState = 'paused';
        } else if (stateRef.current.gameState === 'paused') {
          setGameState('playing');
          stateRef.current.gameState = 'playing';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 1. If multiplayer is requested, automatically start the match bypassing starting screen
  useEffect(() => {
    if (activeRoomId) {
      startGame();
    }
  }, [activeRoomId]);

  // 2. Real-time room and players synchronizers
  useEffect(() => {
    if (!activeRoomId) return;

    // Listen to Room updates (Wave increments, Game-overs, Lobby teardown)
    const unsubRoom = listenToRoom(activeRoomId, (roomState) => {
      if (!roomState) return;

      if (roomState.gameMode) {
        stateRef.current.roomGameMode = roomState.gameMode;
        setLobbyMode(roomState.gameMode);
      }

      // Sync room creation time for deterministic obstacle/powerup patterns across clients
      if (roomState.createdAt) {
        stateRef.current.roomCreatedAt = roomState.createdAt;
      }

      // Sync Rematch States
      setRematchRequesterId(roomState.rematchRequesterId || null);
      setRematchStatus(roomState.rematchStatus || null);

      if (roomState.rematchStatus === 'declined') {
        if (roomState.rematchRequesterId === activeMyIdRef.current) {
          setDeclineMessage('The opponent declined your request');
        }
      } else {
        setDeclineMessage(null);
      }

      // Coordinate Game Over
      if (roomState.status === 'gameover' && stateRef.current.gameState !== 'gameover') {
        const weWon = playerRef.current && playerRef.current.health > 0 && stateRef.current.roomGameMode === 'pvp';
        if (weWon) {
          setMultiplayerWon(true);
        } else {
          setMultiplayerWon(false);
        }
        setGameState('gameover');
        stateRef.current.gameState = 'gameover';
        audio.play(weWon ? 'powerup' : 'player_death');
      }

      // Coordinate Wave Progression if Joiner
      if (!activeIsHost && roomState.currentWave !== stateRef.current.waveNum) {
        startWave(roomState.currentWave);
      }

      // Coordinate Reset/Rematch
      if (roomState.status === 'playing' && stateRef.current.gameState === 'gameover') {
        setRematchRequesterId(null);
        setRematchStatus(null);
        setDeclineMessage(null);
        startGame();
      }
    });

    // Listen to Players update
    const unsubPlayers = listenToPlayers(activeRoomId, (playersList) => {
      // DEBUG: console.log(`[Multiplayer] Received ${playersList.length} players for room ${activeRoomId}`);
      const newRemote: Record<string, any> = {};
      let remoteCount = 0;
      playersList.forEach((p) => {
        const currentMyId = activeMyIdRef.current;
        // Handle local player damage synchronization from server (authoritative damage)
        if (currentMyId && p.id === currentMyId) {
          // Guard: If we just started a new match, ignore any server health sync that is <= 0 (dead)
          // until we receive at least one alive health status (> 0) from the server for this match.
          // This prevents stale end-game player snapshots from the previous match causing immediate game-over.
          if (!hasReceivedInitialAliveSyncRef.current) {
            if (p.health > 0) {
              hasReceivedInitialAliveSyncRef.current = true;
            } else {
              // Ignore stale end-game snapshot
              return;
            }
          }

          // If server health is significantly different from our local prediction, someone hit us!
          if (Math.abs(p.health - playerRef.current.health) > 1) {
            // Apply hit effects if health dropped
            if (p.health < playerRef.current.health) {
              audio.play('player_hit');
              spawnExplosion(playerRef.current.x, playerRef.current.y, '#f43f5e', 6, false);
              triggerFloatingText(`SYNC HIT: -${Math.round(playerRef.current.health - p.health)}`, playerRef.current.x, playerRef.current.y - 30, '#f43f5e');
            }
            
            playerRef.current.health = p.health;
            if (playerRef.current.health <= 0) {
              triggerPlayerGameOver();
            }
          }
        } else {
          newRemote[p.id] = p;
          remoteCount++;
        }
      });
      remotePlayersRef.current = newRemote;
      setRemotePlayers(newRemote);

      // Check if we are currently playing, and the opponent leaves
      if (stateRef.current.gameState === 'playing') {
        if (remoteCount > 0) {
          hasHadRemotePlayersRef.current = true;
        } else if (hasHadRemotePlayersRef.current && remoteCount === 0) {
          if (stateRef.current.roomGameMode === 'pvp') {
            // The other player left! Emerge as victor!
            setMultiplayerWon(true);
            setGameState('gameover');
            stateRef.current.gameState = 'gameover';
            audio.play('powerup');
            if (activeRoomId) {
              setRoomGameOver(activeRoomId).catch(() => {});
            }
          } else {
            // Co-op mode: just show a floating notification, but do NOT end the match!
            setSystemNotice("Your friend left the game");
            setTimeout(() => {
              setSystemNotice(null);
            }, 5000);
            triggerFloatingText("Your friend left the game", playerRef.current.x, playerRef.current.y - 45, '#e11d48');
            setLocalIsHost(true);
            activeIsHostRef.current = true;
            hasHadRemotePlayersRef.current = false;
          }
        }
      }
    });

    // Listen to Bricks subcollection with smart position blending to prevent snapping/reset glitches
    const unsubBricks = listenToBricks(activeRoomId, (syncedBricks) => {
      const currentLocalBricks = bricksRef.current;
      bricksRef.current = syncedBricks.map((syncedBrick) => {
        const existingLocal = currentLocalBricks.find((localBrick) => localBrick.id === syncedBrick.id);
        if (existingLocal) {
          return {
            ...syncedBrick,
            x: existingLocal.x,
            y: existingLocal.y,
            health: Math.min(syncedBrick.health, existingLocal.health)
          };
        }
        return syncedBrick;
      });
    });

    // Listen to Powerups subcollection with smart position blending
    const unsubPowerUps = listenToPowerUps(activeRoomId, (syncedPowerUps) => {
      const currentLocalPowerUps = powerUpsRef.current;
      powerUpsRef.current = syncedPowerUps.map((syncedPw) => {
        const existingLocal = currentLocalPowerUps.find((localPw) => localPw.id === syncedPw.id);
        if (existingLocal) {
          return {
            ...syncedPw,
            x: existingLocal.x,
            y: existingLocal.y
          };
        }
        return syncedPw;
      });
    });

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubBricks();
      unsubPowerUps();
    };
  }, [activeRoomId, activeMyId, activeIsHost]);

  // Tab/browser close or refresh clean exit
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeRoomId && activeMyId) {
        exitRoom(activeRoomId, activeMyId, activeIsHost || false).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeRoomId, activeMyId, activeIsHost]);

  // Main high speed Canvas Loop configuration
  useEffect(() => {
    let animationId: number;

    const gameLoop = () => {
      if (stateRef.current.gameState === 'playing') {
        updatePhysics();
      }
      renderCanvas();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Physics ticks calculations
    const updatePhysics = () => {
      const keys = stateRef.current.keys;
      const player = playerRef.current;

      // Co-op double-death check
      if (activeRoomIdRef.current && stateRef.current.roomGameMode === 'coop' && stateRef.current.gameState === 'playing') {
        const localDead = player.health <= 0;
        const allRemoteDead = Object.values(remotePlayersRef.current).every((rp: any) => rp.health <= 0);
        if (localDead && allRemoteDead) {
          triggerPlayerGameOver();
          return;
        }
      }

      // 1. Invulnerability timer logic
      if (player.isInvulnerable) {
        player.invulnerableTime--;
        if (player.invulnerableTime <= 0) {
          player.isInvulnerable = false;
        }
      }

      // 2. Dash controller
      if (player.dashCooldown > 0) player.dashCooldown--;
      if (player.shootCooldown > 0) player.shootCooldown--;

      // Decrement the global enemy shoot turn cooldown
      if (stateRef.current.globalEnemyFireCooldown > 0) {
        stateRef.current.globalEnemyFireCooldown--;
      }

      // Handle powerup expiration
      if (stateRef.current.activePowerUp) {
        stateRef.current.powerUpTimer--;
        if (stateRef.current.powerUpTimer <= 0) {
          stateRef.current.activePowerUp = null;
          triggerFloatingText("WEAPON DE-POWERED", player.x, player.y - 45, '#f43f5e');
        }
      }

      // 3. Movement input checks
      let moveX = 0;
      let moveY = 0;

      if (player.health > 0) {
        if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        // Integrate virtual joystick vectors if active
        if (stateRef.current.leftJoystickActive) {
          moveX = stateRef.current.leftJoystickVector.x;
          moveY = stateRef.current.leftJoystickVector.y;
        }

        // Normalization of diagonals (only when driven by keyboard controls)
        if (!stateRef.current.leftJoystickActive && moveX !== 0 && moveY !== 0) {
          const length = Math.sqrt(moveX * moveX + moveY * moveY);
          moveX /= length;
          moveY /= length;
        }

        // Apply movement vectors
        player.x += moveX * player.speed;
        player.y += moveY * player.speed;

        // COLLISION: Player vs Bricks (Physical Obstacles)
        bricksRef.current.forEach((brick) => {
          if (collidesCircleWithRect(player, brick)) {
            // Robust Axis-Aligned Bounding Box (AABB) Resolution
            const brickHalfW = brick.width / 2;
            const brickHalfH = brick.height / 2;
            
            // Vector from brick center to player center
            const dx = player.x - brick.x;
            const dy = player.y - brick.y;
            
            // Closest point on the brick's surface to the player center
            const closestX = Math.max(-brickHalfW, Math.min(brickHalfW, dx));
            const closestY = Math.max(-brickHalfH, Math.min(brickHalfH, dy));
            
            // Distance from closest point to player center
            const distX = dx - closestX;
            const distY = dy - closestY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            
            if (distance < player.radius && distance > 0) {
              // Push player out along the collision normal
              const overlap = player.radius - distance;
              player.x += (distX / distance) * overlap;
              player.y += (distY / distance) * overlap;
            } else if (distance === 0) {
              // Fallback for centered overlap: push towards the nearest edge
              if (Math.abs(dx / brickHalfW) > Math.abs(dy / brickHalfH)) {
                player.x = brick.x + (dx > 0 ? (brickHalfW + player.radius) : -(brickHalfW + player.radius));
              } else {
                player.y = brick.y + (dy > 0 ? (brickHalfH + player.radius) : -(brickHalfH + player.radius));
              }
            }
          }
        });

        // Generate flight dust behind player
        if (moveX !== 0 || moveY !== 0) {
          if (Math.random() < 0.6) {
            spawnThrustParticle(player.x, player.y, player.angle);
          }
        }

        // Clamp player perfectly within logical game arena constraints
        player.x = Math.max(player.radius, Math.min(LOGICAL_WIDTH - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(LOGICAL_HEIGHT - player.radius, player.y));

        // 4. Align Player angle with mouse position, closest enemy (Auto-Aim), or Right Aiming Joystick
        let angleSet = false;

        if (stateRef.current.rightJoystickActive) {
          const rx = stateRef.current.rightJoystickVector.x;
          const ry = stateRef.current.rightJoystickVector.y;
          if (Math.hypot(rx, ry) > 0.15) {
            player.angle = Math.atan2(ry, rx);
            angleSet = true;
          }
        }

        if (!angleSet) {
          // Standard cursor or drag manual aiming
          const mouse = stateRef.current.mousePos;
          const dx = mouse.x - player.x;
          const dy = mouse.y - player.y;
          player.angle = Math.atan2(dy, dx);
        }

        // 5. Fire bullet checks (KeySpace, active right virtual joystick, or active mobile fire button)
        let shouldFire = keys['Space'] || keys[' '] || stateRef.current.keys['Space'] || stateRef.current.mobileFireActive;
        if (stateRef.current.rightJoystickActive) {
          const rx = stateRef.current.rightJoystickVector.x;
          const ry = stateRef.current.rightJoystickVector.y;
          if (Math.hypot(rx, ry) > 0.15) {
            shouldFire = true;
          }
        }
        if (shouldFire) {
          firePlayerBullet();
        }
      }

      // 6. Spawn wave enemies controller
      if (stateRef.current.waveActive) {
        if (stateRef.current.enemiesRemainingToSpawn > 0) {
          stateRef.current.enemySpawnTimer--;
          if (stateRef.current.enemySpawnTimer <= 0) {
            spawnSingleEnemy();
            stateRef.current.enemiesRemainingToSpawn--;
            // Spacing out spawns so they trickle in beautifully
            let trickleRand = Math.random();
            if (activeRoomIdRef.current) {
              const seed = `${activeRoomIdRef.current}_spawntimer_${stateRef.current.waveNum}_${stateRef.current.enemiesRemainingToSpawn}`;
              const rnd = createSeededRandom(seed);
              trickleRand = rnd();
            }
            stateRef.current.enemySpawnTimer = 45 + trickleRand * 40; 
          }
        } else if (enemiesRef.current.length === 0) {
          // Wave complete!
          stateRef.current.waveActive = false;
          const nextWave = stateRef.current.waveNum + 1;
          
          if (activeRoomIdRef.current) {
            if (activeIsHostRef.current) {
              updateRoomWave(activeRoomIdRef.current, nextWave).catch(() => {});
              
              setTimeout(() => {
                if (stateRef.current.gameState === 'playing') {
                  startWave(nextWave);
                }
              }, 2000);
            }
            // Joiner will start the wave automatically via listenToRoom's firestore sync!
          } else {
            // Solo play
            setTimeout(() => {
              if (stateRef.current.gameState === 'playing') {
                startWave(nextWave);
              }
            }, 2000);
          }
        }
      }

      // 7. Update scrolling stars backdrop (depth illusion)
      starsRef.current.forEach((star) => {
        star.y += star.speed;
        if (star.y > LOGICAL_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * LOGICAL_WIDTH;
        }
      });

      // 8. Update Bullets physics
      const nextBullets: Bullet[] = [];
      bulletsRef.current.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;

        // Keep inside screen logic
        const margin = 20;
        if (b.x >= -margin && b.x <= LOGICAL_WIDTH + margin && b.y >= -margin && b.y <= LOGICAL_HEIGHT + margin) {
          nextBullets.push(b);
        }
      });
      bulletsRef.current = nextBullets;

      // 9. Update Intelligent Enemy Mechanics (Chase & Evade)
      const playerBullets = bulletsRef.current.filter(b => b.isPlayer);

      enemiesRef.current.forEach((enemy) => {
        enemy.stateTimer++;

        let targetX = player.x;
        let targetY = player.y;
        let distToTarget = Math.sqrt((player.x - enemy.x)**2 + (player.y - enemy.y)**2);

        if (player.health <= 0) {
          distToTarget = Infinity;
        }

        // In Co-op, check other players as well and target the nearest alive one
        if (activeRoomIdRef.current && stateRef.current.roomGameMode === 'coop') {
          Object.values(remotePlayersRef.current).forEach((rp: any) => {
            if (rp.health > 0) {
              const rDx = rp.x - enemy.x;
              const rDy = rp.y - enemy.y;
              const rDist = Math.sqrt(rDx * rDx + rDy * rDy);
              if (rDist < distToTarget) {
                distToTarget = rDist;
                targetX = rp.x;
                targetY = rp.y;
              }
            }
          });
        }

        const pDx = targetX - enemy.x;
        const pDy = targetY - enemy.y;
        const distToPlayer = distToTarget;

        // Normalize basic chase vector to player
        const dirX = distToPlayer > 0 ? pDx / distToPlayer : 0;
        const dirY = distToPlayer > 0 ? pDy / distToPlayer : 0;

        // Smart dynamic AI behavior sets
        let targetVx = dirX * enemy.speed;
        let targetVy = dirY * enemy.speed;

        if (enemy.type === 'kamikaze') {
          // Pure relentless charge!
          targetVx = dirX * (enemy.speed * 1.5);
          targetVy = dirY * (enemy.speed * 1.5);
        } 
        else if (enemy.type === 'evader') {
          // Try to stay in sweet mid-range (distance 250px)
          const sweetDistance = 260;
          if (distToPlayer < sweetDistance - 40) {
            // Back away! Evading too close player
            targetVx = -dirX * enemy.speed;
            targetVy = -dirY * enemy.speed;
          } else if (distToPlayer > sweetDistance + 40) {
            // Chase player to get back in range
            targetVx = dirX * enemy.speed;
            targetVy = dirY * enemy.speed;
          } else {
            // Circle & strafe
            targetVx = -dirY * enemy.speed;
            targetVy = dirX * enemy.speed;
          }

          // INTELLIGENT DODGING logic: detect oncoming player lasers and dodge them!
          playerBullets.forEach((b) => {
            const ebDx = b.x - enemy.x;
            const ebDy = b.y - enemy.y;
            const distToBullet = Math.sqrt(ebDx * ebDx + ebDy * ebDy);
            
            // If bullet is close and travelling towards the enemy, slide outwards perpendicular!
            if (distToBullet < 180) {
              const dotProduct = (b.vx * ebDx + b.vy * ebDy);
              if (dotProduct < 0) { // Moving close!
                // Dodge left or right perpendicular to bullet vector
                const perpX = -b.vy;
                const perpY = b.vx;
                const len = Math.sqrt(perpX * perpX + perpY * perpY);
                if (len > 0) {
                  targetVx += (perpX / len) * (enemy.speed * 1.8);
                  targetVy += (perpY / len) * (enemy.speed * 1.8);
                }
              }
            }
          });
        } 
        else if (enemy.type === 'ranger') {
          // Ranged strategy: Maintain sniped range of 400px
          const rangeDistance = 400;
          if (distToPlayer < rangeDistance - 50) {
            // Fallback backing off
            targetVx = -dirX * enemy.speed;
            targetVy = -dirY * enemy.speed;
          } else if (distToPlayer > rangeDistance + 50) {
            // Close in
            targetVx = dirX * enemy.speed;
            targetVy = dirY * enemy.speed;
          } else {
            // Strafe slowly around player
            targetVx = -dirY * (enemy.speed * 0.5);
            targetVy = dirX * (enemy.speed * 0.5);
          }
        }
        else { // Chaser-style standard enemy
          // Direct tracking, but if exceptionally close, swirl round rather than pure direct crash
          if (distToPlayer < 100) {
            // Blend linear direction with circling orbit
            targetVx = (dirX * 0.3 - dirY * 0.7) * enemy.speed;
            targetVy = (dirY * 0.3 + dirX * 0.7) * enemy.speed;
          }
        }

        // Apply smooth velocity transitions/damping
        enemy.vx = enemy.vx * 0.9 + targetVx * 0.1;
        enemy.vy = enemy.vy * 0.9 + targetVy * 0.1;

        // Move enemy
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Update look direction towards player
        enemy.angle = Math.atan2(pDy, pDx);

        // --- ENEMY SHOOT DECISION SYSTEM ---
        // Constraint: "One Enemy Fire one a time"
        // 1. Only types 'chaser', 'evader', 'ranger' can fire bullets. 'kamikaze' does physical contact.
        // 2. Global single turn fire system: can only spawn bullet if globalEnemyFireCooldown is finished.
        if (enemy.type !== 'kamikaze' && stateRef.current.globalEnemyFireCooldown <= 0) {
          enemy.shootCooldown--;
          if (enemy.shootCooldown <= 0 && distToPlayer < 700) {
            // Trigger shoot behavior !
            audio.play('enemy_shoot');
            const bulletSpeed = enemy.type === 'ranger' ? 7.5 : 5.5;
            const dmg = enemy.type === 'ranger' ? 20 : 10;
            const bulletColor = enemy.type === 'ranger' ? '#c084fc' : '#f43f5e'; // Heavy purple or light red

            bulletsRef.current.push({
              id: Math.random().toString(),
              x: enemy.x + Math.cos(enemy.angle) * enemy.radius,
              y: enemy.y + Math.sin(enemy.angle) * enemy.radius,
              vx: Math.cos(enemy.angle) * bulletSpeed,
              vy: Math.sin(enemy.angle) * bulletSpeed,
              radius: enemy.type === 'ranger' ? 5.5 : 4,
              damage: dmg,
              isPlayer: false,
              color: bulletColor
            });

            // Set individual enemy cooldown AND global turn-taking constraint cooldown
            let individualRand = Math.random();
            let globalRand = Math.random();
            if (activeRoomIdRef.current) {
              const seedNum = enemy.x * 123.45 + enemy.y * 67.89 + enemy.stateTimer * 9.12;
              individualRand = getDeterministicRandom(seedNum);
              globalRand = getDeterministicRandom(seedNum + 4.56);
            }

            enemy.shootCooldown = 120 + individualRand * 80; // Enemy individual fire spacing
            stateRef.current.globalEnemyFireCooldown = 40 + globalRand * 25; // Spaced shooting across the entire cohort!
          }
        }
      });

      // 10. Update Powerups
      const nextPowerUps: PowerUp[] = [];
      powerUpsRef.current.forEach((pw) => {
        const dx = player.x - pw.x;
        const dy = player.y - pw.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + pw.radius) {
          // Collected!
          audio.play('powerup');
          if (activeRoomIdRef.current) {
            deletePowerUp(activeRoomIdRef.current, pw.id).catch(console.warn);
          }
          if (pw.type === 'health') {
            player.health = Math.min(player.maxHealth, player.health + 40);
            triggerFloatingText("+40 SHIELD HEALTH", pw.x, pw.y, '#22c55e');

            // Sync health recovery to server immediately
            const roomId = activeRoomIdRef.current;
            const myId = activeMyIdRef.current;
            if (roomId && myId) {
              syncPlayerHealth(roomId, myId, player.health);
            }
          } else if (pw.type === 'spread') {
            stateRef.current.activePowerUp = 'spread';
            stateRef.current.powerUpTimer = 400; // ~6.6 seconds
            triggerFloatingText("SPREAD BLASTER", pw.x, pw.y, '#38bdf8');
          } else if (pw.type === 'rapid') {
            stateRef.current.activePowerUp = 'rapid';
            stateRef.current.powerUpTimer = 350; // ~5.8 seconds
            triggerFloatingText("HYPER COOLDOWN BLASTER", pw.x, pw.y, '#eab308');
          } else { // shield invulnerability
            player.isInvulnerable = true;
            player.invulnerableTime = 300; // 5 seconds
            triggerFloatingText("DEFENSIVE FORCEFIELD", pw.x, pw.y, '#a855f7');
          }
        } else {
          nextPowerUps.push(pw);
        }
      });
      powerUpsRef.current = nextPowerUps;

      // 10b. PvP Mode Power-up Spawning (Deterministic sync across clients)
      if (activeRoomIdRef.current) {
        if (activeIsHostRef.current) {
          const powerupIntervalSec = 15; // Increased frequency (was 22s)
          const baseTime = stateRef.current.gameStartTime || stateRef.current.roomCreatedAt || Date.now();
          const elapsed = Date.now() - baseTime;
          const powerupTickGroup = Math.max(0, Math.floor(elapsed / (powerupIntervalSec * 1000)));
          
          if (stateRef.current.lastSpawnedPowerupTick !== powerupTickGroup) {
            stateRef.current.lastSpawnedPowerupTick = powerupTickGroup;
            
            const rnd = createSeededRandom(activeRoomIdRef.current + "_pvp_powerup_" + powerupTickGroup);
            const types: ('health' | 'shield' | 'spread' | 'rapid')[] = ['health', 'shield', 'spread', 'rapid'];
            const type = types[Math.floor(rnd() * types.length)];
            
            const newPowerUp: PowerUp = {
              id: `pvp_power_${powerupTickGroup}`,
              x: 100 + rnd() * (LOGICAL_WIDTH - 200),
              y: 100 + rnd() * (LOGICAL_HEIGHT - 200),
              type,
              radius: 15,
              duration: 8000
            };
            
            syncPowerUp(activeRoomIdRef.current, newPowerUp).catch(console.warn);
          }
        }
      }

      // 10c. Deterministic Brick Spawner (Spawn protecting barrier blocks in straight lines frequently in PvP mode)
      if (activeRoomIdRef.current && stateRef.current.gameState === 'playing' && stateRef.current.roomGameMode === 'pvp') {
        if (activeIsHostRef.current) {
          const brickIntervalMs = 1800; // Increased frequency (was 2600ms)
          const baseTime = stateRef.current.gameStartTime || stateRef.current.roomCreatedAt || Date.now();
          const elapsed = Date.now() - baseTime;
          const intervalGroup = Math.max(0, Math.floor(elapsed / brickIntervalMs));
          
          if (stateRef.current.lastSpawnedBrickInterval !== intervalGroup) {
            stateRef.current.lastSpawnedBrickInterval = intervalGroup;
            
            const rnd = createSeededRandom(activeRoomIdRef.current + "_brick_" + intervalGroup);
            
            const directions = ["B2T", "T2B", "R2L", "L2R"];
            const dir = directions[Math.floor(rnd() * directions.length)];
            let x = 0, y = 0, vx = 0, vy = 0;
            let width = 75, height = 45; 
            const speed = 2.0 + rnd() * 1.5;

            if (dir === "B2T") {
              x = 200 + rnd() * (LOGICAL_WIDTH - 400);
              y = LOGICAL_HEIGHT + 30;
              vy = -speed;
            } else if (dir === "T2B") {
              x = 200 + rnd() * (LOGICAL_WIDTH - 400);
              y = -30;
              vy = speed;
            } else if (dir === "R2L") {
              width = 45;
              height = 75;
              x = LOGICAL_WIDTH + 30;
              y = 150 + rnd() * (LOGICAL_HEIGHT - 300);
              vx = -speed;
            } else { // L2R
              width = 45;
              height = 75;
              x = -30;
              y = 150 + rnd() * (LOGICAL_HEIGHT - 300);
              vx = speed;
            }

            const colors = ["#f59e0b", "#06b6d4", "#ec4899", "#84cc16"];
            const color = colors[Math.floor(rnd() * colors.length)];

            const newBrick: Brick = {
              id: `brick_${intervalGroup}_${activeRoomIdRef.current}`,
              x,
              y,
              width,
              height,
              vx,
              vy,
              health: 150, // More durable
              maxHealth: 150,
              color
            };

            syncBrick(activeRoomIdRef.current, newBrick).catch(console.warn);
          }
        }
      }

      // 10d. Physics updates for active Bricks
      const nextBricks: Brick[] = [];
      bricksRef.current.forEach((brick) => {
        brick.x += (brick.vx || 0);
        brick.y += (brick.vy || 0);
        
        const borderPadding = 200;
        const insideBoundary = 
          brick.x >= -borderPadding && 
          brick.x <= LOGICAL_WIDTH + borderPadding && 
          brick.y >= -borderPadding && 
          brick.y <= LOGICAL_HEIGHT + borderPadding;
          
        if (insideBoundary && brick.health > 0) {
          nextBricks.push(brick);
        } else {
          if (activeRoomIdRef.current && activeIsHostRef.current) {
            deleteBrick(activeRoomIdRef.current, brick.id).catch(console.warn);
          }
        }
      });
      bricksRef.current = nextBricks;

      // 11. Handle Bullet-To-Entity Collisions (Hit Boxes)
      bulletsRef.current.forEach((bullet) => {
        // A0. Check shielding brick intersection first
        for (let i = 0; i < bricksRef.current.length; i++) {
          const brick = bricksRef.current[i];
          if (brick.health <= 0) continue;

          if (collidesCircleWithRect(bullet, brick)) {
            brick.health -= bullet.damage || 15;
            bullet.damage = 0; // destroy bullet

            audio.play('enemy_hit');
            spawnExplosion(bullet.x, bullet.y, brick.color, 4, false);

            if (brick.health <= 0) {
              audio.play('enemy_death');
              spawnExplosion(brick.x, brick.y, brick.color, 12, true);
              triggerFloatingText("BARRIER VAPORIZED", brick.x, brick.y, brick.color);
              
              if (activeRoomIdRef.current) {
                deleteBrick(activeRoomIdRef.current, brick.id).catch(console.warn);
              }
            }
            break; // Laser collapsed, terminate check
          }
        }

        if (bullet.damage <= 0) return; // Skip rest of checks for this laser

        const currentRoomId = activeRoomIdRef.current;
        const currentMyId = activeMyIdRef.current;
        if (currentRoomId && stateRef.current.roomGameMode === 'pvp') {
          // ONLINE PVP MULTIPLAYER COLLIDE
          if (bullet.isLocalPlayerBullet) {
            // Local player bullet hits remote player
            Object.values(remotePlayersRef.current).forEach((rp: any) => {
              if (!currentMyId || rp.id === currentMyId || rp.health <= 0) return;
              const dx = bullet.x - rp.x;
              const dy = bullet.y - rp.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < bullet.radius + 18) { // 18 is standard remote ship collision radius
                bullet.damage = 0; // Destroy bullet
                audio.play('enemy_hit');
                spawnExplosion(bullet.x, bullet.y, rp.color || '#38bdf8', 4, false);
                
                // Authoritative Damage Registration
                // Shield check: if remote player has a shield (isInvulnerable), don't apply damage
                if (!rp.isInvulnerable) {
                  damagePlayer(currentRoomId, rp.id, 10);
                } else {
                  // Visual feedback for shield hit
                  spawnExplosion(bullet.x, bullet.y, '#a855f7', 6, true);
                  triggerFloatingText("ABSORBED", rp.x, rp.y - 30, '#c084fc');
                }
                
                // Add score
                stateRef.current.score += 10;
                triggerFloatingText("+10 DAMAGE", rp.x, rp.y - 15, rp.color || '#38bdf8');
              }
            });
          } else if (bullet.isLocalPlayerBullet === false) {
            // Remote player bullet hits local player
            const dx = bullet.x - player.x;
            const dy = bullet.y - player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < bullet.radius + player.radius) {
              bullet.damage = 0; // Clear bullet
              if (!player.isInvulnerable && player.health > 0) {
                player.health -= 10; // PvP bullet damage
                audio.play('player_hit');
                player.isInvulnerable = true;
                player.invulnerableTime = 35; // Brief protection
                spawnExplosion(player.x, player.y, '#f43f5e', 8, false);
                triggerFloatingText("-10 HEALTH", player.x, player.y - 25, '#f43f5e');
                if (player.health <= 0) {
                  triggerPlayerGameOver();
                }
              } else if (player.isInvulnerable) {
                audio.play('enemy_hit');
                spawnExplosion(bullet.x, bullet.y, '#a855f7', 6, true);
                triggerFloatingText("ABSORBED", player.x, player.y - 35, '#c084fc');
              }
            }
          }
        } else {
          // SINGLE PLAYER / CO-OP CLASSIC versus enemies
          if (bullet.isPlayer) {
            // Bullet hit enemy
            enemiesRef.current.forEach((enemy) => {
              if (enemy.health <= 0) return;
              const dx = bullet.x - enemy.x;
              const dy = bullet.y - enemy.y;
              const dist = Math.sqrt(dx*dx + dy*dy);

              if (dist < bullet.radius + enemy.radius) {
                // Register hit !
                enemy.health -= bullet.damage;
                bullet.damage = 0; // Destroy bullet trigger
                audio.play('enemy_hit');

                // Small hit sparkles
                spawnExplosion(bullet.x, bullet.y, enemy.color, 4, false);

                // Check death
                if (enemy.health <= 0) {
                  audio.play('enemy_death');
                  spawnExplosion(enemy.x, enemy.y, enemy.color, 16, true);
                  
                  // Add score
                  stateRef.current.score += enemy.scoreValue;
                  stateRef.current.enemiesKilled++;
                  triggerFloatingText(`+${enemy.scoreValue}`, enemy.x, enemy.y - 15, '#38bdf8');

                  // Chance to spawn special Powerup item (16%)
                  if (Math.random() < 0.16) {
                    const items: ('health' | 'spread' | 'rapid' | 'shield')[] = ['health', 'spread', 'rapid', 'shield'];
                    const chosenType = items[Math.floor(Math.random() * items.length)];
                    const pwId = `enemy_pw_${enemy.id}_${Date.now()}`;
                    if (activeRoomIdRef.current) {
                      if (activeIsHostRef.current) {
                        const newPowerUp: PowerUp = {
                          id: pwId,
                          x: enemy.x,
                          y: enemy.y,
                          type: chosenType,
                          radius: 14,
                          duration: 400
                        };
                        syncPowerUp(activeRoomIdRef.current, newPowerUp).catch(console.warn);
                      }
                    } else {
                      powerUpsRef.current.push({
                        id: pwId,
                        x: enemy.x,
                        y: enemy.y,
                        type: chosenType,
                        radius: 14,
                        duration: 400
                      });
                    }
                  }
                }
              }
            });
          } else {
            // Enemy bullet hit Player
            const dx = bullet.x - player.x;
            const dy = bullet.y - player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < bullet.radius + player.radius) {
              bullet.damage = 0; // Clear bullet

              if (!player.isInvulnerable) {
                player.health -= 15;
                audio.play('player_hit');
                
                // Flash invul red briefly
                player.isInvulnerable = true;
                player.invulnerableTime = 40; // ~0.66s flicker protection

                spawnExplosion(player.x, player.y, '#f43f5e', 8, false);
                triggerFloatingText("-15 SHIELD", player.x, player.y - 25, '#f43f5e');

                if (player.health <= 0) {
                  triggerPlayerGameOver();
                }
              } else {
                // Absorbed by defensive shields
                audio.play('enemy_hit');
                spawnExplosion(bullet.x, bullet.y, '#a855f7', 4, true);
                triggerFloatingText("SHIELDED BLOCK", player.x, player.y - 25, '#c084fc');
              }
            }
          }
        }
      });

      // Clear spent/decayed bullets
      bulletsRef.current = bulletsRef.current.filter(b => b.damage > 0);

      // 12. Enemy body ramming to Player body Collisions
      enemiesRef.current.forEach((enemy) => {
        if (enemy.health <= 0) return;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < enemy.radius + player.radius) {
          // Destroy enemy on physical ramming trigger
          enemy.health = 0;
          audio.play('enemy_death');
          spawnExplosion(enemy.x, enemy.y, enemy.color, 14, true);

          if (!player.isInvulnerable) {
            player.health -= 25; // Large collision hit
            audio.play('player_hit');
            player.isInvulnerable = true;
            player.invulnerableTime = 60; // 1s protection

            triggerFloatingText("-25 PHYSICAL RAM", player.x, player.y - 25, '#f43f5e');

            if (player.health <= 0) {
              triggerPlayerGameOver();
            }
          } else {
            // Shield blocks contact damage
            triggerFloatingText("SHIELD CRUSH", player.x, player.y - 25, '#a855f7');
          }
        }
      });

      // Clean dead enemies from registry
      enemiesRef.current = enemiesRef.current.filter((e) => e.health > 0);

      // 13. Particle states decay update
      const nextParticles: Particle[] = [];
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha > 0) {
          nextParticles.push(p);
        }
      });
      particlesRef.current = nextParticles;

      // 14. Floating texts update
      const nextFloatingTexts: FloatingText[] = [];
      floatingTextsRef.current.forEach((ft) => {
        ft.y -= 0.8;
        ft.timer--;
        if (ft.timer > 0) {
          ft.alpha = ft.timer / 45;
          nextFloatingTexts.push(ft);
        }
      });
      floatingTextsRef.current = nextFloatingTexts;

      // 14b. Multiplayer synchronization & LERP smoothing
      const currentActiveRoomId = activeRoomIdRef.current;
      const currentActiveMyId = activeMyIdRef.current;

      if (currentActiveRoomId && currentActiveMyId) {
        // Send state throttled to once every 130 milliseconds to stay within standard Firestore write capacity!
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 130) {
          lastSyncTimeRef.current = now;
          const isLocalFiring = 
            stateRef.current.keys['Space'] || 
            stateRef.current.keys[' '] ||
            stateRef.current.rightJoystickActive || 
            stateRef.current.mobileFireActive || 
            false;

          updatePlayerState(currentActiveRoomId, currentActiveMyId, {
            x: playerRef.current.x,
            y: playerRef.current.y,
            angle: playerRef.current.angle,
            name: pilotNameRef.current, // use ref value
            color: playerRef.current.color,
            score: stateRef.current.score,
            // health: playerRef.current.health, // REMOVED: Authoritative server health is source of truth for health
            maxHealth: playerRef.current.maxHealth,
            isInvulnerable: playerRef.current.isInvulnerable,
            activePowerUp: stateRef.current.activePowerUp,
            isFiring: isLocalFiring && playerRef.current.health > 0, // only fire when alive
            lives: playerRef.current.health > 0 ? 1 : 0,
            status: 'playing',
            lastUpdatedAt: Date.now()
          }).catch((err) => console.warn("Firestore movement publish error: ", err));
        }

        // Spawn Bullets and update local Cooldowns for Remote Wingmen
        Object.values(remotePlayersRef.current).forEach((rp: any) => {
          if (rp.id === currentActiveMyId) return;

          // Process coordinate smoothing glide
          if (!lerpRemotePlayersRef.current[rp.id]) {
            lerpRemotePlayersRef.current[rp.id] = { x: rp.x || 0, y: rp.y || 0, angle: rp.angle || 0 };
          }
          const cached = lerpRemotePlayersRef.current[rp.id];
          
          // Safety check: if rp coordinates are NaN or undefined, skip lerp to prevent entity becoming invisible
          if (typeof rp.x === 'number' && typeof rp.y === 'number' && !isNaN(rp.x) && !isNaN(rp.y)) {
            cached.x += (rp.x - cached.x) * 0.15;
            cached.y += (rp.y - cached.y) * 0.15;
            
            // Angle rotational lerp (ensuring shortest path)
            if (typeof rp.angle === 'number' && !isNaN(rp.angle)) {
              let diff = rp.angle - cached.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              cached.angle += diff * 0.15;
            }
          }

          // Spacing out bullet shots
          if (!remoteShootCooldownsRef.current[rp.id]) {
            remoteShootCooldownsRef.current[rp.id] = 0;
          }
          if (remoteShootCooldownsRef.current[rp.id] > 0) {
            remoteShootCooldownsRef.current[rp.id]--;
          }

          if (rp.isFiring && remoteShootCooldownsRef.current[rp.id] <= 0 && rp.health > 0) {
            const bulletSpeed = 12;
            const hasSpread = rp.activePowerUp === 'spread';
            const hasRapid = rp.activePowerUp === 'rapid';
            const cooldownPeriod = hasRapid ? 7 : 17;
            const baseDmg = 15;
            const angle = rp.angle || 0;
            const bulletColor = '#f43f5e'; // Red bullets for remote players

            if (hasSpread) {
              const spreadAngles = [-0.18, 0, 0.18];
              spreadAngles.forEach((offset) => {
                const finalAngle = angle + offset;
                bulletsRef.current.push({
                  id: Math.random().toString(),
                  x: rp.x + Math.cos(angle) * 18,
                  y: rp.y + Math.sin(angle) * 18,
                  vx: Math.cos(finalAngle) * bulletSpeed,
                  vy: Math.sin(finalAngle) * bulletSpeed,
                  radius: 4,
                  damage: baseDmg,
                  isPlayer: true,
                  color: bulletColor,
                  isLocalPlayerBullet: false
                });
              });
            } else {
              bulletsRef.current.push({
                id: Math.random().toString(),
                x: rp.x + Math.cos(angle) * 18,
                y: rp.y + Math.sin(angle) * 18,
                vx: Math.cos(angle) * bulletSpeed,
                vy: Math.sin(angle) * bulletSpeed,
                radius: 4.5,
                damage: baseDmg,
                isPlayer: true,
                color: bulletColor,
                isLocalPlayerBullet: false
              });
            }

            audio.play('player_shoot');
            remoteShootCooldownsRef.current[rp.id] = cooldownPeriod;
          }
        });
      }

      // React sync
      updateReactStates();
    };

    // 15. Premium Procedural Canvas Drawer
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear the screen black
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // A. Drawing space scrolling stars backdrop
      starsRef.current.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Dynamic faint trails for faster stars
        if (star.speed > 1.2) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${star.alpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x, star.y - star.speed * 2);
          ctx.stroke();
        }
      });

      // B. Draw drifting PowerUps
      powerUpsRef.current.forEach((pw) => {
        // Draw double pulse ring
        const time = Date.now() / 200;
        const pulse = Math.sin(time) * 3;
        
        ctx.save();
        ctx.shadowBlur = 12;

        let pwColor = '#ef4444';
        let shortcutLabel = 'H';
        if (pw.type === 'spread') {
          pwColor = '#38bdf8';
          shortcutLabel = 'S';
        } else if (pw.type === 'rapid') {
          pwColor = '#eab308';
          shortcutLabel = 'R';
        } else if (pw.type === 'shield') {
          pwColor = '#a855f7';
          shortcutLabel = 'D';
        } else {
          pwColor = '#22c55e';
          shortcutLabel = '✚';
        }

        ctx.shadowColor = pwColor;
        ctx.fillStyle = `${pwColor}25`;
        ctx.strokeStyle = pwColor;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.radius + pulse / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.radius - 4, 0, Math.PI * 2);
        ctx.stroke();

        // Label center
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shortcutLabel, pw.x, pw.y);

        ctx.restore();
      });

      // B2. Draw Bricks (Sci-fi moving block barriers)
      bricksRef.current.forEach((br) => {
        ctx.save();
        ctx.translate(br.x, br.y);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = br.color;
        
        // Face fill (translucent sci-fi shield grid style)
        ctx.fillStyle = `${br.color}22`;
        ctx.strokeStyle = br.color;
        ctx.lineWidth = 3;
        
        const halfW = br.width / 2;
        const halfH = br.height / 2;
        
        // Draw main brick rectangle outer border
        ctx.beginPath();
        ctx.rect(-halfW, -halfH, br.width, br.height);
        ctx.fill();
        ctx.stroke();
        
        // Draw hazard diagonal stripes inside
        ctx.strokeStyle = `${br.color}44`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = -halfW + 5; i < halfW; i += 12) {
          ctx.moveTo(i, -halfH + 2);
          ctx.lineTo(i + 8, halfH - 2);
        }
        ctx.stroke();
        
        // Render a mini shield health line inside the brick for retro visual cues
        if (br.health < br.maxHealth) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.fillRect(-20, -2, 40, 4);
          ctx.fillStyle = br.color;
          ctx.fillRect(-20, -2, (br.health / br.maxHealth) * 40, 4);
        }
        
        ctx.restore();
      });

      // C0. Draw Remote Wingmen Players (Online Multiplayer)
      const currentRoomId = activeRoomIdRef.current;
      if (currentRoomId) {
        Object.values(remotePlayersRef.current).forEach((rp: any) => {
          // Safety check: Ensure rp actually has valid coordinates and ID before attempting to draw
          if (!rp || !rp.id) return;

          if (rp.health <= 0) {
            // Draw destroyed ship wreckage!
            ctx.save();
            ctx.translate(rp.x, rp.y);
            ctx.rotate(rp.angle);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#64748b';
            ctx.strokeStyle = '#475569';
            ctx.fillStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-12, -12);
            ctx.lineTo(-12, 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Render WRECKAGE beacon label
            ctx.save();
            ctx.fillStyle = '#f43f5e';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText("SQUADRON WRECKAGE", rp.x, rp.y - 28);
            ctx.restore();
            return;
          }

          const cached = lerpRemotePlayersRef.current[rp.id] || { x: rp.x, y: rp.y, angle: rp.angle };
          const isBlinking = rp.isInvulnerable && (Date.now() % 200 < 100);

          if (!isBlinking) {
            ctx.save();
            ctx.translate(cached.x, cached.y);
            ctx.rotate(cached.angle);

            // Ship neon skin based on player color
            const rpColor = '#f43f5e'; // Always red for remote players
            ctx.shadowBlur = 18;
            ctx.shadowColor = rp.activePowerUp ? '#ec4899' : rpColor;

            ctx.fillStyle = '#111827';
            ctx.strokeStyle = rp.activePowerUp ? '#f472b6' : rpColor;
            ctx.lineWidth = 3;

            ctx.beginPath();
            // Nose tip
            ctx.moveTo(22, 0);
            // Left wing
            ctx.lineTo(-18, -18);
            // Left inner jet engine
            ctx.lineTo(-12, -8);
            // Right inner jet
            ctx.lineTo(-12, 8);
            // Right wing
            ctx.lineTo(-18, 18);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Cockpit glass
            ctx.fillStyle = rp.color || '#ec4899';
            ctx.beginPath();
            ctx.moveTo(13, 0);
            ctx.lineTo(-2, -6);
            ctx.lineTo(-10, 0);
            ctx.lineTo(-2, 6);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // Shield bubble glow for remote wingman if active
            if (rp.isInvulnerable) {
              ctx.save();
              const shieldColor = rp.color || '#ec4899';
              ctx.shadowBlur = 15;
              ctx.shadowColor = shieldColor;
              ctx.strokeStyle = `${shieldColor}ee`;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(cached.x, cached.y, 30, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }

            // Draw floating HUD tags and shield meters above remote wingman
            ctx.save();
            ctx.fillStyle = '#fda4af';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`WINGMAN // ${rp.name.toUpperCase()}`, cached.x, cached.y - 28);

            // Mini shield health bar for remote player
            ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
            ctx.fillRect(cached.x - 20, cached.y - 24, 40, 3);
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(cached.x - 20, cached.y - 24, (rp.health / (rp.maxHealth || 100)) * 40, 3);
            ctx.restore();
          }
        });
      }

      // C. Draw Player Spaceship (Vector Art)
      const p = playerRef.current;
      if (stateRef.current.gameState === 'playing' || stateRef.current.gameState === 'paused') {
        if (p.health <= 0) {
          // Draw destroyed ship wreckage!
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#64748b';
          ctx.strokeStyle = '#475569';
          ctx.fillStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(-12, -12);
          ctx.lineTo(-12, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Render local spectator/wreckage label
          ctx.save();
          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText("SQUADRON WRECKAGE (WAIT FOR NEXT WAVE)", p.x, p.y - 28);
          ctx.restore();
        } else {
          const isBlinking = p.isInvulnerable && p.invulnerableTime % 8 < 4;
          
          if (!isBlinking) {
          ctx.save();
          // Translate to player center to support rotation smoothly
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);

          // Add heavy plasma thrust glow
          ctx.shadowBlur = 18;
          ctx.shadowColor = stateRef.current.activePowerUp ? '#fbbf24' : '#38bdf8';

          // Body silhouette (Futuristic Stealth Fighter triangle)
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = stateRef.current.activePowerUp ? '#fbbf24' : '#38bdf8';
          ctx.lineWidth = 3;

          ctx.beginPath();
          // Nose tip
          ctx.moveTo(p.radius + 4, 0);
          // Left wing tail
          ctx.lineTo(-p.radius, -p.radius);
          // Left inner jet engine
          ctx.lineTo(-p.radius + 6, -p.radius + 10);
          // Right inner jet engine
          ctx.lineTo(-p.radius + 6, p.radius - 10);
          // Right wing tail
          ctx.lineTo(-p.radius, p.radius);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Fancy central glass cockpit
          ctx.fillStyle = p.color || '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(p.radius - 5, 0);
          ctx.lineTo(-2, -6);
          ctx.lineTo(-10, 0);
          ctx.lineTo(-2, 6);
          ctx.closePath();
          ctx.fill();

          // Left wing glow decal
          ctx.strokeStyle = p.color || '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-5, -10);
          ctx.lineTo(-p.radius + 3, -p.radius + 3);
          ctx.stroke();

          // Right wing glow decal
          ctx.beginPath();
          ctx.moveTo(-5, 10);
          ctx.lineTo(-p.radius + 3, p.radius - 3);
          ctx.stroke();

          ctx.restore();

          // Render active auxiliary shields
          if (p.isInvulnerable && p.invulnerableTime > 40) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#c084fc';
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 12, 0, Math.PI * 2);
            ctx.stroke();

            // Intermittent glowing sector lines
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
            ctx.lineWidth = 1;
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(p.x + Math.cos(angle) * p.radius, p.y + Math.sin(angle) * p.radius);
              ctx.lineTo(p.x + Math.cos(angle) * (p.radius + 12), p.y + Math.sin(angle) * (p.radius + 12));
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
    }

      // D. Draw Enemies
      enemiesRef.current.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.angle);

        ctx.shadowBlur = 10;
        ctx.shadowColor = enemy.color;
        ctx.strokeStyle = enemy.color;
        ctx.lineWidth = 2.5;
        // Deep body filling
        ctx.fillStyle = '#0f172a';

        if (enemy.type === 'kamikaze') {
          // Yellow Aggressive spikes/blade shape
          ctx.beginPath();
          ctx.moveTo(enemy.radius + 6, 0);
          ctx.lineTo(-enemy.radius, -enemy.radius);
          ctx.lineTo(-enemy.radius + 4, 0);
          ctx.lineTo(-enemy.radius, enemy.radius);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Yellow core flame
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(-2, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (enemy.type === 'evader') {
          // Orange spinning shield disc vector
          const ringAngle = (Date.now() / 150) % (Math.PI * 2);
          ctx.fillStyle = '#1e1c2a';
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw orbiting blades relative to body spinning angle
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const spin = ringAngle + (i * Math.PI) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius + 2, spin, spin + Math.PI / 5);
            ctx.stroke();
          }

          // Small core eye
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (enemy.type === 'ranger') {
          // Purple heavy ship with dual-wing cannons
          ctx.beginPath();
          ctx.moveTo(enemy.radius + 3, 0);
          ctx.lineTo(-enemy.radius + 2, -enemy.radius);
          ctx.lineTo(-enemy.radius, -enemy.radius + 8);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-enemy.radius, enemy.radius - 8);
          ctx.lineTo(-enemy.radius + 2, enemy.radius);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draw dual side laser turrets
          ctx.fillStyle = '#c084fc';
          ctx.fillRect(2, -enemy.radius - 3, 6, 3);
          ctx.fillRect(2, enemy.radius, 6, 3);
        }
        else { // Chaser standard bug fighter
          ctx.beginPath();
          // Bug claws
          ctx.moveTo(enemy.radius + 2, 0);
          ctx.lineTo(-enemy.radius + 2, -enemy.radius + 2);
          ctx.lineTo(-enemy.radius, 0);
          ctx.lineTo(-enemy.radius + 2, enemy.radius - 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Glowing danger red core
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(5, -2);
          ctx.lineTo(5, 2);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();

        // E. Draw floating health bars above each damaged enemy
        if (enemy.health < enemy.maxHealth) {
          const barW = enemy.radius * 2;
          const barH = 4;
          const barX = enemy.x - enemy.radius;
          const barY = enemy.y - enemy.radius - 12;

          // Background red strip
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(barX, barY, barW, barH);

          // Green remaining health
          const pct = Math.max(0, enemy.health / enemy.maxHealth);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(barX, barY, barW * pct, barH);
        }
      });

      // F. Draw Bullets (lasers)
      bulletsRef.current.forEach((b) => {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.strokeStyle = b.color;
        ctx.fillStyle = b.color;

        // Custom linear streak laser render instead of naive circles
        const len = 12;
        const angle = Math.atan2(b.vy, b.vx);

        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        ctx.lineWidth = b.radius;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.restore();
      });

      // G. Draw Particles (Debris explosion trails)
      particlesRef.current.forEach((p) => {
        ctx.save();
        if (p.glow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // H. Draw Drifting floating text point markers
      floatingTextsRef.current.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px "JetBrains Mono", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // Render a pilot status overlay if in multiplayer but alone (Waiting for someone to join the match)
      if (activeRoomIdRef.current && stateRef.current.gameState === 'playing' && stateRef.current.roomGameMode !== 'coop' && Object.keys(remotePlayersRef.current).length === 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(LOGICAL_WIDTH / 2 - 190, 110, 380, 55);
        ctx.strokeStyle = '#38bdf888';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(LOGICAL_WIDTH / 2 - 190, 110, 380, 55);
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stateRef.current.roomGameMode === 'coop' ? "WAITING FOR WINGMAN SIGNAL..." : "WAITING FOR OPPONENT SIGNAL...", LOGICAL_WIDTH / 2, 137);
        ctx.restore();
      }
    };

    // Initial stars generator
    initStars();

    // Trigger loop ignition
    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [muted, highScore]);

  // Handle pointer coordinate updates mapped precisely to logical coordinate resolution
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || gameState !== 'playing') return;
    const rect = containerRef.current.getBoundingClientRect();
    const physicalX = e.clientX - rect.left;
    const physicalY = e.clientY - rect.top;

    // Direct proportional scale mapping logic
    const logicalX = (physicalX / rect.width) * LOGICAL_WIDTH;
    const logicalY = (physicalY / rect.height) * LOGICAL_HEIGHT;

    stateRef.current.mousePos = { x: logicalX, y: logicalY };
  };

  // Click triggers fire player bullet
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState === 'playing' && e.button === 0) {
      firePlayerBullet();
    }
  };

  // Handle touch events dynamically on mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;
    
    // Prevent default touch behaviors (e.g., scroll, screen bounce)
    if (e.cancelable) {
      e.preventDefault();
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const relativeX = touch.clientX - rect.left;
      const isLeftHalf = relativeX < rect.width / 2;

      if (isLeftHalf) {
        // Start left virtual movement joystick if not already assigned
        if (stateRef.current.leftTouchId === null) {
          stateRef.current.leftTouchId = touch.identifier;
          stateRef.current.leftJoystickActive = true;
          stateRef.current.leftJoystickStart = { x: touch.clientX, y: touch.clientY };
          stateRef.current.leftJoystickCurrent = { x: touch.clientX, y: touch.clientY };
          stateRef.current.leftJoystickVector = { x: 0, y: 0 };

          setLeftJoystickState({
            active: true,
            start: { x: touch.clientX, y: touch.clientY },
            current: { x: touch.clientX, y: touch.clientY }
          });
        }
      } else {
        // Start right virtual direction joystick if not already assigned
        if (stateRef.current.rightTouchId === null) {
          stateRef.current.rightTouchId = touch.identifier;
          stateRef.current.rightJoystickActive = true;
          stateRef.current.rightJoystickStart = { x: touch.clientX, y: touch.clientY };
          stateRef.current.rightJoystickCurrent = { x: touch.clientX, y: touch.clientY };
          stateRef.current.rightJoystickVector = { x: 0, y: 0 };

          setRightJoystickState({
            active: true,
            start: { x: touch.clientX, y: touch.clientY },
            current: { x: touch.clientX, y: touch.clientY }
          });
        }
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;
    if (e.cancelable) {
      e.preventDefault();
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];

      if (touch.identifier === stateRef.current.leftTouchId) {
        // Movement joystick slide calculation
        const start = stateRef.current.leftJoystickStart;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const dist = Math.hypot(dx, dy);

        const maxDrag = 55; // Drag distance in pixels
        let finalX = touch.clientX;
        let finalY = touch.clientY;

        if (dist > maxDrag) {
          finalX = start.x + (dx / dist) * maxDrag;
          finalY = start.y + (dy / dist) * maxDrag;
        }

        stateRef.current.leftJoystickCurrent = { x: finalX, y: finalY };

        // Scale vector output from -1 to 1 range
        stateRef.current.leftJoystickVector = {
          x: (finalX - start.x) / maxDrag,
          y: (finalY - start.y) / maxDrag
        };

        setLeftJoystickState({
          active: true,
          start: start,
          current: { x: finalX, y: finalY }
        });
      } else if (touch.identifier === stateRef.current.rightTouchId) {
        // Face Direction joystick slide calculation
        const start = stateRef.current.rightJoystickStart;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const dist = Math.hypot(dx, dy);

        const maxDrag = 55; // Drag distance in pixels
        let finalX = touch.clientX;
        let finalY = touch.clientY;

        if (dist > maxDrag) {
          finalX = start.x + (dx / dist) * maxDrag;
          finalY = start.y + (dy / dist) * maxDrag;
        }

        stateRef.current.rightJoystickCurrent = { x: finalX, y: finalY };

        // Scale vector output from -1 to 1 range
        stateRef.current.rightJoystickVector = {
          x: (finalX - start.x) / maxDrag,
          y: (finalY - start.y) / maxDrag
        };

        setRightJoystickState({
          active: true,
          start: start,
          current: { x: finalX, y: finalY }
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'playing') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === stateRef.current.leftTouchId) {
        stateRef.current.leftTouchId = null;
        stateRef.current.leftJoystickActive = false;
        stateRef.current.leftJoystickVector = { x: 0, y: 0 };
        setLeftJoystickState({ active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });
      } else if (touch.identifier === stateRef.current.rightTouchId) {
        stateRef.current.rightTouchId = null;
        stateRef.current.rightJoystickActive = false;
        stateRef.current.rightJoystickVector = { x: 0, y: 0 };
        setRightJoystickState({ active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });
      }
    }
  };

  // Adapt size dynamically so canvas preserves exactly 16:9 ratio centered neatly or covers screen on mobile
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parentWidth = window.innerWidth;
      const parentHeight = window.innerHeight;

      // Fit 100% of the available viewport area to be edge-to-edge
      const maxW = parentWidth;
      const maxH = parentHeight;

      // Check if user is on mobile
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || parentWidth < 1024;

      let width = maxW;
      let height = maxH;

      if (!isMobile) {
        // Solve for 16:9 ratio on desktop to feel like a neat console
        height = maxW * (9 / 16);
        if (height > maxH) {
          height = maxH;
          width = maxH * (16 / 9);
        }
      }

      setContainerDimensions({
        width: Math.floor(width),
        height: Math.floor(height)
      });

      // Force match high display pixel ratio
      const dpr = window.devicePixelRatio || 1;
      canvas.width = LOGICAL_WIDTH * dpr;
      canvas.height = LOGICAL_HEIGHT * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [gameState, isFullscreen]);

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] w-full h-full select-none overflow-hidden flex flex-col items-center justify-center p-0">
      {/* Starfield & Nebula Background (Frosted Glass Theme) */}
      <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,transparent_50%)]" />
        <div className="absolute top-[20%] right-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle_at_50%_50%,#312e81_0%,transparent_60%)]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)', backgroundSize: '50px 50px', opacity: 0.15 }} />
      </div>

      {/* 16:9 Landscape Video game frame with glass HUD HUD-overlays */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative bg-[#020617]/95 overflow-hidden border-0 lg:border lg:border-white/10 lg:rounded-2xl flex items-center justify-center touch-none select-none max-w-full"
        style={{ 
          cursor: gameState === 'playing' ? 'crosshair' : 'default',
          width: containerDimensions.width ? `${containerDimensions.width}px` : '100vw',
          height: containerDimensions.height ? `${containerDimensions.height}px` : '100vh'
        }}
        id="canvas-game-container"
      >
        {/* Real HTML5 Canvas */}
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />          {gameState === 'playing' && (
            <div className="absolute top-0 inset-x-0 p-4 pointer-events-none select-none flex items-start justify-between z-10">
              
              {/* LEFT SIDE: LOCAL PLAYER HP (Frosted Glass) */}
              <div className="flex flex-col gap-1.5 border border-cyan-500/20 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(6,182,212,0.3)] min-w-[180px] pointer-events-auto">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-cyan-400 font-bold tracking-wider uppercase">
                    Y O U (CORE HP)
                  </span>
                  <span className="font-mono text-sm text-white font-extrabold">{playerHealth}%</span>
                </div>
                
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-all duration-300"
                    style={{ width: `${playerHealth}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                   <div className="bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-400/20 text-[8px] text-cyan-300 font-mono font-bold uppercase">
                     {score} CREDITS
                   </div>
                   <div className="text-[8px] text-slate-400 font-mono font-semibold">
                     WAVE {waveNum}
                   </div>
                </div>
              </div>

              {/* CENTER: ACTIVE POWER-UP INDICATOR */}
              <div className="flex flex-col items-center">
                {stateRef.current.activePowerUp && (
                  <div className="flex items-center gap-2 bg-white/10 border border-amber-500/40 rounded-full px-4 py-1.5 shadow-lg backdrop-blur-md animate-bounce">
                    <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span className="font-mono text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                      {stateRef.current.activePowerUp === 'spread' ? "SPREAD FIRE" : stateRef.current.activePowerUp === 'rapid' ? "HYPER GUN" : "INVULNERABLE SHIELD"} ACTIVE ({Math.ceil(stateRef.current.powerUpTimer / 60)}s)
                    </span>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: REMOTE PLAYER HP AND SETTINGS */}
              <div className="flex flex-col items-end gap-3">
                {activeRoomId && (
                  <div className="flex flex-col gap-2 border border-rose-500/20 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(244,63,94,0.3)] min-w-[180px]">
                    {Object.values(remotePlayers).map((rp: any) => {
                      if (rp.id === activeMyId) return null;
                      return (
                        <div key={rp.id} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-rose-400 font-bold tracking-wider uppercase truncate max-w-[100px]">
                              {rp.name ? rp.name.toUpperCase() : 'OPPONENT'}
                            </span>
                            <span className={rp.health > 0 ? "font-mono text-sm text-white font-extrabold" : "text-rose-500 font-bold text-[10px]"}>
                              {rp.health > 0 ? `${rp.health}%` : "DESTROYED"}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)] transition-all duration-300"
                              style={{ width: `${Math.max(0, rp.health)}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <div className="bg-rose-500/10 px-2 py-0.5 rounded border border-rose-400/20 text-[8px] text-rose-300 font-mono font-bold uppercase">
                              {rp.score || 0} CREDITS
                            </div>
                            {rp.kills !== undefined && (
                              <div className="text-[8px] text-slate-500 font-mono font-bold uppercase text-right">
                                Kills: {rp.kills}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => {
                    setGameState('paused');
                    stateRef.current.gameState = 'paused';
                  }}
                  className="flex items-center justify-center p-3 rounded-2xl bg-black/50 hover:bg-white/15 border border-white/10 text-cyan-400 hover:text-cyan-300 shadow-xl pointer-events-auto cursor-pointer transition-all hover:scale-105 active:scale-95"
                  title="System Options"
                  id="btn-open-settings-hud"
                >
                  <Settings className="h-5 w-5 animate-spin" style={{ animationDuration: '15s' }} />
                </button>
              </div>
            </div>
          )}

          {/* SYSTEM NOTICE BANNER */}
          {systemNotice && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 animate-bounce pointer-events-none">
              <div className="bg-rose-950/95 border border-rose-500/50 rounded-full px-5 py-2 shadow-[0_0_20px_rgba(244,63,94,0.35)] backdrop-blur-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-mono text-xs font-extrabold text-rose-300 uppercase tracking-widest whitespace-nowrap">
                  {systemNotice}
                </span>
              </div>
            </div>
          )}

          {/* LARGE WAVE BANNER NOTIFIER */}
          {waveBanner && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
              <div className="border-y border-white/10 py-5 w-full text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all">
                <h2 className="font-sans text-3xl font-black tracking-[0.4em] text-cyan-300 uppercase drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-pulse">
                  {waveBanner}
                </h2>
                <p className="font-sans text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1.5">
                  BRACE FOR AGGRESSIVE HOSTILE WAVEFORMS
                </p>
              </div>
            </div>
          )}

          {/* LEFT VIRTUAL JOYSTICK FOR MOBILE */}
          {leftJoystickState.active && containerRef.current && (
            <div 
              className="absolute z-20 rounded-full border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center pointer-events-none"
              style={{
                left: leftJoystickState.start.x - containerRef.current.getBoundingClientRect().left - 50,
                top: leftJoystickState.start.y - containerRef.current.getBoundingClientRect().top - 50,
                width: 100,
                height: 100,
              }}
            >
              {/* Center thumb trigger stick */}
              <div 
                className="absolute w-12 h-12 rounded-full border border-white/20 shadow-md flex items-center justify-center animate-pulse"
                style={{
                  left: leftJoystickState.current.x - leftJoystickState.start.x + 50 - 24,
                  top: leftJoystickState.current.y - leftJoystickState.start.y + 50 - 24,
                }}
              >
                <div className="w-5 h-5 rounded-full bg-white/25" />
              </div>
            </div>
          )}

          {/* RIGHT VIRTUAL JOYSTICK FOR MOBILE */}
          {rightJoystickState.active && containerRef.current && (
            <div 
              className="absolute z-20 rounded-full border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] flex items-center justify-center pointer-events-none"
              style={{
                left: rightJoystickState.start.x - containerRef.current.getBoundingClientRect().left - 50,
                top: rightJoystickState.start.y - containerRef.current.getBoundingClientRect().top - 50,
                width: 100,
                height: 100,
              }}
            >
              {/* Center thumb trigger stick */}
              <div 
                className="absolute w-12 h-12 rounded-full border border-white/20 shadow-md flex items-center justify-center animate-pulse"
                style={{
                  left: rightJoystickState.current.x - rightJoystickState.start.x + 50 - 24,
                  top: rightJoystickState.current.y - rightJoystickState.start.y + 50 - 24,
                }}
              >
                <div className="w-5 h-5 rounded-full bg-white/25" />
              </div>
            </div>
          )}

          {/* PORTRAIT MOUNT WARNING HELPER */}
          <LandscapeNotice />

          {/* START OVERLAY VIEW SCREEN */}
          {gameState === 'start' && (
            <div className="absolute inset-0 w-full h-full z-10 flex flex-col items-center justify-start bg-[#020617]/95 text-center p-3 sm:p-6 backdrop-blur-xl overflow-y-auto max-h-full pt-4 pb-8">
              
              {/* TAB SELECTION CONSOLE */}
              <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-3 sm:mb-6 gap-2 shrink-0">
                <button
                  onClick={() => setStartOverlayTab('home')}
                  className={`px-4 sm:px-5 py-1.5 rounded-xl font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${
                    startOverlayTab === 'home' 
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  id="tab-briefing"
                >
                  GAMING
                </button>
                <button
                  onClick={() => {
                    setStartOverlayTab('leaderboard');
                    fetchLeaderboard();
                  }}
                  className={`px-4 sm:px-5 py-1.5 rounded-xl font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${
                    startOverlayTab === 'leaderboard' 
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  id="tab-records"
                >
                  RECORDS
                </button>
              </div>

              {startOverlayTab === 'home' ? (
                <>
                  <div className="relative mb-3 sm:mb-5 h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-75 blur animate-pulse" />
                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-950 border border-white/10">
                      <Cpu className="h-5 w-5 sm:h-7 sm:w-7 text-cyan-400 animate-pulse" />
                    </div>
                  </div>

                  <h2 className="font-sans text-xl sm:text-3xl font-extrabold tracking-widest text-white uppercase mb-1 sm:mb-2 shrink-0">
                    THE SPACE <span className="text-cyan-400">SHOOTER</span>
                  </h2>
                  <p className="font-sans text-[10px] sm:text-xs text-slate-300 max-w-xs sm:max-w-sm leading-normal sm:leading-relaxed mb-4 sm:mb-6 shrink-0">
                    Evade incoming hostile swarm waves. Track alignment to point of intercept and incinerate targets.
                  </p>

                  {/* Start & Exit Game Action Panel */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-2xl px-2 shrink-0">
                    <button
                      onClick={() => {
                        requestAppFullscreen();
                        startGame();
                      }}
                      className="group relative cursor-pointer font-extrabold w-full py-2.5 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-sans text-[10px] sm:text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
                      id="btn-start"
                    >
                      <Play className="h-3 w-3 fill-white" /> single
                    </button>

                    <button
                      onClick={() => {
                        setLobbyMode('pvp');
                        setShowInnerLobby(true);
                      }}
                      className="cursor-pointer font-extrabold w-full py-2.5 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-sans text-[10px] sm:text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
                      id="btn-pvp-menu"
                    >
                      <Target className="h-3 w-3 text-red-400" /> PvP
                    </button>

                    <button
                      onClick={() => {
                        setLobbyMode('coop');
                        setShowInnerLobby(true);
                      }}
                      className="cursor-pointer font-extrabold w-full py-2.5 sm:py-3.5 px-4 rounded-xl border border-pink-500/20 bg-pink-950/20 hover:bg-pink-900/30 text-pink-300 font-sans text-[10px] sm:text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(236,72,153,0.1)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
                      id="btn-coop-menu"
                    >
                      <Users className="h-3 w-3 text-pink-400" /> Play with Bro
                    </button>

                    {onExitBack && (
                      <button
                        onClick={handleCleanExit}
                        className="cursor-pointer font-bold w-full py-2.5 sm:py-3.5 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 font-sans text-[10px] sm:text-[11px] uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
                        id="btn-lobby-exit"
                      >
                        <Home className="h-3 w-3 text-slate-500" /> Exit
                      </button>
                    )}
                  </div>

                  {/* Simple instructional cheat sheet */}
                  <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-1.5 sm:gap-y-2 mt-4 sm:mt-8 border-t border-white/10 pt-3 sm:pt-5 text-left max-w-sm w-full shrink-0">
                    {isTouchCapable ? (
                      <>
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[9px] uppercase">
                          <span className="bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-400/25 px-1.5 py-0.5 font-bold">L-THUMB</span>
                          <span>Move Ship</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[9px] uppercase">
                          <span className="bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-400/25 px-1.5 py-0.5 font-bold">R-THUMB</span>
                          <span>Aim / Shoot</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[9px] uppercase">
                          <span className="bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-400/25 px-1.5 py-0.5 font-bold">AUTO-AIM</span>
                          <span>Target swarms</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[9px] uppercase">
                          <span className="bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-400/25 px-1.5 py-0.5 font-bold">PAUSE</span>
                          <span>Top HUD-bar</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 text-slate-300 font-mono text-[10px] uppercase">
                          <span className="bg-white/10 rounded-md border border-white/10 px-1.5 py-0.5 text-white font-bold">W A S D</span>
                          <span>Flight Vectors</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-300 font-mono text-[10px] uppercase">
                          <span className="bg-white/10 rounded-md border border-white/10 px-1.5 py-0.5 text-white font-bold">SPACE</span>
                          <span>Fire Lasers</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-300 font-mono text-[10px] uppercase">
                          <span className="bg-white/10 rounded-md border border-white/10 px-1.5 py-0.5 text-white font-bold">MOUSE</span>
                          <span>Face Cursor</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-300 font-mono text-[10px] uppercase">
                          <span className="bg-white/10 rounded-md border border-white/10 px-1.5 py-0.5 text-white font-bold">ESC / P</span>
                          <span>Pause Game</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* WORLDWIDE LIVE LEADERBOARD SHOWCASE */}
                  <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl mb-6 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="h-5 w-5 text-amber-400 animate-pulse" />
                      <h3 className="text-cyan-400 font-sans text-sm font-bold uppercase tracking-[0.2em]">
                        GALACTIC HALL OF FAME
                      </h3>
                    </div>
                    
                    {loadingLeaderboard ? (
                      <div className="flex flex-col items-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
                        <span className="text-xs text-slate-400 mt-2 font-mono uppercase">SYNCING CORES...</span>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="py-8 text-slate-400 font-mono text-xs uppercase text-center">
                        NO RECORDS SYNCED YET.<br />BE THE FIRST PILOT OF THE SECTOR!
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {leaderboard.map((entry, idx) => {
                          const isSelf = auth.currentUser?.uid === entry.userId || getOrCreateVisitorId() === entry.userId;
                          const indexValue = idx + 1;
                          return (
                            <div 
                              key={entry.id || idx} 
                              className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${
                                isSelf 
                                  ? 'bg-cyan-500/15 border-cyan-500/40' 
                                  : 'bg-white/5 border-transparent hover:border-white/10'
                              } transition-all`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`font-mono text-xs w-5 text-center font-bold ${
                                  indexValue === 1 ? 'text-amber-400' : indexValue === 2 ? 'text-slate-300' : indexValue === 3 ? 'text-orange-400' : 'text-slate-500'
                                }`}>
                                  #{indexValue}
                                </span>
                                
                                {entry.socialUrl ? (
                                  <a 
                                    href={entry.socialUrl.startsWith('http') ? entry.socialUrl : `https://${entry.socialUrl}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="font-sans font-extrabold text-[#22d3ee] hover:text-[#e0f2fe] transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                                    title="Click to view pilot's neural profile"
                                  >
                                    {entry.playerName}
                                    <Sparkles className="h-3 w-3 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                                  </a>
                                ) : (
                                  <span className="font-sans font-medium text-slate-200">
                                    {entry.playerName}
                                  </span>
                                )}
                              </div>
                              
                              <span className="font-mono font-bold text-white tracking-wider">
                                {entry.score} CR
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setStartOverlayTab('home')}
                    className="cursor-pointer font-bold py-2.5 px-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 uppercase tracking-widest transition-all"
                  >
                    BACK TO GAMING
                  </button>
                </>
              )}
            </div>
          )}

          {/* INNER CO-OP/PVP LOBBY OVERLAY MODAL */}
          {showInnerLobby && (
            <div className="absolute inset-0 z-40 bg-[#020617] overflow-y-auto flex flex-col items-center justify-center p-3 sm:p-6 backdrop-blur-xl">
              <div className="w-full max-w-4xl">
                <MultiplayerLobby
                  initialPilotName={pilotName}
                  lobbyMode={lobbyMode}
                  onLaunchMultiplayer={(roomId, myId, isHost) => {
                    setLocalRoomId(roomId);
                    setLocalMyId(myId);
                    setLocalIsHost(isHost);
                    setShowInnerLobby(false);
                    requestAppFullscreen();
                    startGame();
                  }}
                  onBack={() => {
                    setShowInnerLobby(false);
                  }}
                />
              </div>
            </div>
          )}

          {/* PAUSED GAME STATE SCREEN & WEAPON DATABASE */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 z-30 flex flex-col justify-start bg-slate-950/95 p-4 sm:p-6 md:p-8 backdrop-blur-2xl overflow-y-auto max-h-full">
              
              {/* HEADER CONSOLE */}
              <div className="flex flex-col sm:flex-row justify-between items-center border-b border-cyan-500/20 pb-4 mb-6 gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-cyan-950/50 border border-cyan-400/30 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div className="text-left">
                    <h2 className="font-sans text-lg font-black tracking-widest text-[#f8fafc] uppercase">
                      SYSTEM CONSOLE <span className="text-cyan-400">&amp; SETTINGS</span>
                    </h2>
                    <p className="font-mono text-[8px] sm:text-[9px] text-cyan-300 font-bold uppercase tracking-widest mt-0.5">
                      COCKPIT HUD SYSTEM DIAGNOSTICS
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-400/20 px-3 py-1 rounded-xl text-amber-300 font-mono text-[10px] font-bold">
                    <Trophy className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span>HIGH RECORD: {highScore}</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/50 border border-emerald-400/20 px-3 py-1 rounded-md font-bold uppercase tracking-wider">
                    SIMULATOR FREEZE ACTIVE
                  </span>
                </div>
              </div>

              {/* TWO COLUMN GRID LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-grow">
                
                {/* COLUMN 1: INTERACTIVE SETTINGS (5/12 widths) */}
                <div className="lg:col-span-5 flex flex-col gap-4 text-left">
                  
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <h3 className="font-sans text-[11px] font-extrabold text-[#22d3ee] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" /> Flight Calibration
                    </h3>

                    {/* Sound toggle setting */}
                    <div className="flex items-center justify-between py-2 border-b border-slate-800">
                      <div>
                        <span className="font-sans text-xs font-bold text-slate-200 block">AUDIO COCKPIT MODULE</span>
                        <p className="font-sans text-[9px] text-slate-400">Synthesizer laser and wave alert sounds.</p>
                      </div>
                      <button
                        onClick={toggleMute}
                        className={`font-mono text-[10px] font-black py-1.5 px-3 rounded-lg border cursor-pointer transition-all flex items-center gap-1 ${
                          !muted 
                            ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.2)]' 
                            : 'bg-rose-950/40 border-rose-500/20 text-rose-300'
                        }`}
                        id="btn-settings-mute"
                      >
                        {!muted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                        <span>{!muted ? "MUTED: NO" : "MUTED: YES"}</span>
                      </button>
                    </div>

                    {/* Fullscreen Option */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-sans text-xs font-bold text-slate-200 block">TACTICAL DISPLAY PANELS</span>
                        <p className="font-sans text-[9px] text-slate-400">Expand the cockpit layout to fill screen boundaries.</p>
                      </div>
                      <button
                        onClick={toggleFullscreen}
                        className="font-mono text-[10px] font-black py-1.5 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-slate-300 cursor-pointer transition-all flex items-center gap-1"
                        id="btn-settings-fullscreen"
                      >
                        {isFullscreen ? <Minimize className="h-3.5 w-3.5 text-cyan-400" /> : <Maximize className="h-3.5 w-3.5 text-cyan-400" />}
                        <span>{isFullscreen ? "BOUNDED" : "FULLSCREEN"}</span>
                      </button>
                    </div>

                  </div>

                  {/* ACTION TRIGGER SLATES */}
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setGameState('playing');
                        stateRef.current.gameState = 'playing';
                      }}
                      className="cursor-pointer font-extrabold w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white font-sans text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2"
                      id="btn-settings-resume"
                    >
                      <Play className="h-4 w-4 fill-current" /> RESUME ACTIVE DEFENSE
                    </button>

                    {!activeRoomId && lobbyMode !== 'coop' && (
                      <button
                        onClick={startGame}
                        className="cursor-pointer font-extrabold w-full py-2.5 px-6 rounded-xl border border-rose-500/20 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 font-sans text-xs uppercase tracking-widest transition-all"
                        id="btn-settings-restart"
                      >
                        REBOOT FLIGHT RECTIFIER
                      </button>
                    )}

                    <button
                      onClick={handleExitMatch}
                      className="cursor-pointer font-bold w-full py-2.5 px-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 font-sans text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      id="btn-settings-exit"
                    >
                      <Home className="h-3.5 w-3.5" /> {activeRoomId ? 'LEAVE MULTIPLAYER' : 'BACK TO MENU'}
                    </button>
                  </div>

                </div>

                {/* COLUMN 2: COMBAT INTELLIGENCE SYSTEM DICTIONARY (7/12 widths) */}
                <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-4 text-left overflow-y-auto max-h-[400px] lg:max-h-none">
                  <h3 className="font-sans text-[11px] font-extrabold text-[#22d3ee] uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <Zap className="h-4 w-4" /> Weapons &amp; Projectile Database
                  </h3>

                  {/* PLAYER AMMUNITION STATS (Player Bullet related info) */}
                  <div className="mb-5 bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                    <span className="font-mono text-[9px] text-cyan-400 uppercase font-extrabold tracking-widest block mb-2">
                      [MODULE A-01] PILOT INTERCEPTOR LASER BULLETS
                    </span>
                    <div className="grid grid-cols-2 xs:grid-cols-4 gap-3 font-mono text-[10px]">
                      <div>
                        <span className="text-slate-500 block uppercase text-[8px]">Core Shape</span>
                        <span className="text-slate-200">Linear Beam</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[8px]">Bullet Size</span>
                        <span className="text-slate-200 font-bold">4.0px Radius</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[8px]">Force Damage</span>
                        <span className="text-cyan-300 font-bold">15 HP Base</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[8px]">Velocity Speed</span>
                        <span className="text-slate-200">12.0 units/frame</span>
                      </div>
                    </div>
                    {/* Visual descriptions */}
                    <div className="mt-3 flex gap-2 items-center text-[9px] text-slate-400 border-t border-slate-800/60 pt-2 font-sans">
                      <div className="h-1.5 w-6 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      <span>Spread and Rapid Energy power-ups transform beam matrices into 3-directional spread patterns and accelerate firing cooldown checks from 17 to 7 ticks.</span>
                    </div>
                  </div>

                  {/* HOSTILE ENEMY PROJECTILE STATS (Enemy Bullet & collisions info) */}
                  <div className="mb-5 bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                    <span className="font-mono text-[9px] text-rose-400 uppercase font-extrabold tracking-widest block mb-1.5">
                      [MODULE B-02] HOSTILE WEAPONS &amp; EXPLOSIVE CONTEXT
                    </span>

                    <div className="space-y-3 font-mono text-[9px] text-slate-300">
                      <div className="flex justify-between items-start py-1 border-b border-slate-800/40">
                        <div>
                          <span className="text-slate-200 font-bold block uppercase text-[9px]">KAMIKAZE SHOCK DETONATION</span>
                          <span className="text-[8px] text-slate-500">Kamikaze seeker hull triggers collision.</span>
                        </div>
                        <span className="text-rose-400 font-bold bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/10">35 HP HULL DMG</span>
                      </div>

                      <div className="flex justify-between items-start py-1 border-b border-slate-800/40">
                        <div>
                          <span className="text-slate-200 font-bold block uppercase text-[9px]">EVADER PLASMA PLASMA CHARGE</span>
                          <span className="text-[8px] text-slate-500">Gold-colored fire orbs emitted periodically.</span>
                        </div>
                        <span className="text-amber-400 font-bold bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">10 HP DMG</span>
                      </div>

                      <div className="flex justify-between items-start py-1">
                        <div>
                          <span className="text-slate-200 font-bold block uppercase text-[9px]">RANGER FOCUS BEAM MISSILERY</span>
                          <span className="text-[8px] text-slate-500">Continuous high-velocity Crimson vector bolts.</span>
                        </div>
                        <span className="text-rose-400 font-bold bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/10">15 HP DMG</span>
                      </div>
                    </div>
                  </div>

                  {/* INDIVIDUAL HOSTILES INTEL */}
                  <div className="bg-slate-950/30 rounded-xl p-3 border border-white/5">
                    <span className="font-mono text-[9px] text-purple-400 uppercase font-extrabold tracking-widest block mb-2">
                      [MODULE C-03] INCOMING SENSOR FLEET CATALOGS
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] font-sans">
                      <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50">
                        <span className="text-red-400 font-mono font-bold block">CHASER CORVETTE [Red]</span>
                        <p className="text-slate-400">Tactically tracks pilot maneuvers. Health: 30 HP. Velocity: 2.0</p>
                      </div>
                      <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50">
                        <span className="text-orange-400 font-mono font-bold block">EVADER PHANTOM [Orange]</span>
                        <p className="text-slate-400">Moves dynamically to evade linear lasers. Health: 25 HP. Fires Yellow Orbs.</p>
                      </div>
                      <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50">
                        <span className="text-yellow-400 font-mono font-bold block">KAMIKAZE SEEKER [Yellow]</span>
                        <p className="text-slate-400">High accelerator core, orbits toward targets. Health: 15 HP. Triggers collision detonation.</p>
                      </div>
                      <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50">
                        <span className="text-purple-400 font-mono font-bold block">RANGER BATTLECRUISER [Purple]</span>
                        <p className="text-slate-400">Large weapon frame with reinforced plating. Health: 50 HP. Fires Crimson bolts.</p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* GAME OVER STATE VIEW SCREEN */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 w-full h-full z-30 flex flex-col items-center justify-start bg-[#020617]/90 text-center p-4 sm:p-6 backdrop-blur-xl overflow-y-auto max-h-full pt-4 pb-8">
              <div className="relative mb-4 flex flex-col items-center animate-pulse">
                <div className={`h-14 w-14 flex items-center justify-center rounded-full mb-2 ${
                  multiplayerWon 
                    ? "bg-emerald-950/65 border border-emerald-500/40 text-emerald-400" 
                    : "bg-rose-950/65 border border-rose-500/40 text-rose-400"
                }`}>
                  {multiplayerWon ? <Trophy className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
                </div>
                <span className={`font-mono text-[9px] font-bold tracking-[0.3em] uppercase ${
                  multiplayerWon ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {multiplayerWon ? "MISSION SUCCESS - SECURED SECTOR" : "SHIELD DEPLETED - CHIP FAILURE"}
                </span>
              </div>

              <h2 className={`font-sans text-2xl font-black tracking-widest uppercase mb-2 ${
                multiplayerWon ? "text-emerald-400" : "text-rose-500"
              }`}>
                {multiplayerWon ? "VICTORY" : "GAME OVER"}
              </h2>
              <p className="font-sans text-xs text-slate-300 max-w-sm mb-6">
                {multiplayerWon 
                  ? "Your opponent has left or has been vaporized in the duel. You emerge victorious!" 
                  : "Sector security has fallen. Spacecraft engine parameters critical."}
              </p>

              {/* End status indicators (score and wave survived) */}
              <div className="flex gap-4 mb-3 sm:mb-6 bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-4 min-w-[280px] sm:min-w-[320px] justify-around shadow-lg backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Credits</span>
                  <span className="font-mono text-lg font-extrabold text-[#38bdf8]">{score}</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/15 pl-4">
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Max Wave</span>
                  <span className="font-mono text-lg font-extrabold text-[#f97316]">#{waveNum}</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/15 pl-4">
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Swarm Kills</span>
                  <span className="font-mono text-lg font-extrabold text-rose-400">{enemiesKilled}</span>
                </div>
              </div>

              {/* SCORE SUBMISSION SYSTEM (Firebase Live) - HIDE IN MULTIPLAYER */}
              {score > 0 && !hasSubmitted && !activeRoomId && (
                <div className="w-full max-w-md mb-3 sm:mb-6 bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md text-left">
                  <h3 className="font-sans text-[11px] font-extrabold text-[#22d3ee] uppercase tracking-widest mb-3 text-center flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3 animate-spin text-cyan-400" style={{ animationDuration: '6s' }} />
                    Transmit score to global database
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                        Pilot Name
                      </label>
                      <input 
                        type="text" 
                        maxLength={25}
                        value={pilotName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPilotName(val);
                          localStorage.setItem('space_shooter_pilot_name', val);
                        }}
                        placeholder="PILOT DESIGNATION"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white uppercase tracking-widest outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Profile Link (Social URL)</span>
                        <span className="text-[8px] text-slate-500 italic">Optional</span>
                      </label>
                      <input 
                        type="text" 
                        maxLength={200}
                        value={socialUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSocialUrl(val);
                          localStorage.setItem('space_shooter_social_url', val);
                        }}
                        placeholder="E.G. TWITTER.COM/PILOT"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>
                  </div>

                  {submittingError && (
                    <div className="text-[9px] font-mono text-rose-400 uppercase text-center mb-2.5 bg-rose-950/20 rounded-lg p-2 border border-rose-950/30">
                      {submittingError}
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      if (!pilotName.trim()) {
                        setSubmittingError("PILOT DESIGNATION REQUIRED");
                        return;
                      }
                      setIsSubmitting(true);
                      setSubmittingError(null);
                      try {
                        await submitScore(pilotName, score, socialUrl);
                        setHasSubmitted(true);
                        await fetchLeaderboard();
                      } catch (err: any) {
                        console.warn("Submission failed: ", err);
                        setSubmittingError("TRANSMISSION OUTAGE. RETRY.");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="cursor-pointer font-extrabold w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-sans text-[10px] uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(6,182,212,0.2)]"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        <span>TRANSMITTING RADIAL LOGS...</span>
                      </>
                    ) : (
                      <span>UPLOAD PILOT RECORD</span>
                    )}
                  </button>
                </div>
              )}

              {hasSubmitted && (
                <div className="w-full max-w-md mb-6 bg-cyan-500/10 border border-cyan-400/20 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="font-mono text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
                      TRANSMISSION CONFIRMED
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-sans uppercase">
                    Your score has been logged onto the inter-system global leaderboards.
                  </p>
                </div>
              )}

              {declineMessage && (
                <div className="w-full max-w-md mb-6 bg-rose-500/10 border border-rose-400/20 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                      REQUEST DECLINED
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans uppercase font-bold">
                    the opponent decline you request
                  </p>
                  <button
                    onClick={() => {
                      setDeclineMessage(null);
                      if (activeRoomId) {
                        clearRematchState(activeRoomId).catch(console.warn);
                      }
                    }}
                    className="mt-2 text-[9px] text-cyan-400 hover:text-cyan-300 underline font-mono tracking-wider uppercase cursor-pointer block mx-auto"
                  >
                    DISMISS
                  </button>
                </div>
              )}

              {/* REWARDED AD ADMOB RECOVERY SYSTEM */}
              {!adRewardClaimed && (
                <div className="w-full max-w-md mb-4 bg-gradient-to-b from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-md text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                    <span className="font-mono text-[10px] font-black text-amber-300 uppercase tracking-widest">
                      CRITICAL RECOVERY BROADCAST
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-sans uppercase mb-4">
                    {!activeRoomId 
                      ? "Watch a short tactical broadcast to fully restore shields, clear nearby interceptors, and gain +500 Credits!" 
                      : "Watch a short tactical broadcast to receive an instant delivery of +500 system credits!"}
                  </p>

                  {!networkOnline ? (
                    <div className="w-full py-3 rounded-xl bg-slate-950/40 border border-rose-500/30 text-rose-400 font-sans font-extrabold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2">
                      <WifiOff className="h-4 w-4 text-rose-500" /> NO INTERNET (OFFLINE)
                    </div>
                  ) : (
                    <button
                      onClick={startAdWatch}
                      disabled={isAdLoading}
                      className="cursor-pointer font-extrabold w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-sans text-xs uppercase tracking-widest shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      id="btn-watch-ad"
                    >
                      {isAdLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-950" />
                          <span>ESTABLISHING FEED...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-slate-950 text-slate-950" />
                          <span>{!activeRoomId ? "WATCH AD TO REVIVE (+500 CREDITS)" : "WATCH AD (+500 CREDITS)"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                {activeRoomId ? (
                  <>
                    <button
                      onClick={() => {
                        if (activeRoomId && activeMyId) {
                          requestRematch(activeRoomId, activeMyId).catch(console.warn);
                        }
                      }}
                      disabled={rematchRequesterId === activeMyId && rematchStatus === 'pending'}
                      className="cursor-pointer font-extrabold py-3.5 px-9 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-900 text-white disabled:text-slate-500 font-sans text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:shadow-none transform hover:scale-105 active:scale-95 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
                      id="btn-play-again-multiplayer"
                    >
                      <RotateCcw className={`h-4 w-4 ${rematchRequesterId === activeMyId && rematchStatus === 'pending' ? 'animate-spin' : ''}`} />
                      {rematchRequesterId === activeMyId && rematchStatus === 'pending' ? "WAITING FOR OPPONENT..." : "PLAY AGAIN"}
                    </button>
                    <button
                      onClick={handleExitMatch}
                      className="cursor-pointer font-extrabold py-3.5 px-9 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-sans text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(244,63,94,0.3)] transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                      id="btn-leave-multiplayer-gameover"
                    >
                      <Home className="h-4 w-4" /> LEAVE MATCH
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startGame}
                      className="cursor-pointer font-extrabold py-3.5 px-9 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-sans text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(244,63,94,0.3)] transform hover:scale-105 active:scale-95 transition-all"
                      id="btn-restart-gameover"
                    >
                      <span className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" /> START NEW COMBAT
                      </span>
                    </button>
                    <button
                      onClick={handleExitMatch}
                      className="cursor-pointer font-extrabold py-3.5 px-9 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/15 text-slate-300 font-sans text-xs uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                      id="btn-home-gameover"
                    >
                      <Home className="h-4 w-4 text-slate-300" /> BACK TO MENU
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Rematch Accept/Decline Dialog overlay */}
          {activeRoomId && rematchRequesterId && rematchRequesterId !== activeMyId && rematchStatus === 'pending' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border-2 border-cyan-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 mb-4 animate-pulse">
                  <RotateCcw className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-mono font-bold text-white uppercase tracking-wider mb-2">
                  Rematch Requested
                </h3>
                <p className="text-xs text-slate-300 font-mono uppercase mb-6 leading-relaxed">
                  The opponent wants to battle again! Do you accept the challenge?
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => respondToRematch(activeRoomId, true).catch(console.warn)}
                    className="cursor-pointer font-extrabold px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-sans text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondToRematch(activeRoomId, false).catch(console.warn)}
                    className="cursor-pointer font-bold px-6 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-sans text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIMULATED ADMOB REWARDED VIDEO FEED OVERLAY */}
          {isWatchingAd && (
            <div className="absolute inset-0 w-full h-full z-50 flex flex-col items-center justify-center bg-[#020617]/95 text-center p-6 select-none backdrop-blur-md">
              {/* Neon scan lines / grids to make it look like a CRT or tech stream */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
              
              <div className="relative w-full max-w-lg bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-xl">
                {/* Ad Header */}
                <div className="w-full flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="font-mono text-[10px] font-extrabold text-amber-400 tracking-wider uppercase">
                      AdMob Stream Active // Sponsored
                    </span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-black text-amber-300">
                      REWARD IN: {adCountdown}S
                    </span>
                  </div>
                </div>

                {/* Video container simulating some intergalactic advertisement */}
                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 flex flex-col items-center justify-center mb-6 shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-purple-950/20 to-slate-950/40" />
                  
                  {/* Spinning tech ring / animated holo graphic */}
                  <div className="relative z-10 flex flex-col items-center p-4">
                    <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-dashed border-amber-500/40 animate-spin" style={{ animationDuration: '10s' }} />
                      <div className="absolute inset-2 rounded-full border border-cyan-500/40 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
                      <Tv className="h-6 w-6 text-amber-400" />
                    </div>
                    
                    <h4 className="font-mono text-xs font-black text-white uppercase tracking-widest mb-1">
                      Hyperion Shield Defense Systems
                    </h4>
                    <p className="font-sans text-[10px] text-slate-400 max-w-xs leading-relaxed">
                      "Protecting starfighters across the Sagittarius arm since 2284. Upgrade to Class-IV deflector grids today."
                    </p>
                  </div>

                  {/* Fake playback seekbar at bottom of video */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${((5 - adCountdown) / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Footer information */}
                <div className="flex items-center gap-2.5">
                  <div className="animate-pulse flex space-x-1">
                    <div className="h-1.5 w-1.5 bg-amber-400 rounded-full" />
                    <div className="h-1.5 w-1.5 bg-amber-400 rounded-full" style={{ animationDelay: '0.2s' }} />
                    <div className="h-1.5 w-1.5 bg-amber-400 rounded-full" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                    Do not close stream. System synchronizing radial backup.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
