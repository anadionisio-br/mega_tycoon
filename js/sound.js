// Sintetizador de Efeitos Sonoros (Web Audio API - sem dependências externas)
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) this.init();
        return this.enabled;
    }

    tone(freq, type = 'sine', duration = 0.15, vol = 0.15, delay = 0, endFreq = null) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        }

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    playJump() {
        this.tone(240, 'sine', 0.16, 0.14, 0, 520);
    }

    playBouncePad() {
        this.tone(280, 'sine', 0.25, 0.18, 0, 880);
        this.tone(560, 'triangle', 0.22, 0.12, 0.05, 1120);
    }

    playLaserHit() {
        this.tone(190, 'sawtooth', 0.25, 0.18, 0, 65);
        this.tone(420, 'square', 0.15, 0.12, 0.03, 95);
    }

    playVanishStep() {
        this.tone(660, 'triangle', 0.08, 0.1, 0, 440);
    }

    playCoin() {
        this.tone(987.77, 'sine', 0.09, 0.12, 0);
        this.tone(1318.51, 'sine', 0.18, 0.12, 0.07);
    }

    playBuy() {
        this.tone(440, 'triangle', 0.1, 0.15, 0);
        this.tone(554.37, 'triangle', 0.1, 0.15, 0.07);
        this.tone(659.25, 'triangle', 0.18, 0.16, 0.14);
    }

    playUpgradeTick() {
        this.tone(720, 'sine', 0.06, 0.05, 0, 960);
    }

    playCheckpoint() {
        this.tone(523.25, 'sine', 0.12, 0.14, 0);
        this.tone(783.99, 'sine', 0.22, 0.14, 0.09);
    }

    playFall() {
        this.tone(320, 'sawtooth', 0.28, 0.12, 0, 110);
    }

    playVictory() {
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((n, i) => this.tone(n, 'triangle', 0.22, 0.16, i * 0.08));
    }

    playRebirth() {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((n, i) => this.tone(n, 'sine', 0.28, 0.16, i * 0.07));
    }

    playBreak() {
        this.tone(160, 'sawtooth', 0.18, 0.16, 0, 90);
        this.tone(130, 'square', 0.22, 0.14, 0.16, 75);
    }

    playRepair() {
        this.tone(380, 'square', 0.08, 0.1, 0);
        this.tone(520, 'square', 0.08, 0.1, 0.09);
        this.tone(760, 'triangle', 0.16, 0.13, 0.18);
    }

    playGoldenHour() {
        [587.33, 739.99, 880, 1174.66].forEach((n, i) => this.tone(n, 'sine', 0.25, 0.14, i * 0.08));
    }

    playSwitchMode() {
        this.tone(340, 'sine', 0.14, 0.13, 0, 680);
    }
}

export const sfx = new SoundEngine();
