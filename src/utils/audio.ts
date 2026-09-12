/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundController {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private musicInterval: any = null;
  private isMusicPlaying: boolean = false;
  private currentNotes: number[] = [110, 130.81, 146.83, 164.81, 110, 130.81, 164.81, 196.00]; // A2, C3, D3, E3, G3
  private musicStep: number = 0;

  constructor() {
    try {
      const storedSound = localStorage.getItem('sky_war_sound_enabled');
      if (storedSound !== null) {
        this.soundEnabled = storedSound === 'true';
      }
      const storedMusic = localStorage.getItem('sky_war_music_enabled');
      if (storedMusic !== null) {
        this.musicEnabled = storedMusic === 'true';
      }
    } catch (e) {
      console.warn("Storage access failed in sound controller", e);
    }
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  public setMuted(muted: boolean) {
    this.setSoundEnabled(!muted);
    this.setMusicEnabled(!muted);
  }

  public isMuted(): boolean {
    return !this.soundEnabled && !this.musicEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('sky_war_sound_enabled', String(enabled));
    } catch {}
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    try {
      localStorage.setItem('sky_war_music_enabled', String(enabled));
    } catch {}
    if (enabled) {
      this.startMusic();
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public startMusic() {
    if (this.isMusicPlaying) return;
    this.init();
    if (!this.ctx) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;

    const playStep = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      
      if (this.ctx.state === 'suspended') {
        try {
          this.ctx.resume();
        } catch {}
      }

      if (!this.musicEnabled) {
        this.musicInterval = setTimeout(playStep, 420);
        return;
      }

      const t = this.ctx.currentTime;
      const note = this.currentNotes[this.musicStep % this.currentNotes.length];
      
      try {
        // Deep warm triangle wave synth bass beat
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, t);
        
        // Syncopated high-pitch space beep
        if (this.musicStep % 4 === 1 || this.musicStep % 4 === 3) {
          const arp = this.ctx.createOscillator();
          const arpGain = this.ctx.createGain();
          arp.type = 'sine';
          arp.frequency.setValueAtTime(note * 3, t);
          arpGain.gain.setValueAtTime(0.015, t);
          arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          
          arp.connect(arpGain);
          arpGain.connect(this.ctx.destination);
          arp.start(t);
          arp.stop(t + 0.13);
        }

        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
      } catch (e) {
        console.warn("Synth voice play failure", e);
      }

      this.musicStep++;
      this.musicInterval = setTimeout(playStep, 420); // Steady 142 BPM spacer
    };

    playStep();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("No context");
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public play(type: 'player_shoot' | 'enemy_shoot' | 'player_hit' | 'enemy_hit' | 'player_death' | 'enemy_death' | 'wave_start' | 'powerup') {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    // Resume if state is suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch {}
    }

    const t = this.ctx.currentTime;

    switch (type) {
      case 'player_shoot': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
        
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.11);
        break;
      }
      case 'enemy_shoot': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, t);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
        break;
      }
      case 'player_hit': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(40, t + 0.2);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.21);
        break;
      }
      case 'enemy_hit': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.06);
        break;
      }
      case 'player_death': {
        try {
          const baseOsc = this.ctx.createOscillator();
          const baseGain = this.ctx.createGain();
          baseOsc.type = 'sawtooth';
          baseOsc.frequency.setValueAtTime(120, t);
          baseOsc.frequency.linearRampToValueAtTime(20, t + 0.8);
          baseGain.gain.setValueAtTime(0.35, t);
          baseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          baseOsc.connect(baseGain);
          baseGain.connect(this.ctx.destination);
          baseOsc.start(t);
          baseOsc.stop(t + 0.8);

          const noise = this.ctx.createBufferSource();
          noise.buffer = this.createNoiseBuffer();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1000, t);
          filter.frequency.exponentialRampToValueAtTime(80, t + 0.6);

          const noiseGain = this.ctx.createGain();
          noiseGain.gain.setValueAtTime(0.3, t);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(this.ctx.destination);
          noise.start(t);
          noise.stop(t + 0.6);
        } catch (e) {
          const fallbackOsc = this.ctx.createOscillator();
          const fallbackGain = this.ctx.createGain();
          fallbackOsc.type = 'sawtooth';
          fallbackOsc.frequency.setValueAtTime(180, t);
          fallbackOsc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
          fallbackGain.gain.setValueAtTime(0.25, t);
          fallbackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

          fallbackOsc.connect(fallbackGain);
          fallbackGain.connect(this.ctx.destination);
          fallbackOsc.start(t);
          fallbackOsc.stop(t + 0.5);
        }
        break;
      }
      case 'enemy_death': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
        break;
      }
      case 'wave_start': {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, t);
        osc1.frequency.linearRampToValueAtTime(880, t + 0.3);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(220, t);
        osc2.frequency.linearRampToValueAtTime(440, t + 0.3);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.4);
        osc2.stop(t + 0.4);
        break;
      }
      case 'powerup': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(554, t + 0.08);
        osc.frequency.setValueAtTime(659, t + 0.16);
        osc.frequency.setValueAtTime(880, t + 0.24);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
        break;
      }
    }
  }
}

export const audio = new SoundController();
