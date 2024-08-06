import { atom, DefaultValue, selector } from 'recoil';
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


export interface CommonAtomDefinition {
  currentNamespace: string;
  headerString: string;
  errorMessage: string;
}

export const commonAtom = atom<CommonAtomDefinition>({
  key: 'commonAtom',
  default: {
    currentNamespace: 'default',
    headerString: '',
    errorMessage: '',
  },
});

export const namespaceSelector = selector({
  key: 'namespaceSelector',
  get: ({ get }): string => {
    const data = get(commonAtom);

    return data.currentNamespace;
  },
  set: ({ set, get }, newNamespace) => {
    const data = get(commonAtom);

    data.currentNamespace = newNamespace instanceof DefaultValue ? 
      data.currentNamespace : newNamespace;

    return set(commonAtom, data);
  },
});
