/**
 * @file useTimelineStore.ts
 * @description タイムライン、トラック、クリップ（素材）、再生状態などのグローバル状態をZustandで一元管理します。
 * @relatedFiles src/components/timeline/Timeline.tsx, src/components/layout/MainLayout.tsx
 * @mainFunctions useTimelineStore()
 */

import { create } from 'zustand';

// --- 型定義 ---
export interface MediaAsset {
  id: string;
  file: File;
  type: 'image' | 'video';
  url: string; // URL.createObjectURL() で生成したプレビュー用URL
  name: string;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startAt: number;   // タイムライン上の開始時間 (秒)
  duration: number;  // 尺 (秒)
  // TODO: 将来ここにプロパティ（位置・スケール・透明度）を追加
}

export interface Track {
  id: string;
  name: string;
}

interface TimelineState {
  assets: Record<string, MediaAsset>;
  tracks: Track[];
  clips: Clip[];
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;

  // アクション
  addAssetAndClip: (file: File) => Promise<void>;
  setCurrentTime: (time: number) => void;
  togglePlayback: () => void;
  selectClip: (id: string | null) => void;
  updateClipStartAt: (id: string, startAt: number) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  assets: {},
  tracks: [{ id: 'track-1', name: 'Track 1' }], // 最初から1つトラックを用意
  clips: [],
  currentTime: 0,
  isPlaying: false,
  selectedClipId: null,

  /**
   * D&Dされたファイルをアセットとして登録し、同時にタイムラインのクリップとして配置する
   */
  addAssetAndClip: async (file: File) => {
    const assetId = crypto.randomUUID();
    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    
    let duration = 5; // デフォルト（画像用）

    if (isVideo) {
      // 動画の長さを取得する
      duration = await new Promise<number>((resolve) => {
        const v = document.createElement('video');
        v.src = url;
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => resolve(5);
      });
    }

    const newAsset: MediaAsset = {
      id: assetId,
      file,
      type: isVideo ? 'video' : 'image',
      url,
      name: file.name
    };

    const state = get();
    // トラックの最後尾に配置するための計算
    const trackId = state.tracks[0].id;
    const currentTrackClips = state.clips.filter(c => c.trackId === trackId);
    let startAt = 0;
    if (currentTrackClips.length > 0) {
      const lastClip = currentTrackClips.reduce((prev, current) => (prev.startAt > current.startAt) ? prev : current);
      startAt = lastClip.startAt + lastClip.duration;
    }

    const newClip: Clip = {
      id: crypto.randomUUID(),
      assetId,
      trackId,
      startAt,
      duration,
    };

    set((prev) => ({
      assets: { ...prev.assets, [assetId]: newAsset },
      clips: [...prev.clips, newClip]
    }));
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  togglePlayback: () => set((prev) => ({ isPlaying: !prev.isPlaying })),
  selectClip: (id) => set({ selectedClipId: id }),
  updateClipStartAt: (id, startAt) => set((prev) => ({
    clips: prev.clips.map(c => c.id === id ? { ...c, startAt: Math.max(0, startAt) } : c)
  }))
}));
