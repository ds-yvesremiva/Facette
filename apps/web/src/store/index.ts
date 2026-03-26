import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createPaletteSlice, type PaletteSlice } from './paletteSlice';
import { createViewerSlice, type ViewerSlice } from './viewerSlice';
import { createPlaybackSlice, type PlaybackSlice } from './playbackSlice';
import { createSelectionSlice, type SelectionSlice } from './selectionSlice';

export type AppStore = PaletteSlice & ViewerSlice & PlaybackSlice & SelectionSlice;

type SliceCreator<T> = StateCreator<AppStore, [], [], T>;

export const useStore = create<AppStore>()((set, get, store) => ({
  ...(createPaletteSlice as SliceCreator<PaletteSlice>)(set, get, store),
  ...(createViewerSlice as SliceCreator<ViewerSlice>)(set, get, store),
  ...(createPlaybackSlice as SliceCreator<PlaybackSlice>)(set, get, store),
  ...(createSelectionSlice as SliceCreator<SelectionSlice>)(set, get, store),
}));
