/**
 * main.js - WebGL2専用アプリケーション初期化
 */

import { ServiceContainer } from './core/ServiceContainer.js';
import { ToolEngineController } from './core/ToolEngineController.js';
import { BezierStrokeRenderer } from './engine/BezierStrokeRenderer.js';
import { Canvas2DRenderer } from './engine/Canvas2DRenderer.js';
import { ToolStore } from './tools/ToolStore.js';
import { ToolPanel } from './ui/ToolPanel.js';
import * as twgl from 'twgl.js';
import { Bezier } from "bezier-js";

let isDrawing = false;

/**
 * WebGL2サポート診断
 */
function diagnoseWebGL2Support() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    
    if (!gl) {
        return { 
            supported: false, 
            reason: 'WebGL2が利用できません',
            details: 'ブラウザまたは環境がWebGL2をサポートしていません'
        };
    }
    
    return { supported: true };
}

/**
 * エラー表示
 */
function showError(message, details = '') {
    const overlay = document.getElementById('error-overlay');
    const messageEl = document.getElementById('error-message');
    const detailsEl = overlay.querySelector('.error-details');
    
    messageEl.textContent = message;
    detailsEl.textContent = details;
    overlay.style.display = 'flex';
    
    console.error('初期化失敗:', message, details);
}

/**
 * WebGL2シェーダー定義（修正版）
 */
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in float a_width;
in vec4 a_color;

uniform vec2 u_resolution;

out vec4 v_color;
out float v_width;

void main() {
    // 正しいgl_Position使用
    vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    
    v_color = a_color;
    v_width = a_width;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_width;

out vec4 outColor;

void main() {
    outColor = v_color;
}`;

async function initializeApp() {
    console.log('🚀 WebGL2専用アプリケーション初期化開始');

    // WebGL2サポート診断
    const webglDiagnosis = diagnoseWebGL2Support();
    if (!webglDiagnosis.supported) {
        showError(webglDiagnosis.reason, webglDiagnosis.details);
        return;
    }

    // ServiceContainer初期化
    const container = ServiceContainer.getInstance();
    const canvas = document.getElementById('vector-canvas');

    // WebGL2コンテキスト作成
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        showError('WebGL2コンテキスト作成失敗');
        return;
    }

    try {
        // シェーダープログラム作成
        const programInfo = twgl.createProgramInfo(gl, [VERTEX_SHADER, FRAGMENT_SHADER]);
        
        // WebGL基本設定
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // DIコンテナ登録
        container.register('gl', gl);
        container.register('programInfo', programInfo);

        // エンジン初期化（憲章準拠：ツール・エンジン厳格連動）
        const bezierRenderer = new BezierStrokeRenderer(canvas, container);
        const canvas2DRenderer = new Canvas2DRenderer(canvas);
        
        container.register('BezierStrokeRenderer', bezierRenderer);
        container.register('Canvas2DRenderer', canvas2DRenderer);

        // ツール制御初期化
        const toolStore = new ToolStore();
        container.register('toolStore', toolStore);

        const toolEngineController = new ToolEngineController(container);
        container.register('toolEngineController', toolEngineController);

        // UI初期化
        const toolbarElement = document.getElementById('toolbar');
        const toolPanel = new ToolPanel(toolbarElement, container);

        // イベントリスナー設定
        setupEventListeners(container);

        console.log('✅ WebGL2アプリケーション初期化完了');

    } catch (error) {
        console.error('WebGL初期化エラー:', error);
        showError('WebGL初期化エラー', error.message);
    }
}

function setupEventListeners(container) {
    const toolStore = container.resolve('toolStore');
    const toolEngineController = container.resolve('toolEngineController');

    // ツール設定制御
    document.getElementById('penSizeSlider')?.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        toolStore.updateToolSettings('pen', { size });
        toolEngineController.updateCurrentToolSettings({ size });
    });

    // キャンバス描画制御
    const canvas = document.getElementById('vector-canvas');
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        
        const rect = canvas.getBoundingClientRect();
        const pointerData = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || 0.5
        };
        
        toolEngineController.handlePointerDown(pointerData);
        isDrawing = true;
        e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const pointerData = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || 0.5
        };
        
        toolEngineController.handlePointerMove(pointerData);
        e.preventDefault();
    });

    const onPointerUp = (e) => {
        if (isDrawing) {
            toolEngineController.handlePointerUp();
            isDrawing = false;
            if (canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId);
            }
        }
        e.preventDefault();
    };

    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
}

// 初期化実行
document.addEventListener('DOMContentLoaded', initializeApp);