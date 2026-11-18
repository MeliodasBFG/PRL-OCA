/**
 * PRL-OCA 3D - Procedural Web Audio API Sound & Music Synthesizer
 * Generates 6 original ambient musical themes and 18 distinct game sound effects
 * with zero external copyrighted files, respecting browser autoplay restrictions
 * and emitting accessibility visual captions.
 */

export type MusicTheme =
  | 'none'
  | 'menu'
  | 'board'
  | 'suspense'
  | 'victory'
  | 'defeat'
  | 'emergency';

export type SoundEffectId =
  | 'button_click'
  | 'menu_open'
  | 'dice_throw'
  | 'dice_hit'
  | 'token_step'
  | 'tile_arrive'
  | 'answer_correct'
  | 'answer_wrong'
  | 'challenge_start'
  | 'countdown_tick'
  | 'time_up'
  | 'emergency_alert'
  | 'siren'
  | 'alarm'
  | 'extinguisher'
  | 'reward'
  | 'badge_unlock'
  | 'victory_fanfare';

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  masterMuted: boolean;
  visualCaptions: boolean;
}

const STORAGE_KEY = 'prl_oca_audio_settings_v1';

const CAPTION_LABELS: Record<SoundEffectId, string> = {
  button_click: '♪ Clic de interfaz',
  menu_open: '♪ Apertura de panel',
  dice_throw: '🎲 Lanzando dados 3D...',
  dice_hit: '🎲 Dados rebotando sobre el tablero',
  token_step: '👷 Avance de ficha en casilla',
  tile_arrive: '✨ Casilla activada e iluminada',
  answer_correct: '✅ ¡Acierto preventivo! Sonido de éxito',
  answer_wrong: '⚠️ Respuesta incorrecta: aviso pedagógico',
  challenge_start: '🚨 ¡Desafío 3D interactivo activado!',
  countdown_tick: '⏱️ Cuenta atrás: últimos segundos',
  time_up: '⌛ ¡Tiempo agotado!',
  emergency_alert: '🚨 Alerta de emergencia industrial',
  siren: '🚨 Sirena de evacuación activa',
  alarm: '🔔 Alarma acústica de planta',
  extinguisher: '🧯 Descarga de extintor CO2',
  reward: '🌟 Recompensa preventiva obtenida',
  badge_unlock: '🏅 ¡Nueva insignia 3D desbloqueada!',
  victory_fanfare: '🏆 ¡Fanfarria de Victoria Cero Accidentes!',
};

class SoundEngineService {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private currentTheme: MusicTheme = 'none';
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private stepCounter = 0;
  private captionListener: ((caption: string) => void) | null = null;

  public settings: AudioSettings = {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.35,
    sfxVolume: 0.65,
    masterMuted: false,
    visualCaptions: true,
  };

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        this.settings = { ...this.settings, ...parsed };
      }
    } catch {
      // Ignore storage errors
    }
  }

  public updateSettings(partial: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...partial };
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // Ignore
      }
    }
    if (this.settings.masterMuted || !this.settings.musicEnabled) {
      this.stopMusicLoopOnly();
    } else if (this.currentTheme !== 'none' && !this.musicTimer) {
      this.startThemeLoop(this.currentTheme);
    }
    return this.settings;
  }

  public onCaption(cb: ((caption: string) => void) | null): void {
    this.captionListener = cb;
  }

  private emitCaption(text: string): void {
    if (this.settings.visualCaptions && this.captionListener) {
      this.captionListener(text);
    }
  }

  public unlockAudio(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.unlocked = true;
      if (
        this.currentTheme !== 'none' &&
        this.settings.musicEnabled &&
        !this.settings.masterMuted &&
        !this.musicTimer
      ) {
        this.startThemeLoop(this.currentTheme);
      }
      return true;
    } catch {
      return false;
    }
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public playMusic(theme: MusicTheme): void {
    if (this.currentTheme === theme && this.musicTimer) return;
    this.currentTheme = theme;
    this.stopMusicLoopOnly();
    if (theme === 'none') return;
    if (!this.unlocked || this.settings.masterMuted || !this.settings.musicEnabled) return;
    this.startThemeLoop(theme);
  }

  private stopMusicLoopOnly(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startThemeLoop(theme: MusicTheme): void {
    if (theme === 'none') return;
    this.stopMusicLoopOnly();
    this.stepCounter = 0;

    // Musical scales (Hz) for each theme
    const patterns: Record<Exclude<MusicTheme, 'none'>, { notes: number[]; tempoMs: number; wave: OscillatorType }> = {
      // Adventurous technological synth arpeggio (D Dorian / C Major7)
      menu: {
        notes: [293.66, 349.23, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0],
        tempoMs: 420,
        wave: 'triangle',
      },
      // Discrete ambient board pulse
      board: {
        notes: [220.0, 261.63, 329.63, 293.66, 246.94, 329.63, 261.63, 196.0],
        tempoMs: 650,
        wave: 'sine',
      },
      // Suspenseful challenge rhythm
      suspense: {
        notes: [196.0, 207.65, 196.0, 233.08, 196.0, 207.65, 261.63, 246.94],
        tempoMs: 380,
        wave: 'triangle',
      },
      // Uplifting C major victory fanfare loop
      victory: {
        notes: [261.63, 329.63, 392.0, 523.25, 659.25, 587.33, 523.25, 783.99],
        tempoMs: 320,
        wave: 'triangle',
      },
      // Reflective minor ambient
      defeat: {
        notes: [220.0, 261.63, 246.94, 196.0, 174.61, 164.81],
        tempoMs: 700,
        wave: 'sine',
      },
      // Urgent industrial emergency pulse
      emergency: {
        notes: [330.0, 440.0, 330.0, 493.88, 330.0, 440.0],
        tempoMs: 300,
        wave: 'sawtooth',
      },
    };

    const config = patterns[theme];
    if (!config) return;

    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.settings.masterMuted || !this.settings.musicEnabled) return;
      const freq = config.notes[this.stepCounter % config.notes.length];
      this.stepCounter += 1;
      const vol = this.settings.musicVolume * (theme === 'board' ? 0.12 : 0.18);
      this.playTone(freq, config.tempoMs / 1000, config.wave, vol);
    }, config.tempoMs);
  }

  public playSfx(id: SoundEffectId): void {
    this.emitCaption(CAPTION_LABELS[id] ?? id);
    if (!this.unlocked) {
      this.unlockAudio();
    }
    if (!this.ctx || this.settings.masterMuted || !this.settings.sfxEnabled) return;

    const v = this.settings.sfxVolume * 0.4;

    switch (id) {
      case 'button_click':
        this.playTone(660, 0.06, 'sine', v * 0.6);
        break;
      case 'menu_open':
        this.playTone(440, 0.08, 'triangle', v * 0.6);
        setTimeout(() => this.playTone(587.33, 0.1, 'triangle', v * 0.6), 60);
        break;
      case 'dice_throw':
        this.playTone(300, 0.07, 'triangle', v * 0.7);
        setTimeout(() => this.playTone(420, 0.07, 'triangle', v * 0.7), 70);
        setTimeout(() => this.playTone(540, 0.08, 'triangle', v * 0.7), 140);
        break;
      case 'dice_hit':
        this.playTone(180, 0.05, 'square', v * 0.5);
        setTimeout(() => this.playTone(240, 0.05, 'square', v * 0.4), 80);
        break;
      case 'token_step':
        this.playTone(392, 0.07, 'sine', v * 0.65);
        break;
      case 'tile_arrive':
        this.playTone(523.25, 0.1, 'triangle', v * 0.75);
        setTimeout(() => this.playTone(659.25, 0.16, 'triangle', v * 0.8), 90);
        break;
      case 'answer_correct':
      case 'reward':
        this.playTone(523.25, 0.1, 'triangle', v);
        setTimeout(() => this.playTone(659.25, 0.1, 'triangle', v), 90);
        setTimeout(() => this.playTone(783.99, 0.12, 'triangle', v), 180);
        setTimeout(() => this.playTone(1046.5, 0.25, 'triangle', v), 270);
        break;
      case 'answer_wrong':
        this.playTone(246.94, 0.16, 'sawtooth', v * 0.7);
        setTimeout(() => this.playTone(185.0, 0.28, 'sawtooth', v * 0.7), 150);
        break;
      case 'challenge_start':
        this.playTone(440, 0.1, 'triangle', v);
        setTimeout(() => this.playTone(554.37, 0.1, 'triangle', v), 100);
        setTimeout(() => this.playTone(659.25, 0.22, 'triangle', v), 200);
        break;
      case 'countdown_tick':
        this.playTone(880, 0.04, 'sine', v * 0.5);
        break;
      case 'time_up':
        this.playTone(311.13, 0.18, 'sawtooth', v * 0.8);
        setTimeout(() => this.playTone(233.08, 0.35, 'sawtooth', v * 0.8), 180);
        break;
      case 'emergency_alert':
      case 'siren':
      case 'alarm':
        this.playTone(620, 0.15, 'sawtooth', v * 0.65);
        setTimeout(() => this.playTone(880, 0.15, 'sawtooth', v * 0.65), 150);
        setTimeout(() => this.playTone(620, 0.18, 'sawtooth', v * 0.65), 300);
        break;
      case 'extinguisher':
        this.playNoiseBurst(0.35, v * 0.6);
        break;
      case 'badge_unlock':
        this.playTone(587.33, 0.1, 'triangle', v);
        setTimeout(() => this.playTone(783.99, 0.1, 'triangle', v), 90);
        setTimeout(() => this.playTone(987.77, 0.12, 'triangle', v), 180);
        setTimeout(() => this.playTone(1174.66, 0.28, 'triangle', v), 270);
        break;
      case 'victory_fanfare':
        this.playTone(523.25, 0.14, 'triangle', v);
        setTimeout(() => this.playTone(659.25, 0.14, 'triangle', v), 140);
        setTimeout(() => this.playTone(783.99, 0.14, 'triangle', v), 280);
        setTimeout(() => this.playTone(1046.5, 0.4, 'triangle', v), 420);
        break;
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Audio context busy
    }
  }

  private playNoiseBurst(durationSec: number, volume: number): void {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * durationSec;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new SoundEngineService();
