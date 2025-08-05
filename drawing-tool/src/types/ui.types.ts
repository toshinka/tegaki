// ふたば色システム・参考資料完全継承
export interface ColorValues {
  futabaMaroon: number;        // 0x800000 - 基調色
  futabaLightMaroon: number;   // 0xaa5a56 - セカンダリ
  futabaMedium: number;        // 0xcf9c97 - アクセント
  futabaLight: number;         // 0xe9c2ba - 境界線
  futabaCream: number;         // 0xf0e0d6 - パネル背景
  futabaBackground: number;    // 0xffffee - キャンバス
}

export interface UIState {
  currentTool: string;
  currentColor: number;
  toolbarVisible: boolean;
  colorPaletteVisible: boolean;
}

export interface ToolSettings {
  size: number;
  opacity: number;
  color: number;
  smoothing: boolean;
  pressureSensitive: boolean;
}