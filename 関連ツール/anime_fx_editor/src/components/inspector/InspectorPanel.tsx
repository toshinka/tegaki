/**
 * @file InspectorPanel.tsx
 * @description 選択されたクリップやエフェクトのプロパティを調整するパネル。
 * 画面右側に配置されます。
 * @relatedFiles src/store/useTimelineStore.ts (選択状態の取得)
 * @mainFunctions InspectorPanel()
 */

import React from 'react';

const InspectorPanel: React.FC = () => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <h2 style={{ fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        Inspector
      </h2>
      
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        No clip selected.
      </div>
      
      {/* プレースホルダーのコントロール群 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px' }}>
          Opacity
          <input type="range" min="0" max="100" defaultValue="100" style={{ width: '100%', marginTop: '4px' }} />
        </label>
        <label style={{ fontSize: '12px' }}>
          Scale
          <input type="range" min="0" max="200" defaultValue="100" style={{ width: '100%', marginTop: '4px' }} />
        </label>
      </div>
    </div>
  );
};

export default InspectorPanel;
