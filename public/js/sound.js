(function () {
    'use strict';

    let audioCtx = null;

    function getCtx() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
        }
        return audioCtx;
    }

    function resume() {
        const ctx = getCtx();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
    }

    function tone(freq, start, duration, options) {
        const ctx = getCtx();
        if (!ctx) return;
        const o = options || {};
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + start;

        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (o.endFreq != null) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(o.endFreq, 1), t + duration);
        }

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(o.volume || 0.2, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.05);
    }

    function noise(start, duration, options) {
        const ctx = getCtx();
        if (!ctx) return;
        const o = options || {};
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = o.lowpass || 1000;

        const gain = ctx.createGain();
        const t = ctx.currentTime + start;
        gain.gain.setValueAtTime(o.volume || 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
    }

    window.Sound = {
        unlock: function () {
            resume();
        },

        // A low "thunk" with a small bounce echo as the disc lands
        drop: function () {
            resume();
            tone(300, 0, 0.15, { type: 'triangle', volume: 0.4, endFreq: 90 });
            noise(0, 0.04, { volume: 0.25, lowpass: 3000 });
            tone(180, 0.09, 0.12, { type: 'triangle', volume: 0.2, endFreq: 80 });
        },

        // Cheerful ascending jingle (~4 seconds) played when a game begins
        welcome: function () {
            resume();
            const notes = [
                { f: 523.25, t: 0.00, d: 0.35 },
                { f: 659.25, t: 0.30, d: 0.35 },
                { f: 783.99, t: 0.60, d: 0.35 },
                { f: 1046.50, t: 0.90, d: 0.60 },
                { f: 783.99, t: 1.55, d: 0.25 },
                { f: 659.25, t: 1.80, d: 0.25 },
                { f: 587.33, t: 2.05, d: 0.30 },
                { f: 523.25, t: 2.40, d: 1.20 }
            ];
            notes.forEach(n => tone(n.f, n.t, n.d, { type: 'triangle', volume: 0.22 }));
            tone(523.25, 2.40, 1.20, { type: 'sine', volume: 0.1 });
        },

        // Triumphant fanfare played when a player wins
        victory: function () {
            resume();
            const notes = [
                { f: 523.25, t: 0.00, d: 0.18 },
                { f: 659.25, t: 0.15, d: 0.18 },
                { f: 783.99, t: 0.30, d: 0.18 },
                { f: 1046.50, t: 0.45, d: 0.35 },
                { f: 1318.51, t: 0.70, d: 0.30 },
                { f: 1567.98, t: 0.95, d: 0.30 }
            ];
            notes.forEach(n => tone(n.f, n.t, n.d, { type: 'square', volume: 0.1 }));
            [523.25, 659.25, 783.99, 1046.50].forEach(f => {
                tone(f, 1.30, 1.0, { type: 'triangle', volume: 0.14 });
            });
        }
    };

    // Unlock the AudioContext on the first interaction so later sounds can play
    ['pointerdown', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, () => {
            const ctx = getCtx();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume();
            }
        });
    });
})();
