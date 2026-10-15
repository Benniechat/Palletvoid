/**
 * Google Reviews Service
 * Fetches reviews from Google Places API (New) and caches them server-side.
 * Falls back to cached data when API is unavailable or unconfigured.
 */
import { db } from '../database.js';

// Ensure cache table exists
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS google_reviews_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT NOT NULL,
      rating REAL,
      total_reviews INTEGER,
      reviews_json TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
} catch (e) { /* table may already exist */ }

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSetting(key) {
  try {
    const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(key);
    return row ? row.value : null;
  } catch { return null; }
}

/**
 * Fetch fresh reviews from the Google Places API (New)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 */
async function fetchFromGoogleAPI(placeId, apiKey) {
  // Use Places API (New) — GET place details with reviews field mask
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount,reviews&languageCode=en`;

  const resp = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews'
    }
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google Places API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();

  const reviews = (data.reviews || []).map(r => ({
    author: r.authorAttribution?.displayName || 'Google User',
    authorPhoto: r.authorAttribution?.photoUri || null,
    rating: r.rating || 5,
    text: r.text?.text || r.originalText?.text || '',
    time: r.publishTime || r.relativePublishTimeDescription || '',
    relativeTime: r.relativePublishTimeDescription || ''
  }));

  return {
    rating: data.rating || null,
    totalReviews: data.userRatingCount || reviews.length,
    reviews
  };
}

/**
 * Get reviews — from cache or fresh fetch
 */
export async function getGoogleReviews() {
  const apiKey = getSetting('google_places_api_key');
  const placeId = getSetting('google_place_id');

  // Check cache first
  const cached = db.prepare(`
    SELECT * FROM google_reviews_cache 
    ORDER BY fetched_at DESC LIMIT 1
  `).get();

  const cacheAge = cached ? (Date.now() - new Date(cached.fetched_at + 'Z').getTime()) : Infinity;

  // If cache is fresh enough, return it
  if (cached && cacheAge < CACHE_TTL_MS) {
    try {
      const parsed = JSON.parse(cached.reviews_json);
      return {
        rating: cached.rating,
        totalReviews: cached.total_reviews,
        reviews: parsed,
        source: 'cache',
        age: Math.round(cacheAge / 60000)
      };
    } catch { /* fall through to fetch */ }
  }

  // If no API key or place ID, return cache (stale) or empty
  if (!apiKey || !placeId) {
    if (cached) {
      try {
        const parsed = JSON.parse(cached.reviews_json);
        return {
          rating: cached.rating,
          totalReviews: cached.total_reviews,
          reviews: parsed,
          source: 'stale_cache',
          age: Math.round(cacheAge / 60000)
        };
      } catch { /* fall through */ }
    }
    return { rating: null, totalReviews: 0, reviews: [], source: 'unconfigured', age: null };
  }

  // Fetch fresh from Google
  try {
    const fresh = await fetchFromGoogleAPI(placeId, apiKey);

    // Save to cache
    db.prepare(`
      INSERT INTO google_reviews_cache (place_id, rating, total_reviews, reviews_json)
      VALUES (?, ?, ?, ?)
    `).run(placeId, fresh.rating, fresh.totalReviews, JSON.stringify(fresh.reviews));

    // Prune old cache entries (keep last 5)
    db.prepare(`
      DELETE FROM google_reviews_cache WHERE id NOT IN (
        SELECT id FROM google_reviews_cache ORDER BY fetched_at DESC LIMIT 5
      )
    `).run();

    return {
      rating: fresh.rating,
      totalReviews: fresh.totalReviews,
      reviews: fresh.reviews,
      source: 'live',
      age: 0
    };
  } catch (err) {
    console.error('[GoogleReviews] API fetch error:', err.message);

    // Fall back to stale cache
    if (cached) {
      try {
        const parsed = JSON.parse(cached.reviews_json);
        return {
          rating: cached.rating,
          totalReviews: cached.total_reviews,
          reviews: parsed,
          source: 'stale_cache_fallback',
          age: Math.round(cacheAge / 60000)
        };
      } catch { /* fall through */ }
    }

    return { rating: null, totalReviews: 0, reviews: [], source: 'error', age: null, error: err.message };
  }
}
