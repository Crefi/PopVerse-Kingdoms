import { useEffect, useState, useCallback, useRef } from 'react';
import { getMapRegion, getAllCities, getAllLands, getAllNpcs, searchPlayer } from '../services/api';
import { getSocket, subscribeToMarches, subscribeToMap } from '../services/socket';
import type { MapTile, Player, LandParcel, March } from '../types';
import { useAuthStore } from '../store/authStore';

// --- CONFIGURATION ---
const COORD_SIZE = 24;
const DEFAULT_ZOOM = 0.8;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.0;
const ZOOM_ANIMATION_MS = 180;
/** Multiplicative step: each zoom in = * ZOOM_STEP_MULT, zoom out = / ZOOM_STEP_MULT */
const ZOOM_STEP_MULT = 1.25;
/** Wheel zoom factor per scroll (~5% per scroll) */
const ZOOM_WHEEL_FACTOR = 1.50;
const BASE_TILE_SIZE = 48;
const MAP_SIZE = 100;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Palette
const PALETTE = {
  bg: '#1a1a24',
  gridLines: 'rgba(0, 0, 0, 0.15)',
  coordBg: '#252532',
  coordText: '#888',
};

const TERRAIN_COLORS: Record<string, [string, string]> = {
  plains:   ['#7bc043', '#71b33c'],
  forest:   ['#63a335', '#59942e'],
  mountain: ['#95a5a6', '#8e9e9f'],
  lake:     ['#4fb9e3', '#45a6ce'],
  resource: ['#f1c40f', '#eebb0d'],
  void:     ['#2c3e50', '#2c3e50'],
};

const FACTION_COLORS: Record<string, string> = {
  cinema: '#e74c3c',
  anime:  '#2ecc71',
  gamer: '#3498db',
};

const LAND_BORDER_COLORS: Record<string, string> = {
  farm: '#27ae60',
  mine: '#7f8c8d',
  goldmine: '#f1c40f',
  fort: '#9b59b6',
};

interface NpcData {
  id: string;
  type: string;
  power: number;
  x: number;
  y: number;
}

interface MapState {
  tiles: MapTile[];
  cities: Player[];
  lands: LandParcel[];
  npcs: NpcData[];
  marches: March[];
}

// ================= DRAWING FUNCTIONS =================

function drawCleanTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const ts = s * 0.6;
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - ts * 0.15, y + ts * 0.2, ts * 0.3, ts * 0.4);
  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath();
  ctx.arc(x, y - ts * 0.1, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCleanMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const ms = s * 0.65;
  ctx.fillStyle = '#7f8c8d';
  ctx.beginPath();
  ctx.moveTo(x, y - ms * 0.5);
  ctx.lineTo(x + ms * 0.5, y + ms * 0.4);
  ctx.lineTo(x - ms * 0.5, y + ms * 0.4);
  ctx.fill();
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath();
  ctx.moveTo(x, y - ms * 0.5);
  ctx.lineTo(x + ms * 0.15, y - ms * 0.2);
  ctx.lineTo(x - ms * 0.15, y - ms * 0.2);
  ctx.fill();
}

function drawWaveLines(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const scale = s / 48;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.moveTo(x - 10 * scale, y - 5 * scale); ctx.lineTo(x + 10 * scale, y - 5 * scale); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 15 * scale, y + 5 * scale); ctx.lineTo(x + 5 * scale, y + 5 * scale); ctx.stroke();
}

function drawGoldMine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const iconSize = s * 0.7;
  ctx.fillStyle = '#8B7355';
  ctx.beginPath();
  ctx.ellipse(x, y + iconSize*0.3, iconSize*0.45, iconSize*0.2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(x, y + iconSize*0.1, iconSize*0.28, Math.PI, 0, false);
  ctx.lineTo(x + iconSize*0.28, y + iconSize*0.25);
  ctx.lineTo(x - iconSize*0.28, y + iconSize*0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x - iconSize*0.32, y - iconSize*0.25, iconSize*0.08, iconSize*0.5);
  ctx.fillRect(x + iconSize*0.24, y - iconSize*0.25, iconSize*0.08, iconSize*0.5);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x - iconSize*0.35, y - iconSize*0.3, iconSize*0.7, iconSize*0.1);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + iconSize*0.2, y - iconSize*0.15, iconSize*0.08, 0, Math.PI*2);
  ctx.fill();
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const iconSize = s * 0.7;
  ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + iconSize*0.35, iconSize*0.45, iconSize*0.2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#2c2c3a';
  ctx.beginPath();
  ctx.moveTo(x - iconSize*0.3, y + iconSize*0.3);
  ctx.lineTo(x - iconSize*0.35, y - iconSize*0.1);
  ctx.lineTo(x - iconSize*0.2, y - iconSize*0.5);
  ctx.lineTo(x - iconSize*0.05, y - iconSize*0.2);
  ctx.lineTo(x + iconSize*0.2, y - iconSize*0.5);
  ctx.lineTo(x + iconSize*0.35, y - iconSize*0.1);
  ctx.lineTo(x + iconSize*0.3, y + iconSize*0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1a22';
  ctx.lineWidth = Math.max(1, s / 24);
  ctx.stroke();
  ctx.fillStyle = '#ff3838';
  ctx.beginPath();
  ctx.moveTo(x - iconSize*0.2, y - iconSize*0.15);
  ctx.lineTo(x - iconSize*0.05, y - iconSize*0.05);
  ctx.lineTo(x - iconSize*0.2, y - iconSize*0.02);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + iconSize*0.2, y - iconSize*0.15);
  ctx.lineTo(x + iconSize*0.05, y - iconSize*0.05);
  ctx.lineTo(x + iconSize*0.2, y - iconSize*0.02);
  ctx.fill();
}

function drawPlayerHQ(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, isCurrentPlayer: boolean) {
  const iconSize = s * 0.75;
  ctx.fillStyle = '#95a5a6';
  ctx.beginPath();
  ctx.ellipse(x, y + iconSize*0.35, iconSize*0.45, iconSize*0.15, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = Math.max(1, s / 24);
  ctx.stroke();
  ctx.fillStyle = isCurrentPlayer ? '#e67e22' : '#8e7e62';
  const keepW = iconSize * 0.5;
  const keepH = iconSize * 0.5;
  ctx.fillRect(x - keepW/2, y - keepH/2, keepW, keepH);
  ctx.fillStyle = isCurrentPlayer ? '#d35400' : '#6e5e42';
  ctx.fillRect(x - keepW/2, y - keepH/2 - 5, keepW, 5);
  ctx.fillStyle = '#6e4d43';
  ctx.fillRect(x - keepW/6, y + keepH/4, keepW/3, keepH/4);
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = Math.max(2, s / 16);
  ctx.beginPath();
  ctx.moveTo(x, y - keepH/2 - 5);
  ctx.lineTo(x, y - iconSize*0.7);
  ctx.stroke();
  ctx.fillStyle = isCurrentPlayer ? '#c0392b' : '#7f8c8d';
  ctx.beginPath();
  ctx.moveTo(x, y - iconSize*0.7);
  ctx.lineTo(x + iconSize*0.4, y - iconSize*0.55);
  ctx.lineTo(x, y - iconSize*0.4);
  ctx.fill();
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = Math.max(1, s / 24);
  ctx.strokeRect(x - keepW/2, y - keepH/2, keepW, keepH);
}

function drawFactionUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, faction: string) {
  const color = FACTION_COLORS[faction] || '#888';
  const iconSize = s * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + iconSize*0.35, iconSize*0.4, iconSize*0.15, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - iconSize*0.1, iconSize*0.35, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y - iconSize*0.15, iconSize*0.12, 0, Math.PI*2);
  ctx.fill();
}

function drawLandParcelBorder(
  ctx: CanvasRenderingContext2D,
  land: LandParcel,
  minX: number,
  minY: number,
  tileSize: number,
  viewTilesX: number,
  viewTilesY: number
): void {
  const maxX = minX + viewTilesX - 1;
  const maxY = minY + viewTilesY - 1;
  if (land.bounds.maxX < minX || land.bounds.minX > maxX || land.bounds.maxY < minY || land.bounds.minY > maxY) return;
  const visMinX = Math.max(land.bounds.minX, minX);
  const visMaxX = Math.min(land.bounds.maxX, maxX);
  const visMinY = Math.max(land.bounds.minY, minY);
  const visMaxY = Math.min(land.bounds.maxY, maxY);
  const px1 = (visMinX - minX) * tileSize;
  const py1 = (visMinY - minY) * tileSize;
  const px2 = (visMaxX - minX + 1) * tileSize;
  const py2 = (visMaxY - minY + 1) * tileSize;
  const borderColor = LAND_BORDER_COLORS[land.type] || '#ffffff';
  ctx.fillStyle = land.owner ? `${borderColor}20` : `${borderColor}10`;
  ctx.fillRect(px1, py1, px2 - px1, py2 - py1);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = land.owner ? 3 : 2;
  ctx.setLineDash(land.owner ? [] : [5, 5]);
  ctx.strokeRect(px1 + 1, py1 + 1, px2 - px1 - 2, py2 - py1 - 2);
  ctx.setLineDash([]);
}

/** Min pixels between coordinate labels to avoid overlap when zoomed out */
const COORD_LABEL_MIN_SPACING = 26;

/** Draw arrow on map edge pointing toward player when they're off-screen */
function drawYouOffScreenIndicator(
  ctx: CanvasRenderingContext2D,
  myX: number,
  myY: number,
  minX: number,
  minY: number,
  tilesX: number,
  tilesY: number,
  tileSize: number
) {
  const mapW = tilesX * tileSize;
  const mapH = tilesY * tileSize;
  const cx = mapW / 2;
  const cy = mapH / 2;
  const px = (myX - minX) * tileSize + tileSize / 2;
  const py = (myY - minY) * tileSize + tileSize / 2;
  let dx = px - cx;
  let dy = py - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  dx /= len;
  dy /= len;
  let t = Infinity;
  if (dx > 0.001) t = Math.min(t, (mapW - cx) / dx);
  if (dx < -0.001) t = Math.min(t, -cx / dx);
  if (dy > 0.001) t = Math.min(t, (mapH - cy) / dy);
  if (dy < -0.001) t = Math.min(t, -cy / dy);
  if (t === Infinity || t <= 0) return;
  const ex = cx + dx * t;
  const ey = cy + dy * t;
  const r = 10;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const tipX = ex + dx * (r + 5);
  const tipY = ey + dy * (r + 5);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - dx * 12 - dy * 5, tipY - dy * 12 + dx * 5);
  ctx.lineTo(tipX - dx * 12 + dy * 5, tipY - dy * 12 - dx * 5);
  ctx.closePath();
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('You', ex - dx * 16, ey - dy * 16);
}

function drawCoordinates(
  ctx: CanvasRenderingContext2D, 
  minX: number, 
  minY: number, 
  viewTilesX: number, 
  viewTilesY: number,
  tileSize: number,
  w: number, 
  h: number
) {
  ctx.fillStyle = PALETTE.coordBg;
  ctx.fillRect(COORD_SIZE, 0, w - COORD_SIZE, COORD_SIZE);
  ctx.fillRect(0, COORD_SIZE, COORD_SIZE, h - COORD_SIZE);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(0, 0, COORD_SIZE, COORD_SIZE);
  ctx.fillStyle = PALETTE.coordText;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = Math.max(1, Math.floor(COORD_LABEL_MIN_SPACING / tileSize));
  for (let i = 0; i < viewTilesX; i += step) {
    const centerOffset = COORD_SIZE + (i * tileSize) + (tileSize / 2);
    if (centerOffset < w) ctx.fillText(`${minX + i}`, centerOffset, COORD_SIZE / 2);
  }
  for (let i = 0; i < viewTilesY; i += step) {
    const yCenter = COORD_SIZE + (i * tileSize) + (tileSize / 2);
    if (yCenter < h) ctx.fillText(`${minY + i}`, COORD_SIZE / 2, yCenter);
  }
}

// ================= MAIN COMPONENT =================

export default function MapPage() {
  const { user } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetZoomRef = useRef<number | null>(null);
  const targetViewCenterRef = useRef<{ x: number; y: number } | null>(null);
  const animationStartRef = useRef<{ zoom: number; viewCenter: { x: number; y: number } } | null>(null);
  const animationStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  
  const [mapState, setMapState] = useState<MapState>({
    tiles: [],
    cities: [],
    lands: [],
    npcs: [],
    marches: [],
  });
  
  const [viewCenter, setViewCenter] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Non-passive wheel listener so we can preventDefault and capture zoom (stops page scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Touch pan: same logic as mouse drag, preventDefault so page doesn't scroll
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
        setIsDragging(true);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !lastTouchRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - lastTouchRef.current.x;
      const dy = t.clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: t.clientX, y: t.clientY };
      const tileSize = Math.floor(BASE_TILE_SIZE * zoom);
      const availableWidth = containerSize.width - COORD_SIZE - 20;
      const availableHeight = containerSize.height - COORD_SIZE - 20;
      const tilesX = Math.min(MAP_SIZE, Math.ceil(availableWidth / tileSize));
      const tilesY = Math.min(MAP_SIZE, Math.ceil(availableHeight / tileSize));
      const threshold = tileSize / 3;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        const tilesDx = Math.round(dx / tileSize);
        const tilesDy = Math.round(dy / tileSize);
        const halfX = Math.floor(tilesX / 2);
        const halfY = Math.floor(tilesY / 2);
        const maxX = MAP_SIZE - tilesX + halfX;
        const maxY = MAP_SIZE - tilesY + halfY;
        setViewCenter((prev) => ({
          x: Math.max(halfX, Math.min(maxX, prev.x - tilesDx)),
          y: Math.max(halfY, Math.min(maxY, prev.y - tilesDy)),
        }));
      }
    };
    const onTouchEnd = () => {
      lastTouchRef.current = null;
      setIsDragging(false);
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom, containerSize.width, containerSize.height]);

  // Load initial map data - load full map for resources/NPCs to show correctly
  useEffect(() => {
    const loadMapData = async () => {
      try {
        // Load the ENTIRE map - center at (49, 49) with size 100 to get (0,0) to (99,99)
        const mapCenter = Math.floor(MAP_SIZE / 2);
        const [regionRes, citiesRes, landsRes, npcsRes] = await Promise.all([
          getMapRegion(mapCenter, mapCenter, MAP_SIZE), // Center at (50,50) to get full map
          getAllCities(),
          getAllLands(),
          getAllNpcs(),
        ]);
        setMapState({
          tiles: regionRes.data.tiles,
          cities: citiesRes.data,
          lands: landsRes.data,
          npcs: npcsRes.data,
          marches: [],
        });
        if (user?.playerId) {
          const myCity = citiesRes.data.find((c: Player) => c.id === user.playerId);
          if (myCity) setViewCenter({ x: myCity.x, y: myCity.y });
        }
      } catch (error) {
        console.error('Failed to load map data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMapData();
  }, [user?.playerId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    subscribeToMarches();
    subscribeToMap({ x: 50, y: 50, size: 100 });
    socket.on('march:update', (march: March) => {
      setMapState((prev) => ({
        ...prev,
        marches: [...prev.marches.filter((m) => m.id !== march.id), march],
      }));
    });
    socket.on('march:complete', ({ marchId }: { marchId: string }) => {
      setMapState((prev) => ({
        ...prev,
        marches: prev.marches.filter((m) => m.id !== marchId),
      }));
    });
    socket.on('map:tile:update', (data: MapTile) => {
      setMapState((prev) => ({
        ...prev,
        tiles: prev.tiles.map((t) => (t.x === data.x && t.y === data.y ? data : t)),
      }));
    });
    return () => {
      socket.off('march:update');
      socket.off('march:complete');
      socket.off('map:tile:update');
    };
  }, []);

  const getTileSize = useCallback((z: number) => Math.floor(BASE_TILE_SIZE * z), []);

  const getViewTiles = useCallback((z?: number) => {
    const tz = z ?? zoom;
    const ts = getTileSize(tz);
    const availableWidth = containerSize.width - COORD_SIZE - 20;
    const availableHeight = containerSize.height - COORD_SIZE - 20;
    const tilesX = Math.ceil(availableWidth / ts);
    const tilesY = Math.ceil(availableHeight / ts);
    return { tilesX: Math.min(tilesX, MAP_SIZE), tilesY: Math.min(tilesY, MAP_SIZE), tileSize: ts };
  }, [containerSize, zoom, getTileSize]);

  /** Clamp view center so the visible area never goes outside map bounds */
  const clampViewCenter = useCallback((z: number, vc: { x: number; y: number }) => {
    const { tilesX, tilesY } = getViewTiles(z);
    const halfX = Math.floor(tilesX / 2);
    const halfY = Math.floor(tilesY / 2);
    const maxX = MAP_SIZE - tilesX + halfX;
    const maxY = MAP_SIZE - tilesY + halfY;
    return {
      x: Math.max(halfX, Math.min(maxX, vc.x)),
      y: Math.max(halfY, Math.min(maxY, vc.y)),
    };
  }, [getViewTiles]);

  // Draw the map (with device pixel ratio for sharp rendering)
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { tilesX, tilesY, tileSize } = getViewTiles();
    const mapPixelW = tilesX * tileSize;
    const mapPixelH = tilesY * tileSize;
    const logicalW = mapPixelW + COORD_SIZE;
    const logicalH = mapPixelH + COORD_SIZE;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(logicalW * dpr);
    const height = Math.round(logicalH * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${logicalW}px`;
      canvas.style.height = `${logicalH}px`;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, logicalW, logicalH);

    const tileMap = new Map(mapState.tiles.map((t) => [`${t.x},${t.y}`, t]));
    const cityMap = new Map(mapState.cities.map((c) => [`${c.x},${c.y}`, c]));
    const npcMap = new Map(mapState.npcs.map((n) => [`${n.x},${n.y}`, n]));
    
    const minX = Math.max(0, viewCenter.x - Math.floor(tilesX / 2));
    const minY = Math.max(0, viewCenter.y - Math.floor(tilesY / 2));

    ctx.save();
    ctx.translate(COORD_SIZE, COORD_SIZE);

    // Draw terrain
    for (let gridY = 0; gridY < tilesY; gridY++) {
      for (let gridX = 0; gridX < tilesX; gridX++) {
        const worldX = minX + gridX;
        const worldY = minY + gridY;
        if (worldX >= MAP_SIZE || worldY >= MAP_SIZE) continue;
        
        const px = gridX * tileSize;
        const py = gridY * tileSize;
        const tile = tileMap.get(`${worldX},${worldY}`);
        const terrain = tile?.terrain || 'plains';
        
        const colorIndex = (gridX + gridY) % 2;
        const colors = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.plains;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(px, py, tileSize, tileSize);

        ctx.strokeStyle = PALETTE.gridLines;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, tileSize, tileSize);

        const cx = px + tileSize / 2;
        const cy = py + tileSize / 2;

        if (terrain === 'forest') drawCleanTree(ctx, cx, cy, tileSize);
        else if (terrain === 'mountain') drawCleanMountain(ctx, cx, cy, tileSize);
        else if (terrain === 'lake') drawWaveLines(ctx, cx, cy, tileSize);
        else if (terrain === 'resource') drawGoldMine(ctx, cx, cy, tileSize);

        const city = cityMap.get(`${worldX},${worldY}`);
        const npc = npcMap.get(`${worldX},${worldY}`);

        if (city) {
          drawPlayerHQ(ctx, cx, cy, tileSize, city.id === user?.playerId);
        } else if (npc) {
          drawMonster(ctx, cx, cy, tileSize);
        } else if (tile?.occupant) {
          drawFactionUnit(ctx, cx, cy, tileSize, tile.occupant.faction);
        }

        if (selectedTile && selectedTile.x === worldX && selectedTile.y === worldY) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        }
      }
    }

    // Draw land parcel borders
    for (const land of mapState.lands) {
      drawLandParcelBorder(ctx, land, minX, minY, tileSize, tilesX, tilesY);
    }

    // Draw marches
    for (const march of mapState.marches) {
      const startGridX = march.originX - minX;
      const startGridY = march.originY - minY;
      const endGridX = march.targetX - minX;
      const endGridY = march.targetY - minY;

      if ((startGridX >= -1 && startGridX <= tilesX && startGridY >= -1 && startGridY <= tilesY) ||
          (endGridX >= -1 && endGridX <= tilesX && endGridY >= -1 && endGridY <= tilesY)) {
        
        const startPx = startGridX * tileSize + tileSize / 2;
        const startPy = startGridY * tileSize + tileSize / 2;
        const endPx = endGridX * tileSize + tileSize / 2;
        const endPy = endGridY * tileSize + tileSize / 2;

        const now = Date.now();
        const start = new Date(march.departureTime).getTime();
        const end = new Date(march.arrivalTime).getTime();
        const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));

        const currentPx = startPx + (endPx - startPx) * progress;
        const currentPy = startPy + (endPy - startPy) * progress;

        ctx.strokeStyle = march.type === 'attack' ? '#e74c3c' : '#3498db';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startPx, startPy);
        ctx.lineTo(endPx, endPy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = march.type === 'attack' ? '#e74c3c' : '#3498db';
        ctx.beginPath();
        ctx.arc(currentPx, currentPy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // "You are here" – ring around your tile (like original) with red so it's visible when zoomed out
    if (user?.playerId) {
      const myCity = mapState.cities.find((c) => c.id === user.playerId);
      if (myCity) {
        const inView = myCity.x >= minX && myCity.x < minX + tilesX && myCity.y >= minY && myCity.y < minY + tilesY;
        if (inView) {
          const gx = myCity.x - minX;
          const gy = myCity.y - minY;
          const cx = gx * tileSize + tileSize / 2;
          const cy = gy * tileSize + tileSize / 2;
          const r = Math.max(tileSize * 0.4, 6);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = Math.max(2, tileSize / 14);
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#dc2626';
          ctx.font = `bold ${Math.max(10, Math.min(14, Math.floor(tileSize / 3.5)))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('You', cx, cy - r - Math.max(6, tileSize / 4));
        } else {
          drawYouOffScreenIndicator(ctx, myCity.x, myCity.y, minX, minY, tilesX, tilesY, tileSize);
        }
      }
    }

    ctx.restore();
    drawCoordinates(ctx, minX, minY, tilesX, tilesY, tileSize, logicalW, logicalH);

    // Compass (N) in top-right – only when there's room (skip on very small canvas)
    if (logicalW > 120 && logicalH > 100) {
      const compassX = logicalW - 32;
      const compassY = COORD_SIZE + 24;
      ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
      ctx.strokeStyle = 'rgba(100, 100, 120, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(compassX, compassY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', compassX, compassY - 1);
    }

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, logicalW, logicalH);
  }, [mapState, viewCenter, zoom, selectedTile, user?.playerId, getViewTiles]);

  useEffect(() => { drawMap(); }, [drawMap]);

  useEffect(() => {
    if (mapState.marches.length === 0) return;
    const interval = setInterval(() => drawMap(), 100);
    return () => clearInterval(interval);
  }, [mapState.marches.length, drawMap]);

  // Handle canvas click (use logical/CSS coordinates; canvas is displayed at logical size)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const mapX = canvasX - COORD_SIZE;
    const mapY = canvasY - COORD_SIZE;
    if (mapX < 0 || mapY < 0) return;
    const { tilesX, tilesY, tileSize } = getViewTiles();
    const gridX = Math.floor(mapX / tileSize);
    const gridY = Math.floor(mapY / tileSize);
    if (gridX >= 0 && gridX < tilesX && gridY >= 0 && gridY < tilesY) {
      const minX = Math.max(0, viewCenter.x - Math.floor(tilesX / 2));
      const minY = Math.max(0, viewCenter.y - Math.floor(tilesY / 2));
      setSelectedTile({ x: minX + gridX, y: minY + gridY });
    }
  };

  // Handle mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const { tilesX, tilesY, tileSize } = getViewTiles();
    const threshold = tileSize / 3;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      const tilesDx = Math.round(dx / tileSize);
      const tilesDy = Math.round(dy / tileSize);
      const halfX = Math.floor(tilesX / 2);
      const halfY = Math.floor(tilesY / 2);
      const maxX = MAP_SIZE - tilesX + halfX;
      const maxY = MAP_SIZE - tilesY + halfY;
      setViewCenter(prev => ({
        x: Math.max(halfX, Math.min(maxX, prev.x - tilesDx)),
        y: Math.max(halfY, Math.min(maxY, prev.y - tilesDy)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Keep view center in bounds when zoom or container changes (fixes "scroll outside map" bug)
  useEffect(() => {
    const clamped = clampViewCenter(zoom, viewCenter);
    if (clamped.x !== viewCenter.x || clamped.y !== viewCenter.y) {
      setViewCenter(clamped);
    }
  }, [zoom, containerSize.width, containerSize.height, viewCenter, clampViewCenter]);

  // Start smooth zoom/pan animation toward target (clamps view so we never go out of bounds)
  const startZoomAnimation = useCallback((newZoom: number, newViewCenter: { x: number; y: number }) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    targetZoomRef.current = clampedZoom;
    const { tilesX, tilesY } = getViewTiles(clampedZoom);
    const halfX = Math.floor(tilesX / 2);
    const halfY = Math.floor(tilesY / 2);
    const maxX = MAP_SIZE - tilesX + halfX;
    const maxY = MAP_SIZE - tilesY + halfY;
    const clampedVC = {
      x: Math.max(halfX, Math.min(maxX, newViewCenter.x)),
      y: Math.max(halfY, Math.min(maxY, newViewCenter.y)),
    };
    targetViewCenterRef.current = clampedVC;
    animationStartRef.current = { zoom, viewCenter: { ...viewCenter } };
    animationStartTimeRef.current = performance.now();

    const step = () => {
      const elapsed = performance.now() - animationStartTimeRef.current;
      const t = Math.min(1, elapsed / ZOOM_ANIMATION_MS);
      const eased = easeOutCubic(t);
      const start = animationStartRef.current!;
      const targetZ = targetZoomRef.current!;
      const targetVC = targetViewCenterRef.current!;
      const newZ = start.zoom + (targetZ - start.zoom) * eased;
      const newVx = start.viewCenter.x + (targetVC.x - start.viewCenter.x) * eased;
      const newVy = start.viewCenter.y + (targetVC.y - start.viewCenter.y) * eased;
      const { tilesX: tx, tilesY: ty } = getViewTiles(newZ);
      const hx = Math.floor(tx / 2);
      const hy = Math.floor(ty / 2);
      const mx = MAP_SIZE - tx + hx;
      const my = MAP_SIZE - ty + hy;
      setZoom(newZ);
      setViewCenter({
        x: Math.max(hx, Math.min(mx, newVx)),
        y: Math.max(hy, Math.min(my, newVy)),
      });
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        targetZoomRef.current = null;
        targetViewCenterRef.current = null;
        animationStartRef.current = null;
      }
    };
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(step);
  }, [zoom, viewCenter, getViewTiles]);

  // Wheel: zoom in place (keeps view stable, no jumpy pan)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    if (newZoom === zoom) return;
    startZoomAnimation(newZoom, viewCenter);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const { data } = await searchPlayer(searchQuery);
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const goToLocation = (x: number, y: number) => {
    setViewCenter({ x, y });
    setSearchResults([]);
    setSearchQuery('');
  };

  const goToMyCity = () => {
    const myCity = mapState.cities.find((c) => c.id === user?.playerId);
    if (myCity) goToLocation(myCity.x, myCity.y);
  };

  const fitMapToScreen = () => {
    const availableWidth = containerSize.width - COORD_SIZE - 40;
    const availableHeight = containerSize.height - COORD_SIZE - 40;
    const targetTiles = 30;
    const zoomForWidth = availableWidth / (targetTiles * BASE_TILE_SIZE);
    const zoomForHeight = availableHeight / (targetTiles * BASE_TILE_SIZE);
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomForWidth, zoomForHeight)));
    startZoomAnimation(targetZoom, viewCenter);
  };

  const getSelectedTileInfo = () => {
    if (!selectedTile) return null;
    const { x, y } = selectedTile;
    const tile = mapState.tiles.find((t) => t.x === x && t.y === y);
    const city = mapState.cities.find((c) => c.x === x && c.y === y);
    const npc = mapState.npcs.find((n) => n.x === x && n.y === y);
    const land = mapState.lands.find(
      (l) => x >= l.bounds.minX && x <= l.bounds.maxX && y >= l.bounds.minY && y <= l.bounds.maxY
    );
    return { tile, city, npc, land };
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  const tileInfo = getSelectedTileInfo();
  const zoomPercent = Math.round(zoom * 100);
  const isMobile = containerSize.width < 640;

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden min-h-0">
      {/* Toolbar – wraps on mobile, larger tap targets */}
      <div className="bg-gray-800 border-b border-gray-700 p-2 sm:p-3 flex flex-wrap items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search player..."
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-32 sm:w-48 text-sm min-h-[44px] sm:min-h-0"
          />
          <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:py-1.5 rounded text-sm transition-colors min-h-[44px] sm:min-h-0">
            Search
          </button>
          {searchResults.length > 0 && (
            <div className="absolute top-12 sm:top-14 left-2 sm:left-4 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-40 overflow-y-auto w-[calc(100vw-2rem)] max-w-64 z-20">
              {searchResults.map((player) => (
                <button
                  key={player.id}
                  onClick={() => goToLocation(player.x, player.y)}
                  className="w-full px-3 py-3 text-left hover:bg-gray-700 flex items-center justify-between text-sm min-h-[44px]"
                >
                  <span style={{ color: FACTION_COLORS[player.faction] }}>{player.username}</span>
                  <span className="text-gray-500">({player.x}, {player.y})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <button
            onClick={() => startZoomAnimation(Math.min(MAX_ZOOM, zoom * ZOOM_STEP_MULT), viewCenter)}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-semibold transition-all duration-150"
            title="Zoom in 25%"
          >+</button>
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            value={zoom * 100}
            onChange={(e) => {
              const z = Number(e.target.value) / 100;
              startZoomAnimation(z, viewCenter);
            }}
            className="map-zoom-slider w-20 sm:w-24 h-2"
          />
          <span className="w-10 sm:w-12 text-center text-xs tabular-nums">{zoomPercent}%</span>
          <button
            onClick={() => startZoomAnimation(Math.max(MIN_ZOOM, zoom / ZOOM_STEP_MULT), viewCenter)}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-semibold transition-all duration-150"
            title="Zoom out 25%"
          >−</button>
        </div>

        <button onClick={goToMyCity} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 sm:py-1.5 rounded text-sm transition-colors min-h-[44px] sm:min-h-0">
          📍 My City
        </button>
        
        <button onClick={fitMapToScreen} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 sm:py-1.5 rounded text-sm transition-colors min-h-[44px] sm:min-h-0" title="Zoom to show more tiles">
          🔍 Fit
        </button>
      </div>

      {/* Map Container – smaller min-height on mobile, touch-friendly */}
      <div 
        ref={containerRef}
        className="flex-1 min-h-[260px] sm:min-h-[380px] md:min-h-[420px] overflow-hidden flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 relative min-w-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="max-w-full max-h-full w-full h-full object-contain shadow-xl sm:shadow-2xl rounded sm:rounded-lg ring-1 ring-gray-700/50"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Tile Info Panel – full width on mobile */}
      {selectedTile && tileInfo && (
        <div className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-auto sm:w-64 bg-gray-800/95 border border-gray-700 rounded-lg p-3 shadow-xl z-10 text-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-white font-medium">Tile ({selectedTile.x}, {selectedTile.y})</h3>
            <button onClick={() => setSelectedTile(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Terrain</span>
              <span className="text-white capitalize">{tileInfo.tile?.terrain || 'plains'}</span>
            </div>
            {tileInfo.city && (
              <div className="bg-gray-700/50 rounded p-2 mt-2">
                <div className="text-gray-400 text-xs">City</div>
                <div style={{ color: FACTION_COLORS[tileInfo.city.faction] }} className="font-medium">{tileInfo.city.username}</div>
                <div className="text-gray-500 text-xs capitalize">{tileInfo.city.faction}</div>
              </div>
            )}
            {tileInfo.npc && (
              <div className="bg-red-900/30 border border-red-800/50 rounded p-2 mt-2">
                <div className="text-gray-400 text-xs">Monster</div>
                <div className="text-red-400 font-medium capitalize">{tileInfo.npc.type.replace('_', ' ')}</div>
                <div className="text-gray-500 text-xs">Power: {tileInfo.npc.power.toLocaleString()}</div>
              </div>
            )}
            {tileInfo.land && (
              <div className="bg-yellow-900/30 border border-yellow-800/50 rounded p-2 mt-2">
                <div className="text-gray-400 text-xs">Land Parcel</div>
                <div className="text-yellow-400 font-medium capitalize">{tileInfo.land.type}</div>
                {tileInfo.land.owner && <div className="text-gray-500 text-xs">Owner: {tileInfo.land.owner.username}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend – hidden on mobile to free space */}
      {!isMobile && (
        <div className="absolute top-14 sm:top-16 right-2 sm:right-4 bg-gray-800/95 border border-gray-700 rounded-lg p-2 z-10 text-xs">
          <div className="text-gray-400 mb-1">Factions</div>
          <div className="space-y-0.5">
            {Object.entries(FACTION_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                <span className="text-gray-300 capitalize">{name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-gray-700">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-gray-300">Monster</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats – compact on mobile */}
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-gray-800/95 border border-gray-700 rounded-lg p-2 z-10 text-xs">
        <div className="space-y-0.5">
          <div className="text-gray-400">Center: <span className="text-white">({viewCenter.x}, {viewCenter.y})</span></div>
          {!isMobile && (
            <>
              <div className="text-gray-400">Cities: <span className="text-white">{mapState.cities.length}</span></div>
              <div className="text-gray-400">Monsters: <span className="text-white">{mapState.npcs.length}</span></div>
              <div className="text-gray-400">Lands: <span className="text-white">{mapState.lands.length}</span></div>
            </>
          )}
        </div>
      </div>

      {/* Controls hint – shorter on mobile */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-800/80 border border-gray-700 rounded px-2 py-1 z-10 pointer-events-none">
        <span className="text-xs text-gray-400">{isMobile ? 'Drag to pan • Use +/- to zoom' : 'Drag to pan • Scroll to zoom • Click to select'}</span>
      </div>
    </div>
  );
}
