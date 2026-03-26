import type { StateCreator } from 'zustand';

export interface PlaybackSlice {
  currentFrame: number;
  isPlaying: boolean;
  speed: number;

  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayback: () => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

export const createPlaybackSlice: StateCreator<PlaybackSlice, [], [], PlaybackSlice> = (set) => ({
  currentFrame: 0,
  isPlaying: false,
  speed: 30,

  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),
  stepForward: () => set((s) => ({ currentFrame: s.currentFrame + 1 })),
  stepBackward: () => set((s) => ({ currentFrame: Math.max(0, s.currentFrame - 1) })),
});
