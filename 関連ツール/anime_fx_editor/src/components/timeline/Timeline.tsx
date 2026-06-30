/**
 * @file Timeline.tsx
 * @description 画面下部に配置されるタイムラインコンポーネント。
 * トラック、クリップ、再生ヘッドなどを管理・表示します。
 * @relatedFiles src/store/useTimelineStore.ts (状態管理)
 * @mainFunctions Timeline()
 */

import React, { useEffect } from 'react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { Play, Pause } from 'lucide-react';

const Timeline: React.FC = () => {
  const tracks = useTimelineStore((state) => state.tracks);
  const clips = useTimelineStore((state) => state.clips);
  const assets = useTimelineStore((state) => state.assets);
  const selectedClipId = useTimelineStore((state) => state.selectedClipId);
  const selectClip = useTimelineStore((state) => state.selectClip);
  
  const currentTime = useTimelineStore((state) => state.currentTime);
  const isPlaying = useTimelineStore((state) => state.isPlaying);
  const togglePlayback = useTimelineStore((state) => state.togglePlayback);
  const setCurrentTime = useTimelineStore((state) => state.setCurrentTime);
  const updateClipStartAt = useTimelineStore((state) => state.updateClipStartAt);

  // 1秒を何ピクセルで表示するか (スケール)
  const PIXELS_PER_SECOND = 20;

  // クリップのドラッグ移動処理
  const handleClipMouseDown = (e: React.MouseEvent, clip: any) => {
    e.stopPropagation();
    selectClip(clip.id);
    
    const startX = e.clientX;
    const initialStartAt = clip.startAt;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dt = dx / PIXELS_PER_SECOND;
      updateClipStartAt(clip.id, Math.max(0, initialStartAt + dt));
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 再生ループ
  useEffect(() => {
    let reqId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (useTimelineStore.getState().isPlaying) {
        const dt = (now - lastTime) / 1000;
        useTimelineStore.setState(s => ({ currentTime: s.currentTime + dt }));
      }
      lastTime = now;
      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, []);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 100; // 100px is the track header width
    if (x >= 0) {
      setCurrentTime(x / PIXELS_PER_SECOND);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      color: 'var(--text-muted)',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      <div style={{
        height: '40px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '16px'
      }}>
        <button 
          onClick={togglePlayback}
          style={{
            background: 'var(--accent-color)',
            border: 'none',
            color: 'white',
            borderRadius: '4px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div 
          style={{ flex: 1, height: '100%', position: 'relative', cursor: 'pointer' }}
          onClick={handleRulerClick}
        >
          {/* ルーラー背景 */}
          <div style={{ position: 'absolute', bottom: 0, width: '100%', borderBottom: '1px solid #555' }} />
          
          {/* 再生ヘッド（赤い線） */}
          <div style={{
            position: 'absolute',
            left: `${currentTime * PIXELS_PER_SECOND}px`,
            top: 0,
            bottom: -500, // 下のトラックまで伸ばす簡易表現
            width: '2px',
            backgroundColor: '#ff4444',
            zIndex: 10,
            pointerEvents: 'none'
          }} />
          
          <span style={{ position: 'absolute', left: `${currentTime * PIXELS_PER_SECOND + 4}px`, top: '8px', fontSize: '10px', color: '#ff4444' }}>
            {currentTime.toFixed(2)}s
          </span>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        {tracks.map(track => (
          <div key={track.id} style={{
            backgroundColor: 'var(--track-bg)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '4px',
            height: '40px',
            position: 'relative'
          }}>
            {/* トラックヘッダー */}
            <div style={{ width: '100px', padding: '0 8px', fontSize: '12px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}>
              {track.name}
            </div>
            
            {/* クリップ配置エリア */}
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
              {clips.filter(c => c.trackId === track.id).map(clip => {
                const asset = assets[clip.assetId];
                const isSelected = clip.id === selectedClipId;
                
                return (
                  <div 
                    key={clip.id}
                    onMouseDown={(e) => handleClipMouseDown(e, clip)}
                    style={{
                      position: 'absolute',
                      left: `${clip.startAt * PIXELS_PER_SECOND}px`,
                      width: `${clip.duration * PIXELS_PER_SECOND}px`,
                      height: '80%',
                      top: '10%',
                      backgroundColor: isSelected ? 'var(--clip-selected)' : 'var(--clip-bg)',
                      border: isSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 4px',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {asset ? asset.name : 'Unknown'}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
