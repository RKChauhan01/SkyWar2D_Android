import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  getDocs,
  deleteDoc,
  serverTimestamp,
  increment 
} from 'firebase/firestore';
import { db, ensureSignedIn, handleFirestoreError, OperationType } from './firebase';
import { Brick, PowerUp } from '../types';

// ... (keep existing interfaces)

/**
 * Specifically damages a remote player using atomic increments.
 */
export async function damagePlayer(roomId: string, playerId: string, amount: number): Promise<void> {
  const playerDocRef = doc(db, 'rooms', roomId, 'players', playerId);
  try {
    await updateDoc(playerDocRef, {
      health: increment(-amount),
      lastUpdatedAt: Date.now()
    });
  } catch (err) {
    console.warn("Dmg sync error:", err);
  }
}

/**
 * Explicitly sets/syncs player health (e.g. after picking up a health pack).
 */
export async function syncPlayerHealth(roomId: string, playerId: string, health: number): Promise<void> {
  const playerDocRef = doc(db, 'rooms', roomId, 'players', playerId);
  try {
    await updateDoc(playerDocRef, {
      health: health,
      lastUpdatedAt: Date.now()
    });
  } catch (err) {
    console.warn("Health sync error:", err);
  }
}

export interface MultiplayerPlayer {
  id: string;
  name: string;
  status: 'waiting' | 'ready' | 'playing';
  x: number;
  y: number;
  angle: number;
  score: number;
  health: number;
  maxHealth: number;
  color?: string;
  isInvulnerable: boolean;
  activePowerUp: string | null;
  isFiring: boolean;
  lastUpdatedAt: number;
  lives: number;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'gameover';
  currentWave: number;
  createdAt: any;
  rematchRequesterId?: string | null;
  rematchStatus?: 'pending' | 'accepted' | 'declined' | null;
  gameMode?: 'pvp' | 'coop';
}

// Generate a random room ID (4 characters, uppercase)
const generateRoomId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid look-alike characters
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Creates a new multiplayer room in Firestore and sets the creator as Host.
 */
export async function createRoom(pilotName: string, myId: string, gameMode: 'pvp' | 'coop' = 'pvp'): Promise<string> {
  await ensureSignedIn();
  
  let roomId = generateRoomId();
  let attempts = 0;
  
  // Guard against theoretical room code collision
  while (attempts < 5) {
    const roomRef = doc(db, 'rooms', roomId);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        break;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
    }
    roomId = generateRoomId();
    attempts++;
  }

  const roomRef = doc(db, 'rooms', roomId);
  const roomData: RoomState = {
    roomId,
    hostId: myId,
    status: 'lobby',
    currentWave: 1,
    createdAt: new Date().getTime(), // Millisecond epoch for query-less sorting or expiration
    gameMode,
  };

  try {
    await setDoc(roomRef, roomData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }

  // Set the host player entry
  const hostPlayerDocRef = doc(db, 'rooms', roomId, 'players', myId);
  const hostPlayerData: MultiplayerPlayer = {
    id: myId,
    name: pilotName,
    status: 'ready', // Host starts ready
    x: 600, // LOGICAL_WIDTH / 2
    y: 337, // LOGICAL_HEIGHT / 2
    angle: 0,
    score: 0,
    health: 100,
    maxHealth: 100,
    isInvulnerable: false,
    activePowerUp: null,
    isFiring: false,
    lastUpdatedAt: Date.now(),
    lives: 3
  };

  try {
    await setDoc(hostPlayerDocRef, hostPlayerData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}/players/${myId}`);
  }
  return roomId;
}

/**
 * Joins an existing multiplayer room.
 */
export async function joinRoom(roomId: string, pilotName: string, myId: string): Promise<void> {
  await ensureSignedIn();
  
  const cleanedRoomId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', cleanedRoomId);
  
  let roomSnap;
  try {
    roomSnap = await getDoc(roomRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${cleanedRoomId}`);
  }

  if (!roomSnap || !roomSnap.exists()) {
    throw new Error('Room not found. Please review the 4-digit code.');
  }

  const roomState = roomSnap.data() as RoomState;
  if (roomState.status !== 'lobby') {
    throw new Error('This room has already initiated the launch sequence.');
  }

  // Check players count
  const playersCollRef = collection(db, 'rooms', cleanedRoomId, 'players');
  let playersSnap;
  try {
    playersSnap = await getDocs(playersCollRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `rooms/${cleanedRoomId}/players`);
  }

  if (playersSnap && playersSnap.size >= 4) {
    throw new Error('This squadron is already at max capacity (4 players max).');
  }

  // Join as a new player
  const playerDocRef = doc(db, 'rooms', cleanedRoomId, 'players', myId);
  const joinerPlayerData: MultiplayerPlayer = {
    id: myId,
    name: pilotName,
    status: 'waiting', // Joiners can toggle ready in lobby
    x: 600,
    y: 337,
    angle: 0,
    score: 0,
    health: 100,
    maxHealth: 100,
    isInvulnerable: false,
    activePowerUp: null,
    isFiring: false,
    lastUpdatedAt: Date.now(),
    lives: 3
  };

  try {
    await setDoc(playerDocRef, joinerPlayerData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanedRoomId}/players/${myId}`);
  }
}

/**
 * Toggles a player ready status.
 */
export async function setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<void> {
  const playerDocRef = doc(db, 'rooms', roomId, 'players', playerId);
  try {
    await updateDoc(playerDocRef, {
      status: isReady ? 'ready' : 'waiting'
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/players/${playerId}`);
  }
}

/**
 * Updates player position, stats, weapons, and actions in real-time.
 * Can be throttled during gameplay to prevent exceeding quota or CPU overhead.
 */
export async function updatePlayerState(
  roomId: string, 
  playerId: string, 
  state: Partial<MultiplayerPlayer>
): Promise<void> {
  const playerDocRef = doc(db, 'rooms', roomId, 'players', playerId);
  try {
    await setDoc(playerDocRef, {
      ...state,
      lastUpdatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/players/${playerId}`);
  }
}

/**
 * Host triggers start sequence of the room.
 */
export async function startMultiplayerGame(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  let roomSnap;
  try {
    roomSnap = await getDoc(roomRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
  }
  
  if (roomSnap && roomSnap.exists()) {
    try {
      await updateDoc(roomRef, {
        status: 'playing',
        currentWave: 1,
        createdAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    }
  }
}

/**
 * Updates the synchronized wave state of the co-op match.
 */
export async function updateRoomWave(roomId: string, waveNum: number): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, {
      currentWave: waveNum
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Sets high level game over state on the room.
 */
export async function setRoomGameOver(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, {
      status: 'gameover'
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Request a rematch.
 */
export async function requestRematch(roomId: string, playerId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, {
      rematchRequesterId: playerId,
      rematchStatus: 'pending'
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Respond to rematch request.
 */
export async function respondToRematch(roomId: string, accept: boolean): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    if (accept) {
      await updateDoc(roomRef, {
        rematchStatus: 'accepted'
      });
      await resetRoomForRematch(roomId);
    } else {
      await updateDoc(roomRef, {
        rematchStatus: 'declined'
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Clear rematch request state.
 */
export async function clearRematchState(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, {
      rematchRequesterId: null,
      rematchStatus: null
    });
  } catch (err) {
    // Fail-safe
  }
}

/**
 * Resets the room and all players for a rematch.
 */
export async function resetRoomForRematch(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  const playersCollRef = collection(db, 'rooms', roomId, 'players');
  
  try {
    // 1. Reset room status and clear rematch state
    await updateDoc(roomRef, {
      status: 'playing',
      currentWave: 1,
      createdAt: Date.now(),
      rematchRequesterId: null,
      rematchStatus: null
    });

    // 2. Reset all players in the room
    const playersSnap = await getDocs(playersCollRef);
    const updatePromises = playersSnap.docs.map(pDoc => {
      return updateDoc(pDoc.ref, {
        health: 100,
        score: 0,
        lives: 1,
        status: 'playing',
        lastUpdatedAt: Date.now()
      });
    });
    
    await Promise.all(updatePromises);

    // 3. Clear bricks and powerups from previous game
    await clearMultiplayerEntities(roomId);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Exits the current room. If the host leaves, they can tear down the session helper.
 */
export async function exitRoom(roomId: string, playerId: string, isHost: boolean): Promise<void> {
  try {
    const playerDocRef = doc(db, 'rooms', roomId, 'players', playerId);
    await deleteDoc(playerDocRef);

    if (isHost) {
      // Set room status to gameover so joined clients exit cleanly, or delete room definition
      const roomRef = doc(db, 'rooms', roomId);
      await deleteDoc(roomRef);
    }
  } catch (err) {
    console.warn("Clean room exit experienced typical Firestore disconnect:", err);
  }
}

/**
 * Listens to active room main metadata updates in real-time.
 */
export function listenToRoom(roomId: string, callback: (room: RoomState | null) => void) {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as RoomState);
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
  });
}

/**
 * Listens to players inside the subcollection.
 */
export function listenToPlayers(roomId: string, callback: (players: MultiplayerPlayer[]) => void) {
  const playersCollRef = collection(db, 'rooms', roomId, 'players');
  return onSnapshot(playersCollRef, (snapshot) => {
    const players: MultiplayerPlayer[] = [];
    snapshot.forEach((pDoc) => {
      const data = pDoc.data() as MultiplayerPlayer;
      // Ensure the ID is correctly set from the document ID if missing in data
      if (!data.id) {
        data.id = pDoc.id;
      }
      players.push(data);
    });
    callback(players);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/players`);
  });
}

/**
 * Syncs a new brick into Firestore.
 */
export async function syncBrick(roomId: string, brick: Brick): Promise<void> {
  const ref = doc(db, 'rooms', roomId, 'bricks', brick.id);
  try {
    await setDoc(ref, brick);
  } catch (err) {
    console.warn("Brick sync error:", err);
  }
}

/**
 * Deletes a brick from Firestore when destroyed.
 */
export async function deleteBrick(roomId: string, brickId: string): Promise<void> {
  const ref = doc(db, 'rooms', roomId, 'bricks', brickId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    console.warn("Brick delete error:", err);
  }
}

/**
 * Listens to bricks inside the room subcollection.
 */
export function listenToBricks(roomId: string, callback: (bricks: Brick[]) => void) {
  const collRef = collection(db, 'rooms', roomId, 'bricks');
  return onSnapshot(collRef, (snapshot) => {
    const list: Brick[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as Brick);
    });
    callback(list);
  }, (err) => {
    console.warn("Listen to bricks error:", err);
  });
}

/**
 * Syncs a new power-up into Firestore.
 */
export async function syncPowerUp(roomId: string, powerUp: PowerUp): Promise<void> {
  const ref = doc(db, 'rooms', roomId, 'powerups', powerUp.id);
  try {
    await setDoc(ref, powerUp);
  } catch (err) {
    console.warn("PowerUp sync error:", err);
  }
}

/**
 * Deletes a power-up from Firestore when collected.
 */
export async function deletePowerUp(roomId: string, powerUpId: string): Promise<void> {
  const ref = doc(db, 'rooms', roomId, 'powerups', powerUpId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    console.warn("PowerUp delete error:", err);
  }
}

/**
 * Listens to power-ups inside the room subcollection.
 */
export function listenToPowerUps(roomId: string, callback: (powerups: PowerUp[]) => void) {
  const collRef = collection(db, 'rooms', roomId, 'powerups');
  return onSnapshot(collRef, (snapshot) => {
    const list: PowerUp[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as PowerUp);
    });
    callback(list);
  }, (err) => {
    console.warn("Listen to power-ups error:", err);
  });
}

/**
 * Clears all bricks and powerups for a room (e.g. on game start or rematch).
 */
export async function clearMultiplayerEntities(roomId: string): Promise<void> {
  try {
    const bricksColl = collection(db, 'rooms', roomId, 'bricks');
    const bricksSnap = await getDocs(bricksColl);
    const brickDeletes = bricksSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(brickDeletes);

    const powerupsColl = collection(db, 'rooms', roomId, 'powerups');
    const powerupsSnap = await getDocs(powerupsColl);
    const powerupDeletes = powerupsSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(powerupDeletes);
  } catch (err) {
    console.warn("Clear entities error:", err);
  }
}
