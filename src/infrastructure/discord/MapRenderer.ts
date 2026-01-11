import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import type { Faction } from '../../shared/types/index.js';

// --- CONFIGURATION ---
const TILE_SIZE = 60;
const COORD_SIZE = 24;

// "Tactical" Palette - Clean, Matte, High Contrast
const PALETTE = {
  bg: '#202028',
  gridLines: 'rgba(0, 0, 0, 0.1)', // Even subtler grid lines
  coordBg: '#2b2b36',
  coordText: '#aaa',
};

const TERRAIN_COLORS: Record<string, [string, string]> = {
  plains:   ['#7bc043', '#71b33c'], // Checkerboard Greens
  forest:   ['#63a335', '#59942e'],
  mountain: ['#95a5a6', '#8e9e9f'],
  lake:     ['#4fb9e3', '#45a6ce'],
  resource: ['#f1c40f', '#eebb0d'],
  void:     ['#2c3e50', '#2c3e50'],
};

const FACTION_COLORS: Record<Faction, string> = {
  cinema: '#e74c3c',
  otaku:  '#2ecc71',
  arcade: '#3498db',
};

interface TileData {
  x: number;
  y: number;
  terrain: string;
  occupant_id: string | null;
  occupant_faction?: Faction;
  npc_id: string | null;
}

interface LandData {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  type: string;
  ownerType: 'player' | 'guild' | null;
}

export interface MapRenderOptions {
  tiles: TileData[];
  playerX: number;
  playerY: number;
  centerX: number;
  centerY: number;
  viewSize: number;
  lands?: LandData[];
}

export function renderMapImage(options: MapRenderOptions): Buffer {
  const { tiles, playerX, playerY, centerX, centerY, viewSize, lands = [] } = options;

  const mapPixelSize = viewSize * TILE_SIZE;
  const canvasW = mapPixelSize + COORD_SIZE;
  const canvasH = mapPixelSize + COORD_SIZE;
  
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // 1. Clean Background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const tileMap = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));
  const minX = centerX - Math.floor(viewSize / 2);
  const minY = centerY - Math.floor(viewSize / 2);

  // Create a map of tiles that are within land parcels
  const landTileMap = new Map<string, LandData>();
  for (const land of lands) {
    for (let ly = land.minY; ly <= land.maxY; ly++) {
      for (let lx = land.minX; lx <= land.maxX; lx++) {
        landTileMap.set(`${lx},${ly}`, land);
      }
    }
  }

  ctx.translate(COORD_SIZE, COORD_SIZE);

  // 2. Render Grid & Terrain
  for (let gridY = 0; gridY < viewSize; gridY++) {
    for (let gridX = 0; gridX < viewSize; gridX++) {
      const worldX = minX + gridX;
      const worldY = minY + gridY;
      const px = gridX * TILE_SIZE;
      const py = gridY * TILE_SIZE;
      const tile = tileMap.get(`${worldX},${worldY}`);
      const terrain = tile?.terrain || 'plains';
      
      // Checkerboard Terrain
      const colorIndex = (gridX + gridY) % 2; 
      const colors = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.plains;
      ctx.fillStyle = colors[colorIndex];
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Grid Lines
      ctx.strokeStyle = PALETTE.gridLines;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

      // Terrain Features
      const cx = px + TILE_SIZE / 2;
      const cy = py + TILE_SIZE / 2;

      if (terrain === 'forest') drawCleanTree(ctx, cx, cy, TILE_SIZE);
      else if (terrain === 'mountain') drawCleanMountain(ctx, cx, cy, TILE_SIZE);
      else if (terrain === 'lake') drawWaveLines(ctx, cx, cy, TILE_SIZE);
      
      // --- NEW ICONS ---
      // Resource is drawn before units so units stand on top
      if (terrain === 'resource') {
        drawNewGoldMine(ctx, cx, cy, TILE_SIZE);
      }

      // Units / Monsters / HQ
      if (worldX === playerX && worldY === playerY) {
        drawNewPlayerHQ(ctx, cx, cy, TILE_SIZE);
      } else if (tile?.npc_id) {
        drawNewMonster(ctx, cx, cy, TILE_SIZE);
      } else if (tile?.occupant_id && tile.occupant_faction) {
        drawFactionUnit(ctx, cx, cy, TILE_SIZE, FACTION_COLORS[tile.occupant_faction], tile.occupant_faction);
      }
    }
  }

  // 3. Draw land parcel borders (on top of terrain)
  for (const land of lands) {
    drawLandParcelBorder(ctx, land, minX, minY, viewSize);
  }

  // 4. UI & Borders
  ctx.translate(-COORD_SIZE, -COORD_SIZE);
  drawCoordinates(ctx, minX, minY, viewSize, canvasW, canvasH);

  // Final crisp border
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvasW, canvasH);

  return canvas.toBuffer('image/png');
}

// ================= NEW ICON RENDERERS =================

/**
 * A proper mine entrance with wooden supports and cart tracks.
 * More recognizable as a mine than gold crystals.
 */
function drawNewGoldMine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const iconSize = s * 0.7;
    
    // 1. Ground/dirt mound
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.ellipse(x, y + iconSize*0.3, iconSize*0.45, iconSize*0.2, 0, 0, Math.PI*2);
    ctx.fill();

    // 2. Dark mine entrance (cave opening)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x, y + iconSize*0.1, iconSize*0.28, Math.PI, 0, false);
    ctx.lineTo(x + iconSize*0.28, y + iconSize*0.25);
    ctx.lineTo(x - iconSize*0.28, y + iconSize*0.25);
    ctx.closePath();
    ctx.fill();

    // 3. Wooden support beams (left)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - iconSize*0.32, y - iconSize*0.25, iconSize*0.08, iconSize*0.5);
    
    // 3b. Wooden support beams (right)
    ctx.fillRect(x + iconSize*0.24, y - iconSize*0.25, iconSize*0.08, iconSize*0.5);
    
    // 4. Top beam (horizontal)
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x - iconSize*0.35, y - iconSize*0.3, iconSize*0.7, iconSize*0.1);

    // 5. Mine cart tracks (two rails)
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - iconSize*0.15, y + iconSize*0.25);
    ctx.lineTo(x - iconSize*0.1, y + iconSize*0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + iconSize*0.15, y + iconSize*0.25);
    ctx.lineTo(x + iconSize*0.1, y + iconSize*0.4);
    ctx.stroke();

    // 6. Gold nugget indicator (small sparkle)
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + iconSize*0.2, y - iconSize*0.15, iconSize*0.08, 0, Math.PI*2);
    ctx.fill();
    
    // Sparkle effect
    ctx.strokeStyle = '#FFF8DC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + iconSize*0.2, y - iconSize*0.25);
    ctx.lineTo(x + iconSize*0.2, y - iconSize*0.05);
    ctx.moveTo(x + iconSize*0.1, y - iconSize*0.15);
    ctx.lineTo(x + iconSize*0.3, y - iconSize*0.15);
    ctx.stroke();
}

/**
 * A menacing, horned silhouette creature with aggressive eyes.
 * Replaces the generic skull.
 */
function drawNewMonster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const iconSize = s * 0.7;

    // 1. Red Danger Zone Indicator (Subtle ground marking)
    ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + iconSize*0.35, iconSize*0.45, iconSize*0.2, 0, 0, Math.PI*2);
    ctx.fill();

    // 2. Monster Silhouette Body (Dark purple/black)
    ctx.fillStyle = '#2c2c3a';
    ctx.beginPath();
    // Head/Shoulders
    ctx.moveTo(x - iconSize*0.3, y + iconSize*0.3); // Bottom left
    ctx.lineTo(x - iconSize*0.35, y - iconSize*0.1); // Shoulder left
    // Left Horn
    ctx.lineTo(x - iconSize*0.2, y - iconSize*0.5); // Horn tip
    ctx.lineTo(x - iconSize*0.05, y - iconSize*0.2); // Head dip
    // Right Horn
    ctx.lineTo(x + iconSize*0.2, y - iconSize*0.5); // Horn tip
    ctx.lineTo(x + iconSize*0.35, y - iconSize*0.1); // Shoulder right
    ctx.lineTo(x + iconSize*0.3, y + iconSize*0.3); // Bottom right
    ctx.closePath();
    ctx.fill();

    // Dark outline to define shape against terrain
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Aggressive Eyes (Flat Red Slits)
    ctx.fillStyle = '#ff3838';
    // Left Eye
    ctx.beginPath();
    ctx.moveTo(x - iconSize*0.2, y - iconSize*0.15);
    ctx.lineTo(x - iconSize*0.05, y - iconSize*0.05);
    ctx.lineTo(x - iconSize*0.2, y - iconSize*0.02);
    ctx.fill();
    // Right Eye
    ctx.beginPath();
    ctx.moveTo(x + iconSize*0.2, y - iconSize*0.15);
    ctx.lineTo(x + iconSize*0.05, y - iconSize*0.05);
    ctx.lineTo(x + iconSize*0.2, y - iconSize*0.02);
    ctx.fill();
}

/**
 * A fortified central keep with a prominent flag.
 * Replaces the generic house+text.
 */
function drawNewPlayerHQ(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const iconSize = s * 0.75;

    // 1. Baseplate (Token look)
    ctx.fillStyle = '#95a5a6'; // Grey stone base
    ctx.beginPath();
    ctx.ellipse(x, y + iconSize*0.35, iconSize*0.45, iconSize*0.15, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Main Keep Structure
    ctx.fillStyle = '#e67e22'; // Warm stone color
    const keepW = iconSize * 0.5;
    const keepH = iconSize * 0.5;
    ctx.fillRect(x - keepW/2, y - keepH/2, keepW, keepH);
    
    // Battlements (Top notches)
    ctx.fillStyle = '#d35400'; // Darker trim
    ctx.fillRect(x - keepW/2, y - keepH/2 - 5, keepW, 5);
    ctx.clearRect(x - keepW/6, y - keepH/2 - 5, keepW/3, 5); // Notch out middle

    // Doorway
    ctx.fillStyle = '#6e4d43';
    ctx.fillRect(x - keepW/6, y + keepH/4, keepW/3, keepH/4);

    // 3. Prominent Flag
    // Pole
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - keepH/2 - 5);
    ctx.lineTo(x, y - iconSize*0.7);
    ctx.stroke();

    // Banner (Red for player)
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(x, y - iconSize*0.7);
    ctx.lineTo(x + iconSize*0.4, y - iconSize*0.55);
    ctx.lineTo(x, y - iconSize*0.4);
    ctx.fill();

    // Final thick outline for the whole structure to pop
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - keepW/2, y - keepH/2, keepW, keepH);
}

// ================= EXISTING SIMPLE RENDERERS =================
// (Kept these simple as they act more like terrain decorations)

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

function drawWaveLines(ctx: CanvasRenderingContext2D, x: number, y: number, _s: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 10, y - 5); ctx.lineTo(x + 10, y - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 15, y + 5); ctx.lineTo(x + 5, y + 5); ctx.stroke();
}

function drawFactionUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, faction?: Faction) {
  const iconSize = s * 0.65;
  
  // Base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + iconSize*0.35, iconSize*0.4, iconSize*0.15, 0, 0, Math.PI*2);
  ctx.fill();

  // Draw faction-specific icon
  if (faction === 'cinema') {
    // Cinema: Film camera / clapperboard style
    drawCinemaUnit(ctx, x, y, iconSize, color);
  } else if (faction === 'otaku') {
    // Otaku: Ninja/anime style warrior
    drawOtakuUnit(ctx, x, y, iconSize, color);
  } else if (faction === 'arcade') {
    // Arcade: Pixel knight / game character
    drawArcadeUnit(ctx, x, y, iconSize, color);
  } else {
    // Default: Shield warrior
    drawDefaultUnit(ctx, x, y, iconSize, color);
  }
}

function drawCinemaUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Cinema faction: Action hero silhouette with star
  
  // Body (action pose)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s*0.4); // Head top
  ctx.lineTo(x + s*0.25, y - s*0.1); // Right shoulder
  ctx.lineTo(x + s*0.35, y + s*0.15); // Right arm out
  ctx.lineTo(x + s*0.15, y + s*0.1); // Right side
  ctx.lineTo(x + s*0.12, y + s*0.35); // Right leg
  ctx.lineTo(x, y + s*0.25); // Center
  ctx.lineTo(x - s*0.12, y + s*0.35); // Left leg
  ctx.lineTo(x - s*0.15, y + s*0.1); // Left side
  ctx.lineTo(x - s*0.25, y - s*0.1); // Left shoulder
  ctx.closePath();
  ctx.fill();
  
  // Head
  ctx.beginPath();
  ctx.arc(x, y - s*0.3, s*0.15, 0, Math.PI*2);
  ctx.fill();
  
  // Star badge
  ctx.fillStyle = '#FFD700';
  drawStar(ctx, x + s*0.2, y - s*0.35, s*0.1, 5);
  
  // Outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawOtakuUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Otaku faction: Ninja/anime warrior with headband
  
  // Body (ninja pose)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s*0.35); // Head top
  ctx.lineTo(x + s*0.2, y - s*0.15); // Right shoulder
  ctx.lineTo(x + s*0.3, y + s*0.05); // Right arm
  ctx.lineTo(x + s*0.1, y + s*0.15); // Right side
  ctx.lineTo(x + s*0.15, y + s*0.35); // Right leg
  ctx.lineTo(x, y + s*0.3); // Center
  ctx.lineTo(x - s*0.15, y + s*0.35); // Left leg
  ctx.lineTo(x - s*0.1, y + s*0.15); // Left side
  ctx.lineTo(x - s*0.3, y + s*0.05); // Left arm (kunai)
  ctx.lineTo(x - s*0.2, y - s*0.15); // Left shoulder
  ctx.closePath();
  ctx.fill();
  
  // Head
  ctx.beginPath();
  ctx.arc(x, y - s*0.25, s*0.14, 0, Math.PI*2);
  ctx.fill();
  
  // Headband tails
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + s*0.12, y - s*0.28);
  ctx.lineTo(x + s*0.35, y - s*0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s*0.12, y - s*0.25);
  ctx.lineTo(x + s*0.32, y - s*0.12);
  ctx.stroke();
  
  // Headband
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - s*0.15, y - s*0.32, s*0.3, s*0.06);
  
  // Spiral symbol on headband
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - s*0.29, s*0.03, 0, Math.PI*1.5);
  ctx.stroke();
  
  // Outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
}

function drawArcadeUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Arcade faction: Pixel knight / retro game character
  
  // Shield
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s*0.25, y - s*0.1);
  ctx.lineTo(x - s*0.25, y + s*0.2);
  ctx.lineTo(x - s*0.1, y + s*0.3);
  ctx.lineTo(x - s*0.1, y - s*0.1);
  ctx.closePath();
  ctx.fill();
  
  // Shield emblem (pixel heart)
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - s*0.22, y, s*0.04, s*0.04);
  ctx.fillRect(x - s*0.16, y - s*0.02, s*0.04, s*0.04);
  ctx.fillRect(x - s*0.19, y + s*0.04, s*0.04, s*0.06);
  
  // Body (blocky/pixel style)
  ctx.fillStyle = color;
  ctx.fillRect(x - s*0.08, y - s*0.15, s*0.22, s*0.35);
  
  // Head (helmet)
  ctx.fillRect(x - s*0.1, y - s*0.35, s*0.26, s*0.22);
  
  // Visor
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x - s*0.06, y - s*0.28, s*0.18, s*0.08);
  
  // Visor shine
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(x - s*0.04, y - s*0.26, s*0.06, s*0.04);
  
  // Sword
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x + s*0.15, y - s*0.3, s*0.04, s*0.4);
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + s*0.13, y + s*0.08, s*0.08, s*0.06);
  
  // Outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - s*0.1, y - s*0.35, s*0.26, s*0.22);
}

function drawDefaultUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Default: Simple warrior with shield
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - s*0.15, s*0.12, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath(); // Body
  ctx.moveTo(x, y - s*0.05);
  ctx.lineTo(x + s*0.15, y + s*0.25);
  ctx.lineTo(x - s*0.15, y + s*0.25);
  ctx.fill();
  
  // Shield
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.ellipse(x - s*0.12, y + s*0.05, s*0.08, s*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.5;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCoordinates(ctx: CanvasRenderingContext2D, minX: number, minY: number, viewSize: number, w: number, h: number) {
  ctx.fillStyle = PALETTE.coordBg;
  ctx.fillRect(COORD_SIZE, 0, w - COORD_SIZE, COORD_SIZE); 
  ctx.fillRect(0, COORD_SIZE, COORD_SIZE, h - COORD_SIZE); 
  ctx.fillStyle = '#f1c40f'; 
  ctx.fillRect(0, 0, COORD_SIZE, COORD_SIZE);
  ctx.fillStyle = PALETTE.coordText;
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < viewSize; i++) {
    const centerOffset = COORD_SIZE + (i * TILE_SIZE) + (TILE_SIZE / 2);
    ctx.fillText(`${minX + i}`, centerOffset, COORD_SIZE / 2);
    const yCenter = COORD_SIZE + (i * TILE_SIZE) + (TILE_SIZE / 2);
    ctx.fillText(`${minY + i}`, COORD_SIZE / 2, yCenter);
  }
}

// Land type colors for borders
const LAND_BORDER_COLORS: Record<string, string> = {
  farm: '#27ae60',    // Green for farms
  mine: '#7f8c8d',    // Grey for mines
  goldmine: '#f1c40f', // Gold for gold mines
  fort: '#9b59b6',    // Purple for forts
};

/**
 * Draw a colored border around a land parcel
 */
function drawLandParcelBorder(
  ctx: CanvasRenderingContext2D,
  land: LandData,
  minX: number,
  minY: number,
  viewSize: number
): void {
  const maxX = minX + viewSize - 1;
  const maxY = minY + viewSize - 1;

  // Check if land is visible in current view
  if (land.maxX < minX || land.minX > maxX || land.maxY < minY || land.minY > maxY) {
    return; // Land is not visible
  }

  // Calculate visible portion of land
  const visMinX = Math.max(land.minX, minX);
  const visMaxX = Math.min(land.maxX, maxX);
  const visMinY = Math.max(land.minY, minY);
  const visMaxY = Math.min(land.maxY, maxY);

  // Convert to pixel coordinates
  const px1 = (visMinX - minX) * TILE_SIZE;
  const py1 = (visMinY - minY) * TILE_SIZE;
  const px2 = (visMaxX - minX + 1) * TILE_SIZE;
  const py2 = (visMaxY - minY + 1) * TILE_SIZE;

  const borderColor = LAND_BORDER_COLORS[land.type] || '#ffffff';
  
  // Draw semi-transparent fill
  ctx.fillStyle = land.ownerType ? `${borderColor}20` : `${borderColor}10`;
  ctx.fillRect(px1, py1, px2 - px1, py2 - py1);

  // Draw border (thicker if owned)
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = land.ownerType ? 3 : 2;
  ctx.setLineDash(land.ownerType ? [] : [5, 5]); // Dashed if unowned
  ctx.strokeRect(px1 + 1, py1 + 1, px2 - px1 - 2, py2 - py1 - 2);
  ctx.setLineDash([]); // Reset dash

  // Draw land type icon in corner if land is large enough
  if (px2 - px1 >= TILE_SIZE && py2 - py1 >= TILE_SIZE) {
    const iconX = px1 + 12;
    const iconY = py1 + 12;
    
    // Background circle
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Icon text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons: Record<string, string> = { farm: '🌾', mine: '⛏️', goldmine: '💰', fort: '🏰' };
    ctx.fillText(icons[land.type] || '?', iconX, iconY);
  }
}