import type { ItemRef, LibraryState } from './model.js';
export interface ViewState { tab: 'skills' | 'prompts'; query: string; tag: string; favorites: boolean; items: ItemRef[]; collapsed: boolean; combinationId?: string }
export function observable<T>(initial: T) {
  let value = initial; const listeners = new Set<() => void>();
  return { getSnapshot: () => value, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, set: (next: T) => { value = next; for (const listener of listeners) listener(); } };
}
export function createClientState() {
  const library = observable<LibraryState | null>(null);
  const sessions = new Map<string, ReturnType<typeof observable<ViewState>>>();
  return { library, forSession(id: string) {
    let store = sessions.get(id);
    if (!store) { store = observable<ViewState>({ tab: 'skills', query: '', tag: '', favorites: false, items: [], collapsed: false }); sessions.set(id, store); }
    return store;
  }, forgetSession(id: string) { sessions.delete(id); } };
}
