/**
 * Palletvoid Image URL Utility
 * Normalizes and converts external image links, including Google Drive URLs,
 * into high-performance direct CDN embed URLs suitable for HTML <img> tags.
 */

/**
 * Extracts Google Drive file ID from a wide range of URL variations:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/u/0/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=view&id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/edit
 * - https://lh3.googleusercontent.com/d/FILE_ID
 * - https://drive.usercontent.google.com/download?id=FILE_ID
 * 
 * @param {string} url - Input image or Google Drive link
 * @returns {string|null} - Extracted Google Drive file ID or null
 */
export function extractGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  const str = url.trim();

  // Pattern 1: /file/d/ID or /file/u/X/d/ID
  const fileDMatch = str.match(/(?:drive|docs)\.google\.com\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Pattern 2: googleusercontent.com/d/ID
  const userContentMatch = str.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  if (userContentMatch && userContentMatch[1]) return userContentMatch[1];

  // Pattern 3: any drive.google.com, docs.google.com, or usercontent URL with id=ID in query params
  if (/google(?:\.com|usercontent\.com)/i.test(str)) {
    const idParamMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  }

  return null;
}

/**
 * Normalizes any image URL. If a Google Drive link is provided,
 * transforms it into the direct Google UserContent CDN URL.
 * 
 * @param {string} url - Image link
 * @returns {string} - Direct image URL
 */
export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return url || '';
  const trimmed = url.trim();
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }
  return trimmed;
}

/**
 * Generates an alternative Google Drive high-resolution thumbnail URL
 * used as a secondary fallback if the direct CDN URL is temporarily rate-limited.
 * 
 * @param {string} url - Image link
 * @param {number} size - Target maximum width (default: 1200)
 * @returns {string} - Direct thumbnail URL or original URL
 */
export function getGoogleDriveThumbnailUrl(url, size = 1200) {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${size}`;
  }
  return url || '';
}

/**
 * Helper to generate robust HTML onerror handler that tries Google Drive thumbnail fallback
 * before falling back to default site placeholder.
 * 
 * @param {string} defaultFallback - Default image to show on total failure (default: '/hero.jpg')
 * @returns {string} - onerror HTML attribute string
 */
export function getImgOnError(defaultFallback = '/hero.jpg') {
  return `this.onerror=null; if(this.src && this.src.indexOf('googleusercontent.com/d/') !== -1){ var m = this.src.match(/\\/d\\/([a-zA-Z0-9_-]+)/); if(m){ this.src = 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200'; return; } } this.src='${defaultFallback}';`;
}
