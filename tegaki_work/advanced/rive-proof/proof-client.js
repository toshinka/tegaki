import Rive from '/runtime/canvas_advanced.mjs';

const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
const outputCanvas = document.querySelector('#output-canvas');
const outputContext = outputCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
const statusNode = document.querySelector('#status');
const metricsNode = document.querySelector('#metrics');
const angleNode = document.querySelector('#angle');
const scrubNode = document.querySelector('#scrub');
const scrubValueNode = document.querySelector('#scrub-value');

let rive = null;
let file = null;
let artboard = null;
let renderer = null;
let outputRenderer = null;
let animation = null;
let animationInstance = null;
let currentState = null;
let lastPoses = [];
let roundTrip = {
  initial: null,
  edits: [],
  saved: null,
  reopened: null,
  cancelled: null,
  rejections: [],
  timings: { scrubWarmMs: null, scrubWarmRenderMs: null, compileToReloadMs: null },
};

function setStatus(message) {
  statusNode.textContent = message;
}

function runtimeOptions() {
  return { locateFile: (name) => `/runtime/${name === 'canvas_advanced.wasm' ? 'rive.wasm' : name}` };
}

async function createRuntime() {
  rive = await Rive(runtimeOptions());
}

function disposeScene() {
  try { animationInstance?.delete?.(); } catch {}
  try { animation?.delete?.(); } catch {}
  try { artboard?.delete?.(); } catch {}
  try { file?.unref?.(); } catch {}
  try { renderer?.delete?.(); } catch {}
  try { outputRenderer?.delete?.(); } catch {}
  animationInstance = null;
  animation = null;
  artboard = null;
  file = null;
  renderer = null;
  outputRenderer = null;
}

async function newRuntimeInstance() {
  disposeScene();
  try { rive?.cleanup?.(); } catch {}
  rive = null;
  await createRuntime();
}

function metricsFor(imageData) {
  const { data, width, height } = imageData;
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 8) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
    }
  }
  return {
    alphaPixels: count,
    bbox: count ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    centroid: count ? { x: Number((sumX / count).toFixed(2)), y: Number((sumY / count).toFixed(2)) } : null,
  };
}

function diffPixels(a, b) {
  if (!a || !b || a.data.length !== b.data.length) return 0;
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 2 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 2 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 2 || Math.abs(a.data[i + 3] - b.data[i + 3]) > 2) diff += 1;
  }
  return diff;
}

function drawRenderer(targetCanvas, targetRenderer, targetContext) {
  targetRenderer.beginFrame(true);
  targetRenderer.save();
  targetRenderer.align(
    rive.Fit.contain,
    rive.Alignment.center,
    { minX: 0, minY: 0, maxX: targetCanvas.width, maxY: targetCanvas.height },
    artboard.bounds,
  );
  artboard.draw(targetRenderer);
  targetRenderer.restore();
  rive.resolveAnimationFrame();
  return targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
}

function drawPose(progress) {
  if (!rive || !artboard || !renderer || !outputRenderer || !animationInstance) throw new Error('Runtime scene is not loaded.');
  // The fixture is deliberately fixed at 60 frames / 60 fps, so this is an explicit
  // seconds seek rather than an implicit play-loop advance.
  const seconds = progress;
  animationInstance.time = 0;
  animationInstance.advance(seconds);
  animationInstance.apply(1);
  artboard.advance(0);
  const endBone = artboard.bone('End');
  const boneRotation = endBone ? Number(endBone.rotation.toFixed(6)) : null;
  const previewImageData = drawRenderer(canvas, renderer, context);
  const outputImageData = drawRenderer(outputCanvas, outputRenderer, outputContext);
  return { previewImageData, outputImageData, boneRotation, seconds, animationDuration: 60, animationFps: 60, animationTime: Number.isFinite(animationInstance.time) ? animationInstance.time : null };
}

function pngBytes(canvasNode) {
  const dataUrl = canvasNode.toDataURL('image/png');
  const encoded = dataUrl.slice('data:image/png;base64,'.length);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function uploadPng(canvasNode, pose) {
  const response = await fetch(`/api/png?pose=${encodeURIComponent(pose)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-proof-nonce': currentState?.nonce || '' },
    body: pngBytes(canvasNode),
  });
  const value = await response.json();
  if (!value.ok) throw new Error(value.error || 'PNG save failed');
  return value;
}

async function savePng(pose, frame) {
  const outputValue = await uploadPng(outputCanvas, `pose-1x-${pose}`);
  const previewValue = await uploadPng(canvas, `pose-2x-${pose}`);
  return {
    path: outputValue.path,
    png: outputValue.path,
    previewPng: previewValue.path,
    bytes: outputValue.bytes,
    sha256: outputValue.sha256,
    outputCanvas: { width: outputCanvas.width, height: outputCanvas.height },
    previewCanvas: { width: canvas.width, height: canvas.height },
    metrics: metricsFor(frame.outputImageData),
    previewMetrics: metricsFor(frame.previewImageData),
    boneRotation: frame.boneRotation,
    seconds: frame.seconds,
    animationDuration: frame.animationDuration,
    animationFps: frame.animationFps,
    animationTime: frame.animationTime,
  };
}

async function renderProofPoses() {
  const samples = [0, 0.5, 1];
  const images = [];
  const previewImages = [];
  const poses = [];
  for (const progress of samples) {
    const frame = drawPose(progress);
    images.push(frame.outputImageData);
    previewImages.push(frame.previewImageData);
    poses.push({ progress, ...(await savePng(`pose-${String(progress).replace('.', '-')}`, frame)) });
  }
  const diff = diffPixels(images[0], images[2]);
  const previewDiff = diffPixels(previewImages[0], previewImages[2]);
  lastPoses = poses.map((pose) => ({ progress: pose.progress, boneRotation: pose.boneRotation, seconds: pose.seconds, animationDuration: pose.animationDuration, animationFps: pose.animationFps, animationTime: pose.animationTime, metrics: pose.metrics, previewMetrics: pose.previewMetrics, png: pose.png, previewPng: pose.previewPng, outputCanvas: pose.outputCanvas, previewCanvas: pose.previewCanvas }));
  metricsNode.textContent = JSON.stringify({
    angle: currentState?.angle,
    buildId: currentState?.buildId,
    poses: lastPoses,
    pixelDiffPose0To1: diff,
    previewPixelDiffPose0To1: previewDiff,
  }, null, 2);
  return { poses: lastPoses, pixelDiffPose0To1: diff, previewPixelDiffPose0To1: previewDiff, outputCanvas: { width: outputCanvas.width, height: outputCanvas.height }, previewCanvas: { width: canvas.width, height: canvas.height } };
}

async function loadBuild(artifactUrl) {
  const response = await fetch(`${artifactUrl}${artifactUrl.includes('?') ? '&' : '?'}nonce=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Rive artifact fetch failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  file = await rive.load(bytes, undefined, false);
  artboard = file.defaultArtboard();
  renderer = rive.makeRenderer(canvas);
  outputRenderer = rive.makeRenderer(outputCanvas);
  animation = artboard.animationByName('EndPose');
  if (!animation) throw new Error('EndPose animation was not found in the .riv.');
  animationInstance = new rive.LinearAnimationInstance(animation, artboard);
  return renderProofPoses();
}

async function getState() {
  const response = await fetch(`/api/state?nonce=${Date.now()}`, { cache: 'no-store' });
  const value = await response.json();
  if (!value.ok) throw new Error(value.error || 'Proof server is not ready.');
  currentState = value;
  return value;
}

async function post(endpoint, body = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-proof-nonce': currentState?.nonce || '' },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  return { response, value };
}

async function applyAngle() {
  const angle = Number(angleNode.value);
  setStatus(`Compiling end angle ${angle}° with the official Rive CLI…`);
  const { response, value } = await post('/api/compile', { angle, scrub: Number(scrubNode.value) });
  if (!response.ok || !value.ok) {
    setStatus(`Rejected: ${value.message || value.error}`);
    return;
  }
  currentState = value;
  disposeScene();
  const proof = await loadBuild(value.artifactUrl);
  roundTrip.edits.push({ angle: value.angle, buildId: value.buildId, ...proof });
  setStatus(`Loaded compiled source at end angle ${value.angle}°. Pose 0, 0.5, and 1 PNGs saved.`);
}

async function saveBundle() {
  const { response, value } = await post('/api/save');
  if (!response.ok || !value.ok) throw new Error(value.message || value.error || 'Save failed');
  currentState = value;
  roundTrip.saved = { buildId: value.buildId, savedBuildId: value.savedBuildId, angle: value.savedAngle };
  setStatus(`Saved source bundle at ${value.savedAngle}°. The next reopen disposes this runtime first.`);
}

async function reopenBundle() {
  const before = currentState?.buildId;
  const startedAt = performance.now();
  setStatus('Rebuilding saved source, disposing the original runtime, and loading a new Web instance…');
  const { response, value } = await post('/api/reopen');
  if (!response.ok || !value.ok) throw new Error(value.message || value.error || 'Reopen failed');
  await newRuntimeInstance();
  currentState = value;
  const proof = await loadBuild(value.artifactUrl);
  roundTrip.timings.compileToReloadMs = Number((performance.now() - startedAt).toFixed(2));
  roundTrip.reopened = { beforeBuildId: before, afterBuildId: value.buildId, angle: value.angle, ...proof };
  await post('/api/record', { phase: 'reopen', roundTrip });
  setStatus(`Reopened saved bundle in a new Web runtime instance. Build ${value.buildId}; pose diff ${proof.pixelDiffPose0To1} pixels.`);
}

async function cancelBundle() {
  const { response, value } = await post('/api/cancel');
  if (!response.ok || !value.ok) throw new Error(value.message || value.error || 'Cancel failed');
  currentState = value;
  disposeScene();
  await loadBuild(value.artifactUrl);
  roundTrip.cancelled = { buildId: value.buildId, angle: value.angle, poses: lastPoses };
  await post('/api/record', { phase: 'cancel', roundTrip });
  setStatus(`Cancelled to saved good state at ${value.angle}°. Current build ${value.buildId}.`);
}

async function rejectAngle() {
  const beforeBuildId = currentState?.buildId;
  const first = await post('/api/compile', { angle: 'NaN', scrub: 0 });
  const second = await post('/api/compile', { angle: 120, scrub: 0 });
  const stateAfter = await getState();
  const retained = first.response.status === 400 && second.response.status === 400 && stateAfter.buildId === beforeBuildId;
  roundTrip.rejections.push({ kind: 'angle', retained, first: first.value.error, second: second.value.error, buildId: beforeBuildId });
  await post('/api/record', { phase: 'angle-rejection', roundTrip });
  setStatus(retained ? `Rejected NaN and 120°; last good build ${stateAfter.buildId} was retained.` : 'Angle rejection proof failed.');
}

async function rejectSource() {
  const before = currentState?.buildId;
  const { response, value } = await post('/api/reopen', { corrupt: 'source' });
  const stateAfter = await getState();
  const retained = !response.ok && value.error === 'source-rejected' && stateAfter.buildId === before;
  roundTrip.rejections.push({ kind: 'source', retained, buildId: stateAfter.buildId });
  await post('/api/record', { phase: 'source-rejection', roundTrip });
  setStatus(retained ? `Rejected corrupt source bundle; last good build ${before} was retained.` : 'Corrupt source rejection proof failed.');
}

async function rejectRiv() {
  const before = currentState?.buildId;
  await (await fetch(`${currentState.artifactUrl}&corrupt-test=${Date.now()}`, { cache: 'no-store' })).arrayBuffer();
  // An invalid container header is an unmistakably corrupt Rive file and must not
  // replace the last good file in either the runtime or the companion validator.
  const source = new Uint8Array(16);
  let rejected = false;
  try {
    const badFile = await rive.load(source, undefined, false);
    const badArtboard = badFile?.defaultArtboard?.();
    rejected = !badArtboard || !badArtboard.animationByName?.('EndPose');
    try { badArtboard?.delete?.(); } catch {}
    badFile?.unref?.();
  } catch {
    rejected = true;
  }
  const { response, value } = await post('/api/reopen', { corrupt: 'riv' });
  rejected = rejected && !response.ok && value.error === 'riv-rejected';
  const stateAfter = await getState();
  const retained = rejected && stateAfter.buildId === before;
  roundTrip.rejections.push({ kind: 'riv', retained, runtimeRejected: rejected, buildId: stateAfter.buildId });
  if (retained) {
    await newRuntimeInstance();
    currentState = stateAfter;
    await loadBuild(stateAfter.artifactUrl);
  }
  await post('/api/record', { phase: 'final', roundTrip });
  setStatus(retained ? `Rejected corrupt .riv bytes in the Web runtime; last good build ${before} was reloaded.` : 'Corrupt .riv rejection proof failed.');
}

async function initialLoad() {
  await createRuntime();
  currentState = await getState();
  const proof = await loadBuild(currentState.artifactUrl);
  roundTrip.initial = { buildId: currentState.buildId, angle: currentState.angle, ...proof };
  await post('/api/record', { phase: 'initial', roundTrip });
  setStatus(`Loaded official Rive Web runtime 2.44.0 at ${currentState.angle}°. Pose 0, 0.5, and 1 are rendered.`);
}

scrubNode.addEventListener('input', () => {
  const progress = Number(scrubNode.value);
  scrubValueNode.value = progress.toFixed(2);
  if (!animationInstance) return;
  const startedAt = performance.now();
  const renderStartedAt = performance.now();
  const frame = drawPose(progress);
  const renderMs = Number((performance.now() - renderStartedAt).toFixed(2));
  savePng(`scrub-${progress.toFixed(2).replace('.', '-')}`, frame).then(() => {
    if (roundTrip.timings.scrubWarmMs === null) {
      roundTrip.timings.scrubWarmMs = Number((performance.now() - startedAt).toFixed(2));
      roundTrip.timings.scrubWarmRenderMs = renderMs;
      return post('/api/record', { phase: 'scrub-timing', roundTrip });
    }
    return null;
  }).catch((error) => setStatus(String(error.message || error)));
});
document.querySelector('#apply').addEventListener('click', () => applyAngle().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#save').addEventListener('click', () => saveBundle().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#reopen').addEventListener('click', () => reopenBundle().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#cancel').addEventListener('click', () => cancelBundle().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#reject-angle').addEventListener('click', () => rejectAngle().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#reject-source').addEventListener('click', () => rejectSource().catch((error) => setStatus(String(error.message || error))));
document.querySelector('#reject-riv').addEventListener('click', () => rejectRiv().catch((error) => setStatus(String(error.message || error))));

initialLoad().catch((error) => setStatus(`Proof failed: ${error.message || error}`));
