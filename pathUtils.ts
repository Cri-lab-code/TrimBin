import path from 'path';

/**
 * Robust cross-platform path sanitizer and normalizer.
 * Handles Windows drive letters (C:, F:), leading slashes (/F:/ -> F:/),
 * URL encodings (%20), custom media protocols, and file:// URLs.
 */
export function normalizePathForSystem(inputPath?: string): string {
  if (!inputPath) return '';
  let clean = inputPath.trim();

  // If query parameter format was passed (e.g., media://local/?path=...)
  if (clean.includes('?path=')) {
    try {
      const idx = clean.indexOf('?path=');
      const qVal = clean.substring(idx + 6);
      clean = qVal.split('&')[0];
    } catch {}
  }

  // Remove protocol prefixes
  if (clean.startsWith('media:///')) {
    clean = clean.slice(9);
  } else if (clean.startsWith('media://local/')) {
    clean = clean.slice(14);
  } else if (clean.startsWith('media://')) {
    clean = clean.slice(8);
  } else if (clean.startsWith('file:///')) {
    clean = clean.slice(7);
  } else if (clean.startsWith('file://')) {
    clean = clean.slice(6);
  }

  // Safe URI decoding (handles %20 for spaces, etc.)
  try {
    clean = decodeURIComponent(clean);
  } catch {}

  // Fix Windows drive letter formatting:
  // e.g. "/F:/OBS nuovo/..." or "\F:\OBS nuovo\..." -> "F:/OBS nuovo/..."
  if (process.platform === 'win32') {
    clean = clean.replace(/^[/\\]+([a-zA-Z]:)/, '$1');
  } else {
    // On macOS/Linux, if a path starts with multiple slashes, retain single leading slash
    if (!clean.startsWith('/') && !clean.startsWith('~') && !clean.startsWith('.')) {
      clean = '/' + clean;
    }
  }

  // Normalize path separators for current platform
  clean = path.normalize(clean);

  // If Windows path somehow retained a leading backslash before drive letter (e.g. \F:\...)
  if (process.platform === 'win32' && /^\\+[a-zA-Z]:/.test(clean)) {
    clean = clean.replace(/^\\+/, '');
  }

  return clean;
}

