import { atom } from 'recoil';

export interface AppState {
  namespace: string;
  placeholder: string[]; // FIXME
}

export const initlalAppState = atom<AppState>({
  key: 'AppState',
  default: {
    namespace: 'default',
    placeholder: [],
  },
});
