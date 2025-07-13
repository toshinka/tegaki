class ColorState {
    constructor() {
        // Tweakpaneが扱いやすいように #RRGGBB 形式で保持
        this.color = '#f0e0d6';
    }
}

export default ColorState;


// Tweakpaneでツールが変更されたら、ToolManagerにも通知する必要があるが、
// App.jsでToolManagerにToolStateを渡しているので、ToolManagerが能動的に
// 状態を参照する設計にすることで、このクラスはシンプルに保つ。
// 今回のアーキテクチャでは、UIの変更はTweakpaneが直接このクラスの`activeTool`を書き換える。
// `ToolManager`は`ToolState`を監視し、変更があれば自身の`activeTool`を切り替える。
// ...という設計が理想だが、複雑になるため今回は`App.js`でUIイベントとツール切り替えを仲介する形は維持する。
// Tweakpaneの`on('change')`を使えば実現できるが、まずはシンプルに。

export default ToolState;