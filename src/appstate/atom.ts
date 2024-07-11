import { atom } from 'recoil';
import { recoilPersist } from 'recoil-persist';

const { persistAtom } = recoilPersist({
  key: 'recoil-persist',
  storage: sessionStorage,
});

export const initialNamespace = atom<string>({
  key: 'currentNamespace',
  default: 'default',
  effects_UNSTABLE: [persistAtom],
});

export const initialHeaderState = atom<string>({
  key: 'HeaderState',
  default: '',
});

export const initialErrorMessage = atom<string>({
  key: 'ErrorMessage',
  default: '',
});
