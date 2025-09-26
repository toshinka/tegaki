/* core-engine.js
   CoreEngine: シンプルで堅牢なシステム登録・初期化フレームワーク
   API:
     CoreEngine.registerSystem(name, systemFactoryOrObject)
     CoreEngine.initialize(options) -> returns Promise
   System 要件:
     - object.name (string)
     - object.required (array of system-names) optional
     - object.init(engine) -> sync/async
     - object.start(engine) -> sync/async optional
*/
(function(window){
  'use strict';

  // PIXI バージョンチェック（任意だが有用）
  if (!window.PIXI) {
    console.error('CoreEngine: PIXI not found. Make sure PixiJS is loaded before core-engine.js');
  } else {
    try {
      const v = (PIXI.VERSION || '');
      if (!v.startsWith('8.13')) {
        console.warn(`CoreEngine: Expected PixiJS v8.13, found ${v}. Behavior may differ.`);
      }
    } catch(e){}
  }

  // シングルトン CoreEngine
  const CoreEngine = {
    _systems: {},           // name -> system instance/object
    _systemFactories: {},   // name -> factory/object (registered before init)
    _loaded: false,
    _engineContext: null,
    _requiredSystemsList: [],

    registerSystem: function(name, factoryOrObject){
      if (!name) throw new Error('registerSystem requires name');
      this._systemFactories[name] = factoryOrObject;
      // For debug minimal log — keep it small per rule
      // console.debug(`CoreEngine: system registered: ${name}`);
    },

    // internal: ingest any pending window.__PENDING_SYSTEMS placed by system files
    _ingestPendingSystems: function(){
      if (window.__PENDING_SYSTEMS){
        for (const k in window.__PENDING_SYSTEMS){
          if (!this._systemFactories[k]) this._systemFactories[k] = window.__PENDING_SYSTEMS[k];
        }
        // clear to avoid duplicate
        window.__PENDING_SYSTEMS = null;
      }
    },

    initialize: async function(options = {}){
      // minimal options:
      //   requiredSystems: ['camera','layer', ...]
      //   pixiApp: existing PIXI.Application instance (optional)
      //   timeoutMs: how long to wait for required systems registration
      this._ingestPendingSystems();
      const timeoutMs = options.timeoutMs || 3000;
      this._requiredSystemsList = options.requiredSystems || [];

      // create engine context
      const app = options.pixiApp || this._createPixiAppIfNeeded();
      const ctx = {
        app: app,
        stage: app.stage,
        renderer: app.renderer,
        // worldContainer will be created and attached to stage
        worldContainer: null,
        systems: this._systems,
        registerSystem: this.registerSystem.bind(this),
      };
      this._engineContext = ctx;

      // create canonical world container and attach to stage
      ctx.worldContainer = new PIXI.Container();
      ctx.worldContainer.name = 'worldContainer';
      ctx.stage.addChild(ctx.worldContainer);
      this.worldContainer = ctx.worldContainer; // expose on CoreEngine

      // wait for required systems to be registered
      const self = this;
      await this._waitForSystemsRegistered(timeoutMs);

      // instantiate systems
      for (const name in this._systemFactories){
        // if already instantiated skip
        if (this._systems[name]) continue;
        try {
          const factory = this._systemFactories[name];
          let instance = (typeof factory === 'function') ? factory() : factory;
          // allow factory to return an object or require a call to .create()
          if (typeof instance === 'function') instance = instance();
          // final guard: ensure has name
          instance = instance || {};
          if (!instance.name) instance.name = name;
          this._systems[name] = instance;
        } catch (e){
          console.error('CoreEngine: failed to instantiate system', name, e);
        }
      }

      // call init on systems (in any order) but await if returns promise
      const initPromises = [];
      for (const name in this._systems){
        const s = this._systems[name];
        if (typeof s.init === 'function'){
          try {
            const p = s.init(this._engineContext);
            if (p && typeof p.then === 'function') initPromises.push(p);
          } catch(e){
            console.error('CoreEngine: system init error', name, e);
          }
        }
      }
      await Promise.all(initPromises);

      // start systems (non-blocking, but await if promise returned)
      for (const name in this._systems){
        const s = this._systems[name];
        if (typeof s.start === 'function'){
          try {
            const p = s.start(this._engineContext);
            if (p && typeof p.then === 'function') await p;
          } catch(e){
            console.error('CoreEngine: system start error', name, e);
          }
        }
      }

      this._loaded = true;
      return this._engineContext;
    },

    _waitForSystemsRegistered: function(timeoutMs){
      const required = this._requiredSystemsList || [];
      if (!required.length) return Promise.resolve();

      const self = this;
      return new Promise(function(resolve, reject){
        const start = Date.now();
        (function tick(){
          let allHere = true;
          for (let i = 0; i < required.length; ++i){
            const name = required[i];
            // registered either in factories or already instantiated
            if (!self._systemFactories[name] && !self._systems[name]){
              allHere = false; break;
            }
          }
          if (allHere) return resolve();
          if (Date.now() - start > timeoutMs){
            console.error('❌ System loading timeout. Available systems: ', Object.keys(self._systemFactories));
            return reject(new Error('Required systems not loaded within timeout'));
          }
          setTimeout(tick, 50);
        })();
      });
    },

    getSystem: function(name){
      return this._systems[name] || null;
    },

    _createPixiAppIfNeeded: function(){
      if (window._CORE_ENGINE_APP) return window._CORE_ENGINE_APP;
      // create a minimal PIXI.Application suitable for file:// usage
      const app = new PIXI.Application({
        width: 800, height: 600, backgroundAlpha: 0, antialias: true
      });
      // attach to body if nothing provided
      document.body.appendChild(app.view);
      window._CORE_ENGINE_APP = app;
      return app;
    }
  };

  // expose CoreEngine
  window.CoreEngine = CoreEngine;

  // If systems were placed into window.__PENDING_SYSTEMS by system files, ingest now
  CoreEngine._ingestPendingSystems();

})(window);