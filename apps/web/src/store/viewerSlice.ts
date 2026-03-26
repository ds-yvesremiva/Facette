import type { StateCreator } from 'zustand';

export interface ViewerSlice {
  showSeeds: boolean;
  showGenerated: boolean;
  showHull: boolean;
  showGamut: boolean;
  showAxes: boolean;
  morphT: number;

  toggleSeeds: () => void;
  toggleGenerated: () => void;
  toggleHull: () => void;
  toggleGamut: () => void;
  toggleAxes: () => void;
  setMorphT: (t: number) => void;
}

export const createViewerSlice: StateCreator<ViewerSlice, [], [], ViewerSlice> = (set) => ({
  showSeeds: true,
  showGenerated: true,
  showHull: true,
  showGamut: false,
  showAxes: true,
  morphT: 0,

  toggleSeeds: () => set((s) => ({ showSeeds: !s.showSeeds })),
  toggleGenerated: () => set((s) => ({ showGenerated: !s.showGenerated })),
  toggleHull: () => set((s) => ({ showHull: !s.showHull })),
  toggleGamut: () => set((s) => ({ showGamut: !s.showGamut })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  setMorphT: (t) => set({ morphT: t }),
});
