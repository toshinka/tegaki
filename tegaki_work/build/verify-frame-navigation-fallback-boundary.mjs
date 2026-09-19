import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../ui/timeline-ui.js', import.meta.url), 'utf8');
const window = { TegakiEventBus: null, TegakiUI: {} };
const context = {
    window,
    document: {},
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {}
};

vm.runInNewContext(source, context, { filename: 'timeline-ui.js' });

const TimelineUI = window.TegakiUI.TimelineUI;
let popup = null;
let legacySwitches = 0;
const animationSystem = {
    animationData: { playback: { currentFrameIndex: 0 } },
    getAnimationData() {
        return { frames: [{ name: 'F1' }, { name: 'F2' }] };
    },
    switchToActiveFrameSafely(index) {
        legacySwitches += 1;
        this.animationData.playback.currentFrameIndex = index;
    }
};

window.coreEngine = {
    popupManager: {
        get() { return popup; }
    }
};

function createTimeline() {
    const timeline = new TimelineUI(animationSystem);
    timeline.setActiveFrame = () => {};
    timeline.updateLayerPanelIndicator = () => {};
    timeline.currentFrameIndex = 0;
    animationSystem.animationData.playback.currentFrameIndex = 0;
    legacySwitches = 0;
    return timeline;
}

{
    const timeline = createTimeline();
    let tableMoves = 0;
    popup = {
        model: { playback: { currentFrame: 0 } },
        moveTimelineFrameByDelta(delta) {
            tableMoves += 1;
            this.model.playback.currentFrame += delta;
            return true;
        }
    };
    assert.equal(timeline.goToNextFrameSafe(), true);
    assert.equal(tableMoves, 1, 'successful Table movement uses the Table terminal');
    assert.equal(legacySwitches, 0, 'successful Table movement does not use legacy fallback');
}

{
    const timeline = createTimeline();
    popup = {
        model: { playback: { currentFrame: 0 } },
        moveTimelineFrameByDelta() {
            return false;
        }
    };
    assert.equal(timeline.goToNextFrameSafe(), false);
    assert.equal(legacySwitches, 0, 'Table rejection does not use legacy fallback');
    assert.equal(animationSystem.animationData.playback.currentFrameIndex, 0);
}

{
    const timeline = createTimeline();
    popup = {
        isVisible: false,
        model: { playback: { currentFrame: 0 } },
        moveTimelineFrameByDelta() {
            return false;
        }
    };
    assert.equal(timeline.goToPreviousFrameSafe(), false);
    assert.equal(legacySwitches, 0, 'closed Table context still owns a rejected request');
    assert.equal(animationSystem.animationData.playback.currentFrameIndex, 0);
}

{
    const timeline = createTimeline();
    popup = null;
    assert.equal(timeline.goToNextFrameSafe(), undefined);
    assert.equal(legacySwitches, 1, 'without a Table route, legacy movement remains available');
    assert.equal(animationSystem.animationData.playback.currentFrameIndex, 1);
}

console.log('verify-frame-navigation-fallback-boundary: success, rejection, closed-context rejection, and legacy route distinguished');
