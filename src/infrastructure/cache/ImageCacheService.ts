import { cacheManager } from './CacheManager.js';
import { renderCityImage, type CityRenderOptions } from '../discord/CityRenderer.js';
import { renderMapImage, type MapRenderOptions } from '../discord/MapRenderer.js';
import { createHash } from 'crypto';
import logger from '../../shared/utils/logger.js';

const CITY_IMAGE_TTL = 300; // 5 minutes
const MAP_IMAGE_TTL = 120; // 2 minutes (map changes more frequently)

function hashOptions(options: object): string {
  const str = JSON.stringify(options);
  return createHash('md5').update(str).digest('hex').slice(0, 12);
}

export class ImageCacheService {
  /**
   * Get cached city image or render a new one
   */
  async getCityImage(playerId: string, options: CityRenderOptions): Promise<Buffer> {
    const hash = hashOptions({
      hqLevel: options.hqLevel,
      buildings: options.buildings,
      troops: options.troops,
      isProtected: options.isProtected,
    });
    const cacheKey = `img:city:${playerId}:${hash}`;

    try {
      const cached = await cacheManager.get<string>(cacheKey);
      if (cached) {
        logger.debug(`City image cache hit for player ${playerId}`);
        return Buffer.from(cached, 'base64');
      }
    } catch (error) {
      logger.warn('Failed to get cached city image:', error);
    }

    // Render new image
    const buffer = renderCityImage(options);

    // Cache asynchronously (don't block response)
    cacheManager.set(cacheKey, buffer.toString('base64'), CITY_IMAGE_TTL).catch((err) => {
      logger.warn('Failed to cache city image:', err);
    });

    return buffer;
  }

  /**
   * Get cached map image or render a new one
   */
  async getMapImage(playerId: string, options: MapRenderOptions): Promise<Buffer> {
    // Include terrain data in hash so cache invalidates when terrain changes
    const terrainHash = options.tiles.map(t => `${t.x},${t.y}:${t.terrain}:${t.npc_id || ''}:${t.occupant_id || ''}`).join('|');
    const hash = hashOptions({
      centerX: options.centerX,
      centerY: options.centerY,
      viewSize: options.viewSize,
      terrainHash,
    });
    const cacheKey = `img:map:${playerId}:${hash}`;

    try {
      const cached = await cacheManager.get<string>(cacheKey);
      if (cached) {
        logger.debug(`Map image cache hit for player ${playerId}`);
        return Buffer.from(cached, 'base64');
      }
    } catch (error) {
      logger.warn('Failed to get cached map image:', error);
    }

    // Render new image
    const buffer = renderMapImage(options);

    // Cache asynchronously
    cacheManager.set(cacheKey, buffer.toString('base64'), MAP_IMAGE_TTL).catch((err) => {
      logger.warn('Failed to cache map image:', err);
    });

    return buffer;
  }

  /**
   * Invalidate city image cache for a player (call after building/troop changes)
   */
  async invalidateCityCache(playerId: string): Promise<void> {
    await cacheManager.deletePattern(`img:city:${playerId}:*`);
  }

  /**
   * Invalidate map cache for a region (call after tile changes)
   */
  async invalidateMapRegion(centerX: number, centerY: number, _radius: number = 10): Promise<void> {
    // For simplicity, we'll let map caches expire naturally
    // A more sophisticated approach would track which players have cached which regions
    logger.debug(`Map region around (${centerX}, ${centerY}) will refresh on next request`);
  }
}

export const imageCacheService = new ImageCacheService();
