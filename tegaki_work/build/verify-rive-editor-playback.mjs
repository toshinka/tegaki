/**
 * ROLE: WP-034 Slice B playback-controller/static wiring verifier。
 * AUTHORITY: deterministic scheduler、editor配線、fixture/static checks。native/Browser/Owner acceptance は所有しない。
 * INVARIANTS: autoplayなし、RAF chain一本、seek最大30fps、snapshot最大10Hz、action境界だけcapture。
 * RELATED: advanced/rive-editor/playback-controller.js、editor.js、editor.html、WP-034。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlaybackController, PLAYBACK_STATES } from '../advanced/rive-editor/playback-controller.js';
import { verifyFixedCache } from '../advanced/rive-editor/dev-companion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cacheRoot = path.join(root, 'tegaki_work', '.cache', 'rive-editor');
const checks = [];
const failures = [];

function check(condition, message) {
    checks.push({ message, ok: Boolean(condition) });
    if (!condition) failures.push(message);
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

function makeHarness(options = {}) {
    let now = 0;
    let nextFrameId = 0;
    const frames = new Map();
    const seekCalls = [];
    const captures = [];
    const states = [];
    let runtimeProgress = Number(options.progress || 0);
    const controller = new PlaybackController({
        clock: () => now,
        requestFrame: callback => {
            const id = ++nextFrameId;
            frames.set(id, callback);
            return id;
        },
        cancelFrame: id => frames.delete(id),
        seek: progress => {
            if (options.failAt !== undefined && progress === options.failAt) throw new Error('injected-seek-failure');
            runtimeProgress = progress;
            seekCalls.push({ progress, at: now });
        },
        getProgress: () => runtimeProgress,
        captureFrame: (reason, progress) => {
            captures.push({ reason, progress });
            return { reason, progress };
        },
        onState: state => states.push({ ...state }),
        loop: options.loop === true,
        durationMs: options.durationMs,
    });
    function advance(time) {
        now = time;
        const pending = [...frames.entries()];
        if (!pending.length) return false;
        const [id, callback] = pending[0];
        frames.delete(id);
        callback(time);
        return true;
    }
    return {
        controller,
        frames,
        seekCalls,
        captures,
        states,
        setNow(value) { now = value; },
        advance,
        get now() { return now; },
        get runtimeProgress() { return runtimeProgress; },
    };
}

async function verifyController() {
    const harness = makeHarness();
    const { controller } = harness;
    check(controller.getState().state === PLAYBACK_STATES.idle && harness.frames.size === 0, 'constructor is idle and does not autoplay');

    controller.start();
    check(controller.isPlaying() && harness.frames.size === 1, 'start enters playing with one RAF');
    controller.start();
    check(harness.frames.size === 1, 'duplicate start does not create a second RAF chain');

    harness.advance(0);
    const seeksAfterFirstTick = harness.seekCalls.length;
    harness.advance(20);
    check(harness.seekCalls.length === seeksAfterFirstTick, 'sub-30fps tick does not call native seek');
    harness.advance(40);
    check(harness.seekCalls.length === seeksAfterFirstTick + 1 && harness.captures.length === 0, '30fps tick seeks without action-boundary capture');
    check(harness.states.every(state => state.playbackState && state.progress !== undefined), 'state callback carries playbackState and progress');

    controller.pause();
    check(controller.getState().state === PLAYBACK_STATES.paused && harness.frames.size === 0, 'pause cancels RAF and enters paused');
    check(harness.captures.length === 1 && harness.captures[0].reason === 'pause', 'pause captures one native frame at current progress');

    const capturesBeforeSeek = harness.captures.length;
    controller.seek(0.25, 'scrub');
    check(controller.getState().progress === 0.25 && harness.captures.length === capturesBeforeSeek + 1, 'seekTo stops and captures before applying the requested progress');
    check(harness.seekCalls.at(-1)?.progress === 0.25, 'seekTo delegates requested progress to native seek');
    controller.syncProgress(0.4);
    check(controller.getState().progress === 0.4, 'syncProgress keeps controller state aligned after an external scrub render');

    controller.seekTo(1, 'end');
    controller.start();
    check(harness.seekCalls.at(-1)?.progress === 0 && controller.isPlaying(), 'play from end resets native progress to zero');
    const startedAt = harness.now;
    harness.advance(startedAt);
    harness.advance(startedAt + 1001);
    check(controller.getState().state === PLAYBACK_STATES.ended && controller.getState().progress === 1 && harness.frames.size === 0, 'one-shot playback ends at progress one and cancels RAF');

    const terminal = makeHarness();
    terminal.controller.start();
    terminal.advance(0);
    terminal.advance(990);
    terminal.advance(1000);
    check(terminal.controller.getState().state === PLAYBACK_STATES.ended
        && terminal.controller.getState().progress === 1
        && terminal.runtimeProgress === 1
        && terminal.seekCalls.at(-1)?.progress === 1,
    'near-terminal tick bypasses the frame cap to sync native progress one');
    const terminalFailure = makeHarness({ failAt: 1 });
    terminalFailure.controller.start();
    terminalFailure.advance(0);
    terminalFailure.advance(1000);
    check(terminalFailure.controller.getState().state !== PLAYBACK_STATES.ended, 'terminal seek failure never reports ended');

    controller.setLoop(true);
    controller.start();
    const loopStartedAt = harness.now;
    harness.advance(loopStartedAt);
    harness.advance(loopStartedAt + 1001);
    check(controller.isPlaying() && controller.getState().progress < 1 && harness.frames.size === 1, 'loop wraps progress and keeps one RAF chain');
    controller.setLoop(false);
    const staleCallback = [...harness.frames.values()][0];
    controller.stop('manual-stop');
    staleCallback(1200);
    check(!controller.isPlaying() && harness.frames.size === 0, 'stop invalidates a queued stale callback');

    const restart = makeHarness();
    restart.controller.start();
    const oldCallback = [...restart.frames.values()][0];
    restart.controller.stop('restart-stop');
    restart.controller.start();
    check(restart.frames.size === 1, 'restart schedules one current RAF');
    oldCallback(16);
    check(restart.frames.size === 1, 'old generation callback preserves current RAF ownership');
    restart.controller.pause();
    check(restart.frames.size === 0, 'pause after old callback cancels the current RAF');

    controller.dispose();
    check(controller.getState().state === PLAYBACK_STATES.stopped && !controller.start().ok, 'dispose cancels playback and rejects later start');
}

async function verifyWiring() {
    const [controllerSource, editorSource, htmlSource, serverSource, browserSource] = await Promise.all([
        read('tegaki_work/advanced/rive-editor/playback-controller.js'),
        read('tegaki_work/advanced/rive-editor/editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.html'),
        read('tegaki_work/advanced/rive-editor/server.mjs'),
        read('tegaki_work/build/wp034-rive-playback-browser.html'),
    ]);

    check(controllerSource.includes('runtime.seek') || controllerSource.includes('native Rive seek'), 'controller contract names native seek authority');
    check(controllerSource.includes('PLAYBACK_MAX_FPS') && controllerSource.includes('PLAYBACK_SNAPSHOT_INTERVAL_MS'), 'controller defines 30fps and 10Hz limits');
    check(!controllerSource.includes('getImageData') && !controllerSource.includes('toDataURL') && !controllerSource.includes('/api/') && !controllerSource.includes('fetch('), 'controller has no pixel encode or API work in its RAF path');
    check(editorSource.includes("import { PlaybackController } from './playback-controller.js';") && editorSource.includes('new PlaybackController'), 'editor imports and instantiates the isolated controller');
    check(editorSource.includes('runtime.seek(progress)') && editorSource.includes('capturePlaybackFrame'), 'editor injects native seek and action-boundary capture callbacks');
    check(editorSource.includes('playbackState') && editorSource.includes('playbackLoop') && editorSource.includes('onPlaybackState'), 'AI snapshot carries playback state and loop');
    check(/function onPlaybackState[\s\S]*?boneController\?\.refresh\(\)/.test(editorSource), 'playback state notifications refresh the existing bone overlay');
    for (const reason of ['compile', 'image-load', 'save', 'reopen', 'cancel', 'frame-png', 'scrub', 'frame-request', 'bone-edit', 'weight-draft', 'weight-commit']) {
        check(editorSource.includes('stopPlaybackForOperation(' + "'" + reason + "'" + ')'), 'playback stops before ' + reason);
    }
    check(editorSource.includes('visibilitychange') && editorSource.includes('window-blur') && editorSource.includes("playbackController?.dispose()"), 'hidden/blur/pagehide stop and dispose playback');
    check(htmlSource.includes('data-testid="rive-play"') && htmlSource.includes('data-testid="rive-pause"'), 'editor exposes trusted playback controls');
    check(serverSource.split("'/playback-controller.js'").length === 2, 'server adds exactly one playback static route');
    check(htmlSource.includes('data-testid="rive-play"') && htmlSource.includes('data-testid="rive-pause"') && htmlSource.includes('data-testid="rive-start"') && htmlSource.includes('data-testid="rive-end"'), 'HTML exposes play/pause/start/end controls');
    check(htmlSource.includes('id="playback-loop" type="checkbox"') && !htmlSource.includes('id="playback-loop" type="checkbox" checked'), 'loop is runtime-only and unchecked by default');
    check(htmlSource.includes('playback-actions') && htmlSource.includes('min-width: 0'), 'playback controls preserve narrow min-width constraints');
    check(browserSource.includes('trusted操作') && browserSource.includes('wp034-playback-open') && browserSource.includes('wp034-playback-inspect'), 'Browser fixture exposes manual trusted playback inspection');
    check(!browserSource.includes('dispatchEvent') && !browserSource.includes('PointerEvent') && !browserSource.includes('KeyboardEvent'), 'Browser fixture does not synthesize input events');
}

const fixedCache = await verifyFixedCache();
check(fixedCache.ok, 'fixed SDK/cache gate: ' + (fixedCache.reason || 'unknown'));
await verifyController();
await verifyWiring();

const result = {
    schema: 'tegaki.rive-editor.playback-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    fixedCache,
    controller: failures.length ? 'FAIL' : 'PASS',
    native: 'UNVERIFIED — this verifier is pure/static and does not spawn 18729',
    browser: 'UNVERIFIED — wp034-rive-playback-browser.html requires trusted manual interaction',
};
await fs.mkdir(cacheRoot, { recursive: true });
await fs.writeFile(path.join(cacheRoot, 'wp034-rive-playback-verification.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
if (failures.length) {
    console.error('verify-rive-editor-playback: FAIL (' + failures.length + ')');
    for (const failure of failures) console.error('- ' + failure);
    process.exitCode = 1;
} else {
    console.log('verify-rive-editor-playback: PASS (checks=' + checks.length + '; native=UNVERIFIED; browser=UNVERIFIED; cache=' + (fixedCache.reason || 'unknown') + ')');
}

