/**
 * @file CanvasPreview.tsx
 * @description WebGPUのレンダリング結果を表示するキャンバスコンポーネント。
 * ここで動画や画像が実際に描画されます。
 * @relatedFiles src/engine/Renderer.ts (将来連携)
 * @mainFunctions CanvasPreview()
 */

import React, { useRef, useEffect } from 'react';
import { Renderer } from '../../engine/Renderer';

const CanvasPreview: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new Renderer();
      rendererRef.current.init(canvasRef.current).then(success => {
        if (success) {
          console.log('WebGPU Renderer initialized successfully.');
        } else {
          console.error('Failed to initialize WebGPU.');
        }
      });
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000', // キャンバス背景は黒
    }}>
      <canvas 
        ref={canvasRef} 
        width={1920} 
        height={1080} 
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          backgroundColor: '#111',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }} 
      />
    </div>
  );
};

export default CanvasPreview;
