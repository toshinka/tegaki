/**
 * @file MainLayout.tsx
 * @description エディター画面全体のレイアウト（枠組み）を構成します。
 * ヘッダー、プレビュー領域、インスペクター領域、タイムライン領域を配置します。
 * @relatedFiles CanvasPreview.tsx, Timeline.tsx, InspectorPanel.tsx
 * @mainFunctions MainLayout()
 */

import React, { DragEvent, useState } from 'react';
import CanvasPreview from '../preview/CanvasPreview';
import Timeline from '../timeline/Timeline';
import InspectorPanel from '../inspector/InspectorPanel';
import { useTimelineStore } from '../../store/useTimelineStore';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const { addAssetAndClip } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          addAssetAndClip(file);
        }
      });
    }
  };

  return (
    <div 
      className={`layout-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <h2>Drop Images or Videos here</h2>
        </div>
      )}
      {/* ヘッダー領域 */}
      <header className="layout-header">
        <h1>Anime FX Editor</h1>
        {/* 将来的にエクスポートボタンなどをここに配置 */}
      </header>

      {/* メインワークスペース（プレビューとインスペクター） */}
      <div className="layout-workspace">
        <div className="layout-preview-area">
          <CanvasPreview />
        </div>
        <div className="layout-inspector-area">
          <InspectorPanel />
        </div>
      </div>

      {/* タイムライン領域 */}
      <div className="layout-timeline-area">
        <Timeline />
      </div>
    </div>
  );
};

export default MainLayout;
