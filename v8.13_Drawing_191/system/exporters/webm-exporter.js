/**
 * WebM Exporter - AnimationWebM Video Exporter
 * 
 * Dependencies:
 *   - window.TegakiEventBus (system/event-bus.js)
 *   - window.AnimationSystem (system/animation-system.js)
 *   - window.layerManager (system/layer-system.js)
 *   - PIXI (CDN)
 * 
 * Exports animated frames as WebM video with alpha channel support (VP9 codec).
 * Uses browser-native MediaRecorder API - no WASM required, works with file:// protocol.
 */

window.WebMExporter = (function() {
    'use strict';

    class WebMExporter {
        constructor(exportManager) {
            this.manager = exportManager;
            this.isRecording = false;
        }

        /**
         * Export animation as WebM video
         * @param {Object} options - Export options
         * @param {string} options.filename - Output filename
         * @param {number} options.quality - Video quality (0-1, default: 0.95)
         * @returns {Promise<Object>} Result object with blob and metadata
         */
        async export(options = {}) {
            if (this.isRecording) {
                throw new Error('WebM export already in progress');
            }

            try {
                this.isRecording = true;

                // Get animation data
                const animData = this.manager.animationSystem.getAnimationData();
                const totalFrames = animData.frames.length;
                const fps = animData.fps || 12;

                if (totalFrames === 0) {
                    throw new Error('No frames to export');
                }

                // Get PixiJS canvas
                const canvas = this.manager.app.renderer.view;
                if (!canvas) {
                    throw new Error('Canvas not found');
                }

                // Capture stream from canvas
                const stream = canvas.captureStream(fps);

                // Setup MediaRecorder with VP9 for alpha support
                const mimeType = this._selectMimeType();
                const recorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: this._calculateBitrate(canvas.width, canvas.height, fps)
                });

                // Record video
                const recordedBlob = await this._recordAnimation(recorder, totalFrames, fps);

                // Download
                const filename = options.filename || `tegaki_animation_${Date.now()}.webm`;
                this._downloadBlob(recordedBlob, filename);

                return {
                    blob: recordedBlob,
                    filename: filename,
                    format: 'webm',
                    frames: totalFrames,
                    fps: fps,
                    size: recordedBlob.size
                };

            } finally {
                this.isRecording = false;
            }
        }

        /**
         * Select best available MIME type with alpha support
         * @private
         */
        _selectMimeType() {
            const candidates = [
                'video/webm;codecs=vp9',      // Best: VP9 with alpha
                'video/webm;codecs=vp8',      // Fallback: VP8 with alpha
                'video/webm'                   // Generic fallback
            ];

            for (const mimeType of candidates) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    return mimeType;
                }
            }

            throw new Error('WebM recording not supported in this browser');
        }

        /**
         * Calculate optimal bitrate based on resolution
         * @private
         */
        _calculateBitrate(width, height, fps) {
            const pixelsPerFrame = width * height;
            const pixelsPerSecond = pixelsPerFrame * fps;
            // ~0.1 bits per pixel for high quality with alpha
            return Math.floor(pixelsPerSecond * 0.1);
        }

        /**
         * Record animation frames
         * @private
         */
        async _recordAnimation(recorder, totalFrames, fps) {
            const chunks = [];

            // Setup data collection
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            // Create promise that resolves when recording stops
            const recordingPromise = new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: recorder.mimeType });
                    resolve(blob);
                };

                recorder.onerror = (event) => {
                    reject(new Error(`Recording error: ${event.error}`));
                };
            });

            // Start recording
            recorder.start();

            // Process each frame
            await this._processFrames(totalFrames, fps);

            // Stop recording and wait for blob
            recorder.stop();
            return await recordingPromise;
        }

        /**
         * Process animation frames sequentially
         * @private
         */
        async _processFrames(totalFrames, fps) {
            const frameDuration = 1000 / fps;
            const animSystem = this.manager.animationSystem;
            const currentFrame = animSystem.currentFrame;

            try {
                for (let i = 0; i < totalFrames; i++) {
                    // Set frame
                    animSystem.setCurrentFrame(i);

                    // Wait for render
                    await this._waitForFrame();

                    // Emit progress
                    window.TegakiEventBus.emit('export:progress', {
                        current: i + 1,
                        total: totalFrames,
                        progress: Math.round(((i + 1) / totalFrames) * 100)
                    });

                    // Wait for frame duration to ensure proper timing
                    await this._sleep(frameDuration);
                }
            } finally {
                // Restore original frame
                animSystem.setCurrentFrame(currentFrame);
            }
        }

        /**
         * Wait for next animation frame
         * @private
         */
        _waitForFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    // Double RAF for better stability
                    requestAnimationFrame(resolve);
                });
            });
        }

        /**
         * Sleep for specified milliseconds
         * @private
         */
        _sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Download blob as file
         * @private
         */
        _downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    return WebMExporter;
})();