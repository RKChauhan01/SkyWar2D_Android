/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import GameLanding from './components/GameLanding';
import GameCanvas from './components/GameCanvas';
import MultiplayerLobby from './components/MultiplayerLobby';
import { LegalPageView } from './components/LegalPageView';

export default function App() {
  const [activeView, setActiveView] = useState<'landing' | 'lobby' | 'game'>('game');
  const [standaloneLegal, setStandaloneLegal] = useState<'none' | 'privacy' | 'terms'>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    
    if (path.includes('privacy') || hash.includes('privacy') || search.includes('privacy')) {
      return 'privacy';
    }
    if (
      path.includes('terms') || hash.includes('terms') || search.includes('terms') ||
      path.includes('term-') || hash.includes('term-') || search.includes('term-')
    ) {
      return 'terms';
    }
    return 'none';
  });
  const [multiplayerConfig, setMultiplayerConfig] = useState<{
    roomId: string;
    myId: string;
    isHost: boolean;
  } | null>(null);

  const [pilotName, setPilotName] = useState(() => {
    return localStorage.getItem('space_shooter_pilot_name') || 'Pilot Alpha';
  });

  const launchArcade = () => {
    setMultiplayerConfig(null);
    setActiveView('game');
    
    // Programmatically request fullscreen and target landscape orientation instantly on user click gesture
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().then(() => {
          try {
            if (screen.orientation && (screen.orientation as any).lock) {
              (screen.orientation as any).lock('landscape').catch(() => {});
            }
          } catch (e) {}
        }).catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        try {
          const res = (elem as any).webkitRequestFullscreen();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Fullscreen request on launch failed safely:", err);
    }
  };

  const launchMultiplayerGame = (roomId: string, myId: string, isHost: boolean) => {
    setMultiplayerConfig({ roomId, myId, isHost });
    setActiveView('game');
  };

  const exitArcade = () => {
    setActiveView('landing');
    setMultiplayerConfig(null);
  };

  const backToLobby = () => {
    setMultiplayerConfig(null);
    setActiveView('lobby');
  };

  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      
      if (path.includes('privacy') || hash.includes('privacy') || search.includes('privacy')) {
        setStandaloneLegal('privacy');
      } else if (
        path.includes('terms') || hash.includes('terms') || search.includes('terms') ||
        path.includes('term-') || hash.includes('term-') || search.includes('term-')
      ) {
        setStandaloneLegal('terms');
      } else {
        setStandaloneLegal('none');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleBackToGame = () => {
    setStandaloneLegal('none');
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {
      window.location.hash = '';
    }
  };

  if (standaloneLegal !== 'none') {
    return <LegalPageView type={standaloneLegal} onBackToGame={handleBackToGame} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {activeView === 'game' ? (
        <GameCanvas 
          onExitBack={undefined} 
          onBackToLobby={backToLobby}
          onPlayWithFriends={() => {
            try {
              if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
              }
            } catch (e) {}
            setActiveView('lobby');
          }}
          multiplayerRoomId={multiplayerConfig?.roomId}
          multiplayerMyId={multiplayerConfig?.myId}
          multiplayerIsHost={multiplayerConfig?.isHost}
        />
      ) : activeView === 'lobby' ? (
        <MultiplayerLobby 
          onLaunchMultiplayer={launchMultiplayerGame}
          onBack={() => setActiveView('landing')}
          initialPilotName={pilotName}
        />
      ) : (
        <GameLanding 
          onPlayGame={launchArcade} 
        />
      )}
    </main>
  );
}
