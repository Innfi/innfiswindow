
const NAMESPACE_KEY = 'currentNamespace';

export const toCurrentNamespace = (): string => {
  const namespace = localStorage.getItem(NAMESPACE_KEY);

  if (!namespace) return 'default';

  return namespace;
};

export const setCurrentNamespace = (newNs: string): void => {
  localStorage.setItem(NAMESPACE_KEY, newNs);
};