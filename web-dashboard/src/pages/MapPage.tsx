import { useEffect, useState, useCallback, useRef } from 'react';
import { getMapRegion, getAllCities, getAllLands, getAllNpcs, searchPlayer } from '../services/api';
import { getSocket, subscribeToMarches, subscribeToMap } from '../services/socket';
import type { MapTile, Player, LandParcel, March } from '../types';
import { useAuthStore } from '../store/authStore';

// --- CONFIGURATION ---
const COORD_SIZE = 24;
const DEFAULT_ZOOM = 1.0;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const ZOOM_SPEED = 0.08;
const BASE_TILE_SIZE = 48;
const MAP_SIZE = 100;

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
  otaku:  '#2ecc71',
  arcade: '#3498db',
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
  for (let i = 0; i < viewTilesX; i++) {
    const centerOffset = COORD_SIZE + (i * tileSize) + (tileSize / 2);
    if (centerOffset < w) ctx.fillText(`${minX + i}`, centerOffset, COORD_SIZE / 2);
  }
  for (let i = 0; i < viewTilesY; i++) {
    const yCenter = COORD_SIZE + (i * tileSize) + (tileSize / 2);
    if (yCenter < h) ctx.fillText(`${minY + i}`, COORD_SIZE / 2, yCenter);
  }
}

// ================= MAIN COMPONENT =================

export default function MapPage() {
  const { user } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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

  // Load initial map data
  useEffect(() => {
    const loadMapData = async () => {
      try {
        const [regionRes, citiesRes, landsRes, npcsRes] = await Promise.all([
          getMapRegion(50, 50, 100),
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

  // Calculate tile size and view dimensions based on zoom and container
  const getTileSize = useCallback(() => {
    return Math.floor(BASE_TILE_SIZE * zoom);
  }, [zoom]);

  const getViewTiles = useCallback(() => {
    const tileSize = getTileSize();
    const availableWidth = containerSize.width - COORD_SIZE - 20;
    const availableHeight = containerSize.height - COORD_SIZE - 20;
    const tilesX = Math.ceil(availableWidth / tileSize);
    const tilesY = Math.ceil(availableHeight / tileSize);
    return { tilesX: Math.min(tilesX, MAP_SIZE), tilesY: Math.min(tilesY, MAP_SIZE) };
  }, [containerSize, getTileSize]);

  // Draw the map
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileSize = getTileSize();
    const { tilesX, tilesY } = getViewTiles();
    
    const mapPixelW = tilesX * tileSize;
    const mapPixelH = tilesY * tileSize;
    const canvasW = mapPixelW + COORD_SIZE;
    const canvasH = mapPixelH + COORD_SIZE;

    canvas.width = canvasW;
    canvas.height = canvasH;

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

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

    ctx.restore();
    drawCoordinates(ctx, minX, minY, tilesX, tilesY, tileSize, canvasW, canvasH);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasW, canvasH);
  }, [mapState, viewCenter, zoom, selectedTile, user?.playerId, getTileSize, getViewTiles]);

  useEffect(() => { drawMap(); }, [drawMap]);

  useEffect(() => {
    if (mapState.marches.length === 0) return;
    const interval = setInterval(() => drawMap(), 100);
    return () => clearInterval(interval);
  }, [mapState.marches.length, drawMap]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const mapX = canvasX - COORD_SIZE;
    const mapY = canvasY - COORD_SIZE;
    if (mapX < 0 || mapY < 0) return;
    const tileSize = getTileSize();
    const { tilesX, tilesY } = getViewTiles();
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
    const tileSize = getTileSize();
    const threshold = tileSize / 3;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      const tilesDx = Math.round(dx / tileSize);
      const tilesDy = Math.round(dy / tileSize);
      const { tilesX, tilesY } = getViewTiles();
      setViewCenter(prev => ({
        x: Math.max(Math.floor(tilesX/2), Math.min(MAP_SIZE - Math.floor(tilesX/2), prev.x - tilesDx)),
        y: Math.max(Math.floor(tilesY/2), Math.min(MAP_SIZE - Math.floor(tilesY/2), prev.y - tilesDy)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle zoom - smooth and controlled
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
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

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-4 flex-shrink-0">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search player..."
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48 text-sm"
          />
          <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors">
            Search
          </button>
          {searchResults.length > 0 && (
            <div className="absolute top-14 left-4 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-48 overflow-y-auto w-64 z-20">
              {searchResults.map((player) => (
                <button
                  key={player.id}
                  onClick={() => goToLocation(player.x, player.y)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center justify-between text-sm"
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
            onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.2))}
            className="bg-gray-700 hover:bg-gray-600 text-white w-7 h-7 rounded flex items-center justify-center font-bold transition-colors"
            title="Zoom in"
          >+</button>
          <span className="w-14 text-center text-xs">{zoomPercent}%</span>
          <button
            onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.2))}
            className="bg-gray-700 hover:bg-gray-600 text-white w-7 h-7 rounded flex items-center justify-center font-bold transition-colors"
            title="Zoom out"
          >−</button>
        </div>

        <button onClick={goToMyCity} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition-colors">
          📍 My City
        </button>
      </div>

      {/* Map Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-gray-900 relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          className="shadow-2xl rounded"
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>

      {/* Tile Info Panel */}
      {selectedTile && tileInfo && (
        <div className="absolute bottom-4 left-4 bg-gray-800/95 border border-gray-700 rounded-lg p-3 shadow-xl z-10 w-64 text-sm">
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

      {/* Legend */}
      <div className="absolute top-16 right-4 bg-gray-800/95 border border-gray-700 rounded-lg p-2 z-10 text-xs">
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

      {/* Stats */}
      <div className="absolute bottom-4 right-4 bg-gray-800/95 border border-gray-700 rounded-lg p-2 z-10 text-xs">
        <div className="space-y-0.5">
          <div className="text-gray-400">Center: <span className="text-white">({viewCenter.x}, {viewCenter.y})</span></div>
          <div className="text-gray-400">Cities: <span className="text-white">{mapState.cities.length}</span></div>
          <div className="text-gray-400">Monsters: <span className="text-white">{mapState.npcs.length}</span></div>
          <div className="text-gray-400">Lands: <span className="text-white">{mapState.lands.length}</span></div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/80 border border-gray-700 rounded px-2 py-1 z-10">
        <span className="text-xs text-gray-400">Drag to pan • Scroll to zoom • Click to select</span>
      </div>
    </div>
  );
}
