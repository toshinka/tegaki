// src/engine/ToolController.js - OGL統一ツール制御システム
// v5.2 OGL統一エンジン専用ツール制御

// OGL統一ツール設定定数
const OGL_TOOL_DEFINITIONS = {
    pen: {
        id: 'pen',
        name: 'ペン',
        type: 'drawing',
        icon: 'pen',
        shortcut: 'P',
        oglConfig: {
            polyline: {
                lineWidth: 3,
                color: [0, 0, 0, 1], // RGBA (黒、不透明)
                smooth: true,
                join: 'round',
                cap: 'round'
            },
            shader: 'pen',
            blend: 'normal',
            renderMode: 'line'
        },
        properties: {
            size: { min: 1, max: 50, default: 3, step: 1 },
            opacity: { min: 1, max: 100, default: 100, step: 1 }
        }
    },
    
    brush: {
        id: 'brush',
        name: 'ブラシ',
        type: 'drawing',
        icon: 'brush',
        shortcut: 'B',
        oglConfig: {
            polyline: {
                lineWidth: 8,
                color: [0, 0, 0, 0.8], // RGBA (黒、半透明)
                smooth: true,
                join: 'round',
                cap: 'round'
            },
            shader: 'brush',
            blend: 'multiply',
            renderMode: 'line_textured'
        },
        properties: {
            size: { min: 2, max: 100, default: 8, step: 1 },
            opacity: { min: 10, max: 100, default: 80, step: 5 }
        }
    },
    
    eraser: {
        id: 'eraser',
        name: '消しゴム',
        type: 'erasing',
        icon: 'eraser',
        shortcut: 'E',
        oglConfig: {
            polyline: {
                lineWidth: 10,
                color: [1, 1, 1, 1], // RGBA (白、完全不透明)
                smooth: true,
                join: 'round',
                cap: 'round'
            },
            shader: 'eraser',
            blend: 'destination-out',
            renderMode: 'erase'
        },
        properties: {
            size: { min: 5, max: 100, default: 10, step: 1 }
        }
    }
};

export class ToolController {
    constructor(oglEngine) {
        console.log('🔧 OGL統一ツールコントローラー構築開始...');
        
        this.oglEngine = oglEngine;
        this.currentTool = null;
        this.currentToolConfig = null;
        this.toolInstances = new Map();
        this.eventTarget = new EventTarget();
        
        // ツール設定バリデーター
        this.validator = new ToolValidator();
        
        // 初期化
        this.initializeTools();
        
        console.log('🔧 OGL統一ツールコントローラー構築完了');
    }

    initializeTools() {
        console.log('🔧 OGLツール初期化開始...');
        
        try {
            // 各ツール定義を検証・登録
            Object.values(OGL_TOOL_DEFINITIONS).forEach(toolDef => {
                if (this.validator.validateToolDefinition(toolDef)) {
                    this.toolInstances.set(toolDef.id, {
                        definition: toolDef,
                        config: this.createToolConfig(toolDef),
                        isActive: false,
                        lastUsed: null
                    });
                    console.log(`✅ ツール登録完了: ${toolDef.name} (${toolDef.id})`);
                } else {
                    console.error(`❌ ツール定義エラー: ${toolDef.id}`);
                }
            });

            console.log(`✅ OGLツール初期化完了: ${this.toolInstances.size}個のツールを登録`);
            
        } catch (error) {
            console.error('❌ ツール初期化エラー:', error);
            throw error;
        }
    }

    createToolConfig(toolDefinition) {
        return {
            ...toolDefinition.oglConfig,
            properties: { ...toolDefinition.properties },
            meta: {
                id: toolDefinition.id,
                name: toolDefinition.name,
                type: toolDefinition.type,
                created: Date.now()
            }
        };
    }

    // === ツール選択（OGL統一エンジン制御） ===
    async selectTool(toolId) {
        console.log(`🔧 ツール選択開始: ${toolId}`);

        try {
            // ツール存在確認
            const toolInstance = this.toolInstances.get(toolId);
            if (!toolInstance) {
                throw new Error(`未知のツール: ${toolId}`);
            }

            // 現在のツールを非アクティブに
            if (this.currentTool) {
                const currentInstance = this.toolInstances.get(this.currentTool);
                if (currentInstance) {
                    currentInstance.isActive = false;
                }
            }

            // 新しいツールをアクティブに
            toolInstance.isActive = true;
            toolInstance.lastUsed = Date.now();

            // OGL統一エンジンに設定適用
            await this.applyToolToOGLEngine(toolInstance);

            // 状態更新
            this.currentTool = toolId;
            this.currentToolConfig = toolInstance.config;

            // イベント発火
            this.dispatchToolChangeEvent(toolInstance);

            console.log(`✅ ツール選択完了: ${toolInstance.definition.name} (${toolId})`);
            return toolInstance;

        } catch (error) {
            console.error(`❌ ツール選択エラー (${toolId}):`, error);
            throw error;
        }
    }

    async applyToolToOGLEngine(toolInstance) {
        if (!this.oglEngine) {
            throw new Error('OGL統一エンジンが未初期化');
        }

        console.log(`🎨 OGLエンジンにツール設定適用: ${toolInstance.definition.name}`);

        try {
            // OGL統一エンジンのselectToolメソッドを呼び出し
            await this.oglEngine.selectTool(toolInstance.definition.id);
            
            console.log(`✅ OGLエンジンツール設定適用完了`);
            
        } catch (error) {
            console.error('❌ OGLエンジンツール設定適用エラー:', error);
            throw error;
        }
    }

    // === ツールプロパティ制御 ===
    updateToolProperty(property, value) {
        if (!this.currentTool) {
            console.warn('⚠️ アクティブなツールがありません');
            return;
        }

        console.log(`🎛️ ツールプロパティ更新: ${property} = ${value}`);

        try {
            const toolInstance = this.toolInstances.get(this.currentTool);
            if (!toolInstance) {
                throw new Error(`ツールインスタンス未発見: ${this.currentTool}`);
            }

            // プロパティ値検証
            const validatedValue = this.validator.validatePropertyValue(
                toolInstance.definition,
                property,
                value
            );

            // ツール設定更新
            this.updateToolConfig(toolInstance, property, validatedValue);

            // OGL統一エンジンに反映
            if (this.oglEngine) {
                this.oglEngine.updateToolProperty(property, validatedValue);
            }

            // イベント発火
            this.dispatchPropertyChangeEvent(property, validatedValue);

            console.log(`✅ プロパティ更新完了: ${property} = ${validatedValue}`);

        } catch (error) {
            console.error(`❌ プロパティ更新エラー (${property}: ${value}):`, error);
        }
    }

    updateToolConfig(toolInstance, property, value) {
        switch (property) {
            case 'size':
                toolInstance.config.polyline.lineWidth = value;
                break;
            case 'opacity':
                // RGBA配列のAlpha値を更新
                const alpha = value / 100;
                toolInstance.config.polyline.color[3] = alpha;
                break;
            default:
                console.warn(`未対応プロパティ: ${property}`);
        }
    }

    // === ツール情報取得 ===
    getCurrentTool() {
        return this.currentTool;
    }

    getCurrentToolInstance() {
        return this.currentTool ? this.toolInstances.get(this.currentTool) : null;
    }

    getCurrentToolConfig() {
        return this.currentToolConfig;
    }

    getCurrentToolSettings() {
        const instance = this.getCurrentToolInstance();
        if (!instance) return null;

        return {
            tool: instance.definition.id,
            name: instance.definition.name,
            size: instance.config.polyline.lineWidth,
            opacity: Math.round(instance.config.polyline.color[3] * 100),
            color: instance.config.polyline.color,
            type: instance.definition.type
        };
    }

    getAvailableTools() {
        return Array.from(this.toolInstances.values()).map(instance => ({
            id: instance.definition.id,
            name: instance.definition.name,
            icon: instance.definition.icon,
            shortcut: instance.definition.shortcut,
            type: instance.definition.type,
            isActive: instance.isActive
        }));
    }

    getToolProperties(toolId) {
        const instance = this.toolInstances.get(toolId);
        return instance ? instance.definition.properties : null;
    }

    // === ショートカット処理 ===
    handleKeyboardShortcut(key) {
        const normalizedKey = key.toUpperCase();
        
        for (const [toolId, instance] of this.toolInstances) {
            if (instance.definition.shortcut === normalizedKey) {
                console.log(`⌨️ ショートカット処理: ${key} → ${toolId}`);
                this.selectTool(toolId);
                return true;
            }
        }
        
        return false;
    }

    // === イベント制御 ===
    dispatchToolChangeEvent(toolInstance) {
        const event = new CustomEvent('toolChanged', {
            detail: {
                tool: toolInstance.definition.id,
                name: toolInstance.definition.name,
                config: toolInstance.config,
                timestamp: Date.now()
            }
        });
        
        this.eventTarget.dispatchEvent(event);
    }

    dispatchPropertyChangeEvent(property, value) {
        const event = new CustomEvent('propertyChanged', {
            detail: {
                tool: this.currentTool,
                property: property,
                value: value,
                timestamp: Date.now()
            }
        });
        
        this.eventTarget.dispatchEvent(event);
    }

    addEventListener(type, listener) {
        this.eventTarget.addEventListener(type, listener);
    }

    removeEventListener(type, listener) {
        this.eventTarget.removeEventListener(type, listener);
    }

    // === バリデーション・ユーティリティ ===
    isValidTool(toolId) {
        return this.toolInstances.has(toolId);
    }

    isToolActive(toolId) {
        const instance = this.toolInstances.get(toolId);
        return instance ? instance.isActive : false;
    }

    // === デバッグ用 ===
    getDebugInfo() {
        return {
            currentTool: this.currentTool,
            registeredTools: Array.from(this.toolInstances.keys()),
            activeTools: Array.from(this.toolInstances.values())
                .filter(instance => instance.isActive)
                .map(instance => instance.definition.id),
            currentConfig: this.currentToolConfig,
            engineConnected: !!this.oglEngine
        };
    }

    logStatus() {
        console.log('🔧 ToolController状態:', this.getDebugInfo());
    }

    // === 廃棄処理 ===
    dispose() {
        console.log('🧹 ToolController廃棄開始...');

        try {
            // イベントリスナークリア
            this.eventTarget = new EventTarget();
            
            // ツールインスタンスクリア
            this.toolInstances.clear();
            
            // 参照クリア
            this.oglEngine = null;
            this.currentTool = null;
            this.currentToolConfig = null;

            console.log('✅ ToolController廃棄完了');

        } catch (error) {
            console.error('❌ ToolController廃棄エラー:', error);
        }
    }
}

// === ツールバリデーター ===
class ToolValidator {
    validateToolDefinition(toolDef) {
        try {
            // 必須プロパティチェック
            const requiredProps = ['id', 'name', 'type', 'oglConfig'];
            for (const prop of requiredProps) {
                if (!toolDef[prop]) {
                    throw new Error(`必須プロパティ未定義: ${prop}`);
                }
            }

            // OGL統一設定チェック
            if (!toolDef.oglConfig.polyline) {
                throw new Error('OGL polyline設定が未定義');
            }

            // カラー配列チェック
            const color = toolDef.oglConfig.polyline.color;
            if (!Array.isArray(color) || color.length !== 4) {
                throw new Error('colorはRGBA配列である必要があります');
            }

            return true;

        } catch (error) {
            console.error(`ツール定義バリデーションエラー (${toolDef.id}):`, error);
            return false;
        }
    }

    validatePropertyValue(toolDefinition, property, value) {
        const props = toolDefinition.properties;
        if (!props || !props[property]) {
            console.warn(`未定義プロパティ: ${property}`);
            return value;
        }

        const propDef = props[property];
        const numValue = Number(value);

        if (isNaN(numValue)) {
            console.warn(`数値以外の値: ${property} = ${value}`);
            return propDef.default;
        }

        // 範囲チェック
        const clampedValue = Math.max(propDef.min, Math.min(propDef.max, numValue));
        
        if (clampedValue !== numValue) {
            console.warn(`値が範囲外のためクランプ: ${property} ${numValue} → ${clampedValue}`);
        }

        return clampedValue;
    }
}