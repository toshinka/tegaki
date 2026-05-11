(function() {
    'use strict';
    
    /**
     * システム診断ツール - Phase 1対応版
     * 座標変換API・レイヤーAPI・EventBus統合・設定参照の一貫性をチェック
     */
    class SystemDiagnostics {
        constructor() {
            this.results = {};
        }
        
        // 全システム診断を実行
        runFullDiagnostics() {
            console.log('🔍 Starting System Diagnostics (Phase 1)...');
            
            this.results = {
                timestamp: new Date().toISOString(),
                phase: 'Phase 1 - Slim Timeline & Layer Integration',
                checks: {
                    pixiVersion: this.checkPixiJSVersion(),
                    coordinateSystem: this.checkCoordinateSystemAPI(),
                    eventBus: this.checkEventBusIntegration(),
                    layerSystem: this.checkLayerSystemAPI(),
                    animationSystem: this.checkAnimationSystemAPI(),
                    configuration: this.checkConfigurationConsistency(),
                    timeline: this.checkTimelineIntegration(),
                    dependencies: this.checkDependencies()
                }
            };
            
            this.printDiagnosticReport();
            return this.results;
        }
        
        // PixiJS バージョンチェック
        checkPixiJSVersion() {
            const check = {
                name: 'PixiJS Version Check',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                if (!window.PIXI) {
                    check.status = 'error';
                    check.issues.push('PIXI not found');
                    return check;
                }
                
                const version = PIXI.VERSION;
                check.details.version = version;
                check.details.expected = '8.13.0';
                
                if (version.startsWith('8.13')) {
                    check.status = 'ok';
                } else if (version.startsWith('8.')) {
                    check.status = 'warning';
                    check.issues.push(`Version mismatch: expected 8.13.x, got ${version}`);
                } else {
                    check.status = 'error';
                    check.issues.push(`Major version mismatch: expected 8.x, got ${version}`);
                }
                
                // PixiJS v8.13 API確認
                const requiredClasses = ['Application', 'Graphics', 'RenderTexture'];
                requiredClasses.forEach(className => {
                    if (!PIXI[className]) {
                        check.issues.push(`PIXI.${className} not available`);
                    }
                });
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // 座標変換API一貫性チェック
        checkCoordinateSystemAPI() {
            const check = {
                name: 'Coordinate System API',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const coordSys = window.CoordinateSystem;
                if (!coordSys) {
                    check.status = 'error';
                    check.issues.push('CoordinateSystem not found');
                    return check;
                }
                
                // 必須メソッドの存在確認
                const requiredMethods = [
                    'screenToWorld',
                    'worldToScreen', 
                    'canvasToWorld',
                    'worldToCanvas',
                    'diagnoseReferences'
                ];
                
                const availableMethods = [];
                const missingMethods = [];
                
                requiredMethods.forEach(method => {
                    if (typeof coordSys[method] === 'function') {
                        availableMethods.push(method);
                    } else {
                        missingMethods.push(method);
                    }
                });
                
                check.details.availableMethods = availableMethods;
                check.details.missingMethods = missingMethods;
                
                if (missingMethods.length === 0) {
                    check.status = 'ok';
                    
                    // API一貫性テスト
                    try {
                        const testResult = coordSys.diagnoseReferences();
                        check.details.apiTest = testResult;
                        
                        if (testResult.inconsistencies && testResult.inconsistencies.length > 0) {
                            check.status = 'warning';
                            check.issues.push('API inconsistencies detected');
                        }
                    } catch (testError) {
                        check.status = 'warning';
                        check.issues.push(`API test failed: ${testError.message}`);
                    }
                    
                } else {
                    check.status = 'error';
                    check.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // EventBus統合チェック
        checkEventBusIntegration() {
            const check = {
                name: 'EventBus Integration',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const eventBus = window.TegakiEventBus;
                if (!eventBus) {
                    check.status = 'error';
                    check.issues.push('TegakiEventBus not found');
                    return check;
                }
                
                // EventBus基本機能チェック
                const requiredMethods = ['emit', 'on', 'off'];
                const availableMethods = [];
                const missingMethods = [];
                
                requiredMethods.forEach(method => {
                    if (typeof eventBus[method] === 'function') {
                        availableMethods.push(method);
                    } else {
                        missingMethods.push(method);
                    }
                });
                
                check.details.availableMethods = availableMethods;
                check.details.missingMethods = missingMethods;
                
                if (missingMethods.length > 0) {
                    check.status = 'error';
                    check.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
                    return check;
                }
                
                // EventBus動作テスト
                let testPassed = false;
                const testEventName = 'diagnostic:test:' + Date.now();
                
                const testHandler = (data) => {
                    testPassed = (data && data.test === 'success');
                };
                
                eventBus.on(testEventName, testHandler);
                eventBus.emit(testEventName, { test: 'success' });
                eventBus.off(testEventName, testHandler);
                
                if (testPassed) {
                    check.status = 'ok';
                    check.details.functionalTest = 'passed';
                } else {
                    check.status = 'warning';
                    check.issues.push('EventBus functional test failed');
                    check.details.functionalTest = 'failed';
                }
                
                // システム間EventBus参照チェック
                const systems = ['AnimationSystem', 'TimelineUI', 'LayerSystem'];
                const systemEventBusRefs = {};
                
                systems.forEach(system => {
                    const systemClass = window[`Tegaki${system}`];
                    if (systemClass) {
                        // インスタンスがあるかチェック
                        const instanceName = system.toLowerCase().replace('system', 'System');
                        const instance = window[instanceName];
                        if (instance && instance.eventBus) {
                            systemEventBusRefs[system] = instance.eventBus === eventBus ? 'same' : 'different';
                        }
                    }
                });
                
                check.details.systemReferences = systemEventBusRefs;
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // LayerSystemAPI整合性チェック
        checkLayerSystemAPI() {
            const check = {
                name: 'LayerSystem API',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const layerSystem = window.layerSystem;
                if (!layerSystem) {
                    check.status = 'error';
                    check.issues.push('LayerSystem instance not found');
                    return check;
                }
                
                // 必須プロパティ・メソッドチェック
                const requiredProperties = ['layers', 'layerTransforms'];
                const requiredMethods = ['createLayer', 'updateLayerPanelUI', 'setActiveLayer'];
                
                const checkResults = {
                    properties: {},
                    methods: {}
                };
                
                requiredProperties.forEach(prop => {
                    checkResults.properties[prop] = layerSystem.hasOwnProperty(prop);
                });
                
                requiredMethods.forEach(method => {
                    checkResults.methods[method] = typeof layerSystem[method] === 'function';
                });
                
                check.details.apiCheck = checkResults;
                
                // レイヤー構造チェック
                if (layerSystem.layers) {
                    check.details.layerCount = layerSystem.layers.length;
                    check.details.layerStructure = layerSystem.layers.map((layer, index) => ({
                        index,
                        hasLayerData: !!layer.layerData,
                        hasId: !!(layer.layerData && layer.layerData.id),
                        visible: layer.visible,
                        alpha: layer.alpha
                    }));
                }
                
                // layerTransforms構造チェック
                if (layerSystem.layerTransforms) {
                    check.details.transformsCount = layerSystem.layerTransforms.size;
                    check.details.transformsStructure = Array.from(layerSystem.layerTransforms.entries()).map(([id, transform]) => ({
                        layerId: id,
                        hasTransform: !!transform,
                        properties: transform ? Object.keys(transform) : []
                    }));
                }
                
                // API断片化チェック
                const fragmentationIssues = [];
                
                if (!checkResults.properties.layers) {
                    fragmentationIssues.push('layers property missing');
                }
                if (!checkResults.properties.layerTransforms) {
                    fragmentationIssues.push('layerTransforms property missing');
                }
                if (!checkResults.methods.updateLayerPanelUI) {
                    fragmentationIssues.push('updateLayerPanelUI method missing');
                }
                
                if (fragmentationIssues.length > 0) {
                    check.status = 'error';
                    check.issues.push(`API fragmentation: ${fragmentationIssues.join(', ')}`);
                } else {
                    check.status = 'ok';
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // AnimationSystem統合チェック
        checkAnimationSystemAPI() {
            const check = {
                name: 'AnimationSystem Integration',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const animationSystem = window.animationSystem;
                if (!animationSystem) {
                    check.status = 'error';
                    check.issues.push('AnimationSystem instance not found');
                    return check;
                }
                
                // 必須メソッドチェック
                const requiredMethods = [
                    'createCutFromCurrentState',
                    'applyCutToLayers',
                    'play', 'pause', 'stop',
                    'getAnimationData',
                    'debugInfo'
                ];
                
                const methodCheck = {};
                requiredMethods.forEach(method => {
                    methodCheck[method] = typeof animationSystem[method] === 'function';
                });
                
                check.details.methodCheck = methodCheck;
                
                // AnimationSystem内部状態チェック
                if (typeof animationSystem.debugInfo === 'function') {
                    const debugInfo = animationSystem.debugInfo();
                    check.details.internalState = debugInfo;
                    
                    // 重要な統合ポイントのチェック
                    const integrationIssues = [];
                    
                    if (!debugInfo.eventBusAvailable) {
                        integrationIssues.push('EventBus not available');
                    }
                    
                    if (!debugInfo.layerSystemAPI || !debugInfo.layerSystemAPI.hasLayers) {
                        integrationIssues.push('LayerSystem API not properly integrated');
                    }
                    
                    if (!debugInfo.coordinateSystemAPI || debugInfo.coordinateSystemAPI.status !== 'ok') {
                        integrationIssues.push('CoordinateSystem API not available');
                    }
                    
                    if (integrationIssues.length > 0) {
                        check.status = 'warning';
                        check.issues.push(...integrationIssues);
                    } else {
                        check.status = 'ok';
                    }
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // 設定参照一貫性チェック
        checkConfigurationConsistency() {
            const check = {
                name: 'Configuration Consistency',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const config = window.TEGAKI_CONFIG;
                if (!config) {
                    check.status = 'error';
                    check.issues.push('TEGAKI_CONFIG not found');
                    return check;
                }
                
                // 必須設定セクションチェック
                const requiredSections = ['canvas', 'animation', 'drawing'];
                const sectionCheck = {};
                
                requiredSections.forEach(section => {
                    sectionCheck[section] = config.hasOwnProperty(section);
                });
                
                check.details.sectionCheck = sectionCheck;
                
                // animation設定の詳細チェック（Phase 1要件）
                if (config.animation) {
                    const animationConfig = config.animation;
                    const requiredAnimationProps = [
                        'defaultFPS',
                        'maxCuts',
                        'defaultCutDuration'
                    ];
                    
                    const animationCheck = {};
                    requiredAnimationProps.forEach(prop => {
                        animationCheck[prop] = animationConfig.hasOwnProperty(prop);
                    });
                    
                    check.details.animationConfig = animationCheck;
                    check.details.animationValues = {
                        defaultFPS: animationConfig.defaultFPS,
                        maxCuts: animationConfig.maxCuts,
                        defaultCutDuration: animationConfig.defaultCutDuration
                    };
                }
                
                // 設定参照の混在チェック
                const configReferences = this.findConfigReferences();
                check.details.configReferences = configReferences;
                
                // 一貫性評価
                const issues = [];
                Object.entries(sectionCheck).forEach(([section, exists]) => {
                    if (!exists) {
                        issues.push(`Missing config section: ${section}`);
                    }
                });
                
                if (issues.length > 0) {
                    check.status = 'error';
                    check.issues.push(...issues);
                } else {
                    check.status = 'ok';
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // Timeline統合チェック
        checkTimelineIntegration() {
            const check = {
                name: 'Timeline Integration (Phase 1)',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const timelineUI = window.timelineUI;
                if (!timelineUI) {
                    check.status = 'error';
                    check.issues.push('TimelineUI instance not found');
                    return check;
                }
                
                // Timeline UI要素チェック
                const uiElements = [
                    'timeline-panel',
                    'cuts-container', 
                    'play-btn',
                    'add-cut-btn',
                    'export-gif-btn'
                ];
                
                const elementCheck = {};
                uiElements.forEach(id => {
                    elementCheck[id] = !!document.getElementById(id);
                });
                
                check.details.uiElements = elementCheck;
                
                // レイヤーパネル連動チェック（Phase 1新機能）
                const layerPanelIntegration = {
                    cutIndicator: !!document.querySelector('.cut-indicator'),
                    cutNavButtons: !!document.getElementById('cut-prev-btn') && 
                                  !!document.getElementById('cut-next-btn'),
                    cutDisplay: !!document.getElementById('cut-display')
                };
                
                check.details.layerPanelIntegration = layerPanelIntegration;
                
                // Timeline機能チェック
                if (typeof timelineUI.debugInfo === 'function') {
                    const debugInfo = timelineUI.debugInfo();
                    check.details.timelineState = debugInfo;
                }
                
                // 統合度評価
                const missingElements = Object.entries(elementCheck)
                    .filter(([id, exists]) => !exists)
                    .map(([id]) => id);
                
                if (missingElements.length > 0) {
                    check.status = 'warning';
                    check.issues.push(`Missing UI elements: ${missingElements.join(', ')}`);
                }
                
                if (!layerPanelIntegration.cutIndicator) {
                    check.issues.push('Layer panel CUT indicator missing');
                }
                
                if (check.issues.length === 0) {
                    check.status = 'ok';
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // 依存関係チェック
        checkDependencies() {
            const check = {
                name: 'Dependencies',
                status: 'unknown',
                issues: [],
                details: {}
            };
            
            try {
                const dependencies = [
                    { name: 'PIXI', obj: window.PIXI, required: true },
                    { name: 'Sortable', obj: window.Sortable, required: true },
                    { name: 'GIF', obj: window.GIF, required: true },
                    { name: 'TegakiEventBus', obj: window.TegakiEventBus, required: true },
                    { name: 'CoordinateSystem', obj: window.CoordinateSystem, required: true },
                    { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG, required: true },
                    { name: 'CoreRuntime', obj: window.CoreRuntime, required: false },
                    { name: 'TegakiCore', obj: window.TegakiCore, required: false }
                ];
                
                const dependencyStatus = {};
                const missingRequired = [];
                const missingOptional = [];
                
                dependencies.forEach(dep => {
                    const exists = !!dep.obj;
                    dependencyStatus[dep.name] = exists;
                    
                    if (!exists) {
                        if (dep.required) {
                            missingRequired.push(dep.name);
                        } else {
                            missingOptional.push(dep.name);
                        }
                    }
                });
                
                check.details.dependencyStatus = dependencyStatus;
                check.details.missingRequired = missingRequired;
                check.details.missingOptional = missingOptional;
                
                if (missingRequired.length > 0) {
                    check.status = 'error';
                    check.issues.push(`Missing required dependencies: ${missingRequired.join(', ')}`);
                } else if (missingOptional.length > 0) {
                    check.status = 'warning';
                    check.issues.push(`Missing optional dependencies: ${missingOptional.join(', ')}`);
                } else {
                    check.status = 'ok';
                }
                
                // バージョン混在チェック（PixiJS）
                if (window.PIXI && window.PIXI.VERSION) {
                    const version = window.PIXI.VERSION;
                    if (!version.startsWith('8.13')) {
                        check.issues.push(`PixiJS version mismatch: expected 8.13.x, got ${version}`);
                        if (check.status === 'ok') check.status = 'warning';
                    }
                }
                
            } catch (error) {
                check.status = 'error';
                check.issues.push(`Exception: ${error.message}`);
            }
            
            return check;
        }
        
        // 設定参照の検索（設定参照混在チェック用）
        findConfigReferences() {
            const references = {
                windowTEGAKI_CONFIG: 0,
                directConfigAccess: 0,
                inconsistentPaths: []
            };
            
            try {
                // この関数は簡略版 - 実際にはコード全体をスキャンする必要がある
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    if (script.src && script.src.includes('.js')) {
                        // 外部ファイルの内容は取得できないため、ここでは基本チェックのみ
                        references.directConfigAccess++;
                    }
                });
                
                // グローバル変数確認
                if (window.TEGAKI_CONFIG) {
                    references.windowTEGAKI_CONFIG++;
                }
                
            } catch (error) {
                references.error = error.message;
            }
            
            return references;
        }
        
        // 診断レポートの出力
        printDiagnosticReport() {
            console.log('\n🔍 ========== SYSTEM DIAGNOSTICS REPORT ==========');
            console.log(`Timestamp: ${this.results.timestamp}`);
            console.log(`Phase: ${this.results.phase}`);
            console.log('================================================\n');
            
            Object.entries(this.results.checks).forEach(([checkName, result]) => {
                const statusIcon = this.getStatusIcon(result.status);
                console.log(`${statusIcon} ${result.name}`);
                
                if (result.issues.length > 0) {
                    result.issues.forEach(issue => {
                        console.log(`   ⚠️  ${issue}`);
                    });
                }
                
                if (result.status === 'ok') {
                    console.log('   ✅ All checks passed');
                }
                
                console.log('');
            });
            
            // 総合評価
            const allStatuses = Object.values(this.results.checks).map(check => check.status);
            const errorCount = allStatuses.filter(s => s === 'error').length;
            const warningCount = allStatuses.filter(s => s === 'warning').length;
            const okCount = allStatuses.filter(s => s === 'ok').length;
            
            console.log('========== SUMMARY ==========');
            console.log(`✅ OK: ${okCount}`);
            console.log(`⚠️  Warnings: ${warningCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            
            if (errorCount === 0 && warningCount === 0) {
                console.log('\n🎉 ALL SYSTEMS GREEN - Phase 1 Ready!');
            } else if (errorCount === 0) {
                console.log('\n⚠️  System operational with warnings');
            } else {
                console.log('\n❌ System has critical errors - needs attention');
            }
            
            console.log('===============================\n');
        }
        
        // ステータスアイコンの取得
        getStatusIcon(status) {
            switch (status) {
                case 'ok': return '✅';
                case 'warning': return '⚠️';
                case 'error': return '❌';
                default: return '❓';
            }
        }
        
        // 特定チェックの実行
        runSpecificCheck(checkName) {
            const methodName = `check${checkName.charAt(0).toUpperCase() + checkName.slice(1)}`;
            if (typeof this[methodName] === 'function') {
                return this[methodName]();
            } else {
                return {
                    name: checkName,
                    status: 'error',
                    issues: ['Check method not found'],
                    details: {}
                };
            }
        }
        
        // 修復提案の生成
        generateRepairSuggestions() {
            const suggestions = [];
            
            Object.entries(this.results.checks).forEach(([checkName, result]) => {
                if (result.status === 'error' || result.status === 'warning') {
                    result.issues.forEach(issue => {
                        const suggestion = this.getSuggestionForIssue(checkName, issue);
                        if (suggestion) {
                            suggestions.push({
                                check: checkName,
                                issue: issue,
                                suggestion: suggestion,
                                priority: result.status === 'error' ? 'high' : 'medium'
                            });
                        }
                    });
                }
            });
            
            return suggestions;
        }
        
        // 問題に対する修復提案
        getSuggestionForIssue(checkName, issue) {
            const suggestionMap = {
                'PIXI not found': 'Ensure PixiJS v8.13.0 is loaded via CDN before other scripts',
                'TegakiEventBus not found': 'Load system/event-bus.js before other system files',
                'CoordinateSystem not found': 'Load coordinate-system.js in correct order',
                'LayerSystem instance not found': 'Ensure LayerSystem is initialized in core-engine.js',
                'Missing config section': 'Add missing configuration sections to config.js',
                'EventBus functional test failed': 'Check for EventBus initialization errors',
                'Version mismatch': 'Update script src to use PixiJS v8.13.0',
                'API fragmentation': 'Unify API usage across system components'
            };
            
            // 部分マッチング
            for (const [key, suggestion] of Object.entries(suggestionMap)) {
                if (issue.includes(key) || issue.toLowerCase().includes(key.toLowerCase())) {
                    return suggestion;
                }
            }
            
            return `Review ${checkName} implementation and dependencies`;
        }
        
        // JSON形式でのレポート出力
        exportReport() {
            return JSON.stringify(this.results, null, 2);
        }
        
        // HTML形式でのレポート生成
        generateHTMLReport() {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>System Diagnostics Report - ${this.results.phase}</title>
                <style>
                    body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                    .report { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { background: #800000; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                    .check { margin-bottom: 15px; padding: 15px; border-left: 4px solid #ccc; background: #fafafa; }
                    .check.ok { border-color: #4CAF50; }
                    .check.warning { border-color: #FF9800; }
                    .check.error { border-color: #f44336; }
                    .issues { margin-top: 10px; }
                    .issue { margin: 5px 0; padding: 5px 10px; background: rgba(255,0,0,0.1); border-radius: 3px; }
                    .summary { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-top: 20px; }
                    pre { background: #f0f0f0; padding: 10px; border-radius: 3px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <div class="report">
                    <div class="header">
                        <h1>System Diagnostics Report</h1>
                        <p>Phase: ${this.results.phase}</p>
                        <p>Timestamp: ${this.results.timestamp}</p>
                    </div>
                    ${this.generateCheckHTML()}
                    ${this.generateSummaryHTML()}
                </div>
            </body>
            </html>`;
            
            return html;
        }
        
        // チェック結果のHTML生成
        generateCheckHTML() {
            return Object.entries(this.results.checks).map(([checkName, result]) => {
                const issuesHTML = result.issues.length > 0 ? 
                    `<div class="issues">${result.issues.map(issue => 
                        `<div class="issue">⚠️ ${issue}</div>`
                    ).join('')}</div>` : '';
                
                return `
                    <div class="check ${result.status}">
                        <h3>${this.getStatusIcon(result.status)} ${result.name}</h3>
                        ${issuesHTML}
                        ${result.status === 'ok' ? '<p>✅ All checks passed</p>' : ''}
                    </div>
                `;
            }).join('');
        }
        
        // サマリーHTML生成
        generateSummaryHTML() {
            const allStatuses = Object.values(this.results.checks).map(check => check.status);
            const errorCount = allStatuses.filter(s => s === 'error').length;
            const warningCount = allStatuses.filter(s => s === 'warning').length;
            const okCount = allStatuses.filter(s => s === 'ok').length;
            
            return `
                <div class="summary">
                    <h3>Summary</h3>
                    <p>✅ OK: ${okCount}</p>
                    <p>⚠️ Warnings: ${warningCount}</p>
                    <p>❌ Errors: ${errorCount}</p>
                    ${errorCount === 0 && warningCount === 0 ? 
                        '<p><strong>🎉 ALL SYSTEMS GREEN - Phase 1 Ready!</strong></p>' : 
                        errorCount === 0 ? 
                        '<p><strong>⚠️ System operational with warnings</strong></p>' :
                        '<p><strong>❌ System has critical errors - needs attention</strong></p>'
                    }
                </div>
            `;
        }
    }
    
    // グローバルに公開
    window.SystemDiagnostics = SystemDiagnostics;
    
    // 自動診断実行（オプション）
    if (window.location.search.includes('autodiag=true')) {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                const diagnostics = new SystemDiagnostics();
                diagnostics.runFullDiagnostics();
            }, 2000);
        });
    }
    
    console.log('✅ system-diagnostics.js loaded');
    console.log('Usage: new SystemDiagnostics().runFullDiagnostics()');
    console.log('Auto-run: Add ?autodiag=true to URL');
    
})();