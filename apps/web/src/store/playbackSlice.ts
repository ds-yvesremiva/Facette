import type { StateCreator } from 'zustand';
import type { OptimizationTrace } from 'facette';

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

type PlaybackState = PlaybackSlice & { trace: OptimizationTrace | null };

export const createPlaybackSlice: StateCreator<PlaybackState, [], [], PlaybackSlice> = (set, get) => ({
  currentFrame: 0,
  isPlaying: false,
  speed: 30,

  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),
  stepForward: () => set((s) => {
    const maxFrame = Math.max(0, (get().trace?.frames.length ?? 1) - 1);
    return { currentFrame: Math.min(maxFrame, s.currentFrame + 1) };
  }),
  stepBackward: () => set((s) => ({ currentFrame: Math.max(0, s.currentFrame - 1) })),
});
