/**
 * Robust cross-platform path sanitizer for frontend renderer.
 * Handles Windows drive letters (C:, F:), leading slashes (/F:/ -> F:/),
 * URL encodings (%20), custom media protocols, and file:// URLs.
 */
export function sanitizeFilePath(inputPath?: string): string {
  if (!inputPath) return '';
  let clean = inputPath.trim();

  if (clean.includes('?path=')) {
    try {
      const idx = clean.indexOf('?path=');
      clean = clean.substring(idx + 6).split('&')[0];
    } catch (e) {
      console.debug('[pathSanitizer] Failed extracting query path:', e);
    }
  }

  clean = clean.replace(/^(?:file|media):\/\/(?:local\/)?/, '');

  try {
    clean = decodeURIComponent(clean);
  } catch (e) {
    console.debug('[pathSanitizer] Failed decodeURIComponent:', e);
  }

  // Windows drive letter formatting (e.g. /C:/ -> C:/ or \C:\ -> C:\)
  clean = clean.replace(/^[/\\]+([a-zA-Z]:)/, '$1');

  return clean;
}
