/**
 * ROLE: WP-034 Slice B の native playback scheduler。
 * AUTHORITY: clock と runtime.seek の呼出し、再生状態、RAF lifecycle だけ。
 * INVARIANTS: 1本のRAF chain、最大30fpsのseek、状態通知は最大10Hz、autoplayなし。
 * RELATED: editor.js、runtime.js、WP-034-rive-weights-playback.md。
 */

export const PLAYBACK_STATES = Object.freeze({
    idle: 'idle',
    playing: 'playing',
    paused: 'paused',
    stopped: 'stopped',
    ended: 'ended',
});

export const PLAYBACK_DURATION_MS = 1000;
export const PLAYBACK_MAX_FPS = 30;
export const PLAYBACK_FRAME_INTERVAL_MS = 1000 / PLAYBACK_MAX_FPS;
export const PLAYBACK_SNAPSHOT_INTERVAL_MS = 100;

function defaultClock() {
    const now = globalThis.performance?.now?.();
    return Number.isFinite(now) ? now : Date.now();
}

function defaultRequestFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') return globalThis.requestAnimationFrame(callback);
    return globalThis.setTimeout(() => callback(defaultClock()), 16);
}

function defaultCancelFrame(id) {
    if (typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(id);
    else globalThis.clearTimeout(id);
}

function finiteProgress(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
}

function finiteTime(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * Runtime independent playback controller. The injected `seek` callback must
 * perform the native Rive seek; this controller never evaluates a pose itself.
 */
export class PlaybackController {
    constructor(options = {}) {
        this.clock = options.clock || defaultClock;
        this.requestFrame = options.requestFrame || defaultRequestFrame;
        this.cancelFrame = options.cancelFrame || defaultCancelFrame;
        this.seekRuntime = typeof options.seek === 'function' ? options.seek : (() => null);
        this.getProgress = typeof options.getProgress === 'function' ? options.getProgress : null;
        this.captureFrame = typeof options.captureFrame === 'function' ? options.captureFrame : null;
        this.onState = typeof options.onState === 'function'
            ? options.onState
            : typeof options.status === 'function' ? options.status : null;
        this.durationMs = Number.isFinite(Number(options.durationMs)) && Number(options.durationMs) > 0
            ? Number(options.durationMs)
            : PLAYBACK_DURATION_MS;
        this.frameIntervalMs = Number.isFinite(Number(options.frameIntervalMs)) && Number(options.frameIntervalMs) > 0
            ? Number(options.frameIntervalMs)
            : PLAYBACK_FRAME_INTERVAL_MS;
        this.snapshotIntervalMs = Number.isFinite(Number(options.snapshotIntervalMs)) && Number(options.snapshotIntervalMs) > 0
            ? Number(options.snapshotIntervalMs)
            : PLAYBACK_SNAPSHOT_INTERVAL_MS;
        this.state = PLAYBACK_STATES.idle;
        this.progress = finiteProgress(options.progress, 0);
        this.loop = options.loop === true;
        this.disposed = false;
        this.rafId = null;
        this.generation = 0;
        this.startTime = null;
        this.lastSeekAt = null;
        this.lastSnapshotAt = null;
        this.lastEmittedState = null;
        this.lastEmittedProgress = null;
    }

    _now() {
        return finiteTime(this.clock?.(), Date.now());
    }

    _safeProgress(value = this.progress) {
        const candidate = finiteProgress(value, this.progress);
        return candidate;
    }

    _readRuntimeProgress() {
        if (!this.getProgress) return this.progress;
        try {
            return this._safeProgress(this.getProgress());
        } catch {
            return this.progress;
        }
    }

    _cancelFrame() {
        if (this.rafId === null) return;
        try { this.cancelFrame(this.rafId); } catch {}
        this.rafId = null;
    }

    _schedule() {
        if (this.disposed || this.state !== PLAYBACK_STATES.playing || this.rafId !== null) return;
        const token = this.generation;
        let frameId = null;
        frameId = this.requestFrame(timestamp => {
            if (this.rafId === frameId) this.rafId = null;
            if (token !== this.generation) return;
            this._tick(timestamp);
        });
        this.rafId = frameId;
    }

    _emit(force = false, timestamp = this._now()) {
        if (!this.onState || this.disposed) return;
        const time = finiteTime(timestamp, this._now());
        const stateChanged = this.state !== this.lastEmittedState;
        const progressChanged = this.progress !== this.lastEmittedProgress;
        const intervalElapsed = this.lastSnapshotAt === null || time - this.lastSnapshotAt >= this.snapshotIntervalMs;
        if (!force && !stateChanged && (!progressChanged || !intervalElapsed)) return;
        this.lastSnapshotAt = time;
        this.lastEmittedState = this.state;
        this.lastEmittedProgress = this.progress;
        this.onState({
            state: this.state,
            playbackState: this.state,
            progress: this.progress,
            loop: this.loop,
            playbackLoop: this.loop,
            playing: this.state === PLAYBACK_STATES.playing,
        });
    }

    _applySeek(progress) {
        const next = this._safeProgress(progress);
        this.seekRuntime(next);
        this.progress = next;
        return next;
    }

    _activeForCapture() {
        return this.state === PLAYBACK_STATES.playing || this.state === PLAYBACK_STATES.paused;
    }

    _capture(reason, force = false) {
        if (!this.captureFrame || (!force && !this._activeForCapture())) return null;
        this.progress = this._readRuntimeProgress();
        try {
            return this.captureFrame(reason, this.progress);
        } catch {
            return null;
        }
    }

    _stop(nextState, reason, options = {}) {
        const wasActive = this._activeForCapture();
        this._cancelFrame();
        this.generation += 1;
        this.progress = this._readRuntimeProgress();
        this.state = nextState;
        this.startTime = null;
        this.lastSeekAt = null;
        if (options.capture !== false && (wasActive || options.forceCapture === true)) this._capture(reason, true);
        this._emit(true);
        return this.getState();
    }

    start() {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        if (this.state === PLAYBACK_STATES.playing) return { ok: true, state: this.getState() };
        const now = this._now();
        let progress = this._readRuntimeProgress();
        if (progress >= 1) {
            try { progress = this._applySeek(0); } catch { return { ok: false, reason: 'seek-failed' }; }
        }
        this.progress = progress;
        this.startTime = now - progress * this.durationMs;
        this.lastSeekAt = null;
        this.state = PLAYBACK_STATES.playing;
        this.generation += 1;
        this._emit(true, now);
        this._schedule();
        return { ok: true, state: this.getState() };
    }

    play() {
        return this.start();
    }

    pause(reason = 'pause') {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        if (this.state !== PLAYBACK_STATES.playing) {
            if (this.state === PLAYBACK_STATES.paused) this._emit(true);
            return { ok: true, state: this.getState() };
        }
        return this._stop(PLAYBACK_STATES.paused, reason);
    }

    stop(reason = 'stop', options = {}) {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        return this._stop(options.state || PLAYBACK_STATES.stopped, reason, options);
    }

    stopAndCapture(reason = 'action') {
        if (!this._activeForCapture() && this.rafId === null) return this.getState();
        return this.stop(reason, { capture: true });
    }

    seek(value, reason = 'seek') {
        return this.seekTo(value, reason);
    }

    seekTo(value, reason = 'seek') {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        this.stop(reason, { capture: true });
        try {
            this._applySeek(value);
        } catch {
            return { ok: false, reason: 'seek-failed' };
        }
        this.state = PLAYBACK_STATES.paused;
        this._emit(true);
        return { ok: true, state: this.getState() };
    }

    setLoop(value) {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        this.loop = value === true;
        this._emit(true);
        return { ok: true, state: this.getState() };
    }

    syncProgress(value) {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        this.progress = finiteProgress(value, this.progress);
        this._emit(true);
        return { ok: true, state: this.getState() };
    }

    reset(progress = 0) {
        if (this.disposed) return { ok: false, reason: 'disposed' };
        this.stop('scene-reset', { capture: false });
        this.progress = finiteProgress(progress, 0);
        this.state = PLAYBACK_STATES.idle;
        this._emit(true);
        return { ok: true, state: this.getState() };
    }

    _tick(timestamp) {
        if (this.disposed || this.state !== PLAYBACK_STATES.playing) return;
        const now = finiteTime(timestamp, this._now());
        const elapsed = Math.max(0, now - finiteTime(this.startTime, now));
        const rawProgress = elapsed / this.durationMs;
        let nextProgress = rawProgress;
        if (this.loop && rawProgress >= 1) nextProgress = rawProgress % 1;
        else nextProgress = Math.min(1, rawProgress);

        const canSeek = this.lastSeekAt === null || now - this.lastSeekAt >= this.frameIntervalMs - 0.0001;
        if (canSeek) {
            try {
                this._applySeek(nextProgress);
                this.lastSeekAt = now;
            } catch {
                this._stop(PLAYBACK_STATES.stopped, 'seek-failed', { capture: false });
                return;
            }
        }
        const ended = !this.loop && rawProgress >= 1;
        if (!ended) this._emit(false, now);

        if (ended) {
            let terminalSeekOk = true;
            try {
                // Terminal sync is an explicit boundary and bypasses the normal frame cap.
                if (this.progress !== 1 || nextProgress !== 1 || this._readRuntimeProgress() !== 1) this._applySeek(1);
            } catch {
                terminalSeekOk = false;
            }
            if (!terminalSeekOk) {
                this._stop(PLAYBACK_STATES.stopped, 'terminal-seek-failed', { capture: false });
                return;
            }
            this.progress = 1;
            this.state = PLAYBACK_STATES.ended;
            this.startTime = null;
            this._emit(true, now);
            return;
        }
        this._schedule();
    }

    getState() {
        return {
            state: this.state,
            playbackState: this.state,
            progress: this.progress,
            loop: this.loop,
            playbackLoop: this.loop,
            playing: this.state === PLAYBACK_STATES.playing,
            rafScheduled: this.rafId !== null,
        };
    }

    isPlaying() {
        return this.state === PLAYBACK_STATES.playing;
    }

    hasScheduledFrame() {
        return this.rafId !== null;
    }

    dispose() {
        if (this.disposed) return { ok: true, state: this.getState() };
        this._cancelFrame();
        this.generation += 1;
        this.disposed = true;
        this.startTime = null;
        this.state = PLAYBACK_STATES.stopped;
        return this.getState();
    }
}

export function createPlaybackController(options = {}) {
    return new PlaybackController(options);
}

