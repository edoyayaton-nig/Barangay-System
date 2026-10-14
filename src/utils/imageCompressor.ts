/**
 * Image Compression and Resizing Utility
 * Automatically downscales and compresses high-resolution ID photos (from phone cameras / DSLRs)
 * to standard web dimensions (max 1200x1200) and web-optimized JPEG quality (~50KB-120KB).
 * This prevents network timeouts, localStorage overflows, and MySQL max_allowed_packet errors.
 */

export async function compressImage(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      // Fallback: resolve empty or rejection handled by caller
      resolve('');
    };
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Fallback: return raw src if Image loader fails
        resolve(src);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use image/jpeg for consistent size reduction
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          console.warn('[ImageCompressor] Canvas compression fallback:', err);
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
