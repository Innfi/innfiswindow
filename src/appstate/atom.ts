import { atom, selector } from 'recoil';

export interface AppState {
  namespace: string;
  placeholder: string[]; // FIXME
}

export const initialAppState = atom<AppState>({
  key: 'AppState',
  default: {
    namespace: 'default',
    placeholder: [],
  },
});

export const toStateNamespace = selector({
  key: 'AppStateNamespace',
  get: ({ get }) => {
    const appState = get(initialAppState);

    return appState.namespace;
  },
});

export const initialHeaderState = atom<string>({
  key: 'HeaderState',
  default: '',
});
