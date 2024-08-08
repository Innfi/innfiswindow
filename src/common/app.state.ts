import { atom, DefaultValue, selector } from 'recoil';
import { recoilPersist } from 'recoil-persist';

const { persistAtom } = recoilPersist({
  key: 'recoil-persist',
  storage: sessionStorage,
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
  effects_UNSTABLE: [persistAtom],
});

export const namespaceSelector = selector({
  key: 'namespaceSelector',
  get: ({ get }): string => {
    const data = get(commonAtom);

    return data.currentNamespace;
  },
  set: ({ set, get }, newNamespace) => {
    const data = get(commonAtom);

    return set(commonAtom, {
      ...data,
      currentNamespace: newNamespace instanceof DefaultValue ? data.currentNamespace : newNamespace,
    });
  },
});

export const headerSelector = selector({
  key: 'headerSelector',
  get: ({ get }): string => {
    const data = get(commonAtom);

    return data.headerString;
  },
  set: ({ set, get }, newHeader) => {
    const data = get(commonAtom);

    return set(commonAtom, {
      ...data,
      headerString: newHeader instanceof DefaultValue ? data.headerString : newHeader,
    });
  },
});

export const errMsgSelector = selector({
  key: 'errMsgSelector',
  get: ({ get }): string => {
    const data = get(commonAtom);

    return data.errorMessage;
  },
  set: ({ set, get }, newErrMsg) => {
    const data = get(commonAtom);

    return set(commonAtom, {
      ...data,
      errorMessage: newErrMsg instanceof DefaultValue ? data.errorMessage : newErrMsg,
    });
  },
});
