/**
 * WebGPUCapabilities - WebGPU対応チェック・機能検出
 * Phase 4-A-1: WebGPU基盤構築
 * 
 * 責務: WebGPU利用可能性の判定とデバイス機能の取得
 */

(function() {
    'use strict';

    class WebGPUCapabilities {
        /**
         * WebGPU対応状況をチェック
         * @returns {Promise<Object>} {supported, adapter, device, limits, features, error}
         */
        static async checkSupport() {
            const result = {
                supported: false,
                adapter: null,
                device: null,
                limits: null,
                features: [],
                error: null
            };

            // navigator.gpu存在確認
            if (!navigator.gpu) {
                result.error = 'WebGPU not available (navigator.gpu is undefined)';
                return result;
            }

            try {
                // Adapter取得
                const adapter = await navigator.gpu.requestAdapter({
                    powerPreference: 'high-performance'
                });

                if (!adapter) {
                    result.error = 'Failed to request WebGPU adapter';
                    return result;
                }

                result.adapter = adapter;

                // Device取得
                const device = await adapter.requestDevice();
                if (!device) {
                    result.error = 'Failed to request WebGPU device';
                    return result;
                }

                result.device = device;

                // Features取得
                result.features = Array.from(adapter.features);

                // Limits取得
                result.limits = {
                    maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
                    maxBufferSize: adapter.limits.maxBufferSize,
                    maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
                    maxComputeWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
                    maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
                    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
                    maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup
                };

                result.supported = true;

            } catch (error) {
                result.error = `WebGPU initialization error: ${error.message}`;
            }

            return result;
        }

        /**
         * 特定機能のサポート確認
         * @param {string} feature - 機能名
         * @returns {Promise<boolean>}
         */
        static async isFeatureSupported(feature) {
            try {
                const adapter = await navigator.gpu?.requestAdapter();
                if (!adapter) return false;
                return adapter.features.has(feature);
            } catch {
                return false;
            }
        }

        /**
         * デバイス制限値を取得
         * @returns {Promise<Object|null>}
         */
        static async getDeviceLimits() {
            try {
                const adapter = await navigator.gpu?.requestAdapter();
                if (!adapter) return null;
                return adapter.limits;
            } catch {
                return null;
            }
        }

        /**
         * WebGPU利用可能かを簡易チェック
         * @returns {boolean}
         */
        static isAvailable() {
            return !!navigator.gpu;
        }

        /**
         * 推奨Canvas Formatを取得
         * @returns {string|null}
         */
        static getPreferredCanvasFormat() {
            return navigator.gpu?.getPreferredCanvasFormat() || null;
        }
    }

    // グローバル登録
    window.WebGPUCapabilities = WebGPUCapabilities;

    console.log('✅ system/drawing/webgpu/webgpu-capabilities.js loaded');

})();