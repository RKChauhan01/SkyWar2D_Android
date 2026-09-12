/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number;
  health: number;
  maxHealth: number;
  score: number;
  kills: number;
  angle: number;
  color: string;
  isInvulnerable: boolean;
  invulnerableTime: number;
  dashCooldown: number;
  shootCooldown: number;
}

export type EnemyType = 'chaser' | 'evader' | 'kamikaze' | 'ranger';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  angle: number;
  speed: number;
  color: string;
  scoreValue: number;
  shootCooldown: number;
  state: 'chase' | 'evade' | 'reposition';
  stateTimer: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  ownerId?: string;
  isLocalPlayerBullet?: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  glow: boolean;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: 'health' | 'shield' | 'spread' | 'rapid';
  radius: number;
  duration: number;
}

export type GameStateStatus = 'start' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface Wave {
  number: number;
  enemiesRemaining: number;
  enemiesToSpawn: number;
  spawnTimer: number;
  active: boolean;
}

export interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  color: string;
}

