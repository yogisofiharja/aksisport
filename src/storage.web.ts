export async function storageGet(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export async function storageSave(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  localStorage.removeItem(key);
}
