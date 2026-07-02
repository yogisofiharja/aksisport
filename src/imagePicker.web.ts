export async function pickImageAsDataUrl(source: 'gallery' | 'camera' = 'gallery'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    if (source === 'camera') input.setAttribute('capture', 'environment');

    const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    document.body.appendChild(input);
    input.click();
  });
}
