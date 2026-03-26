import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedIndex: number | null;
  hoveredIndex: number | null;

  setSelectedIndex: (index: number | null) => void;
  setHoveredIndex: (index: number | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedIndex: null,
  hoveredIndex: null,

  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setHoveredIndex: (index) => set({ hoveredIndex: index }),
});
