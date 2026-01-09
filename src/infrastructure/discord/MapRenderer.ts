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

export interface MapRenderOptions {
  tiles: TileData[];
  playerX: number;
  playerY: number;
  centerX: number;
  centerY: number;
  viewSize: number;
}

export function renderMapImage(options: MapRenderOptions): Buffer {
  const { tiles, playerX, playerY, centerX, centerY, viewSize } = options;

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
        drawFactionUnit(ctx, cx, cy, TILE_SIZE, FACTION_COLORS[tile.occupant_faction]);
      }
    }
  }

  // 3. UI & Borders
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
 * A stylized rock formation with crystalline gold jutting out.
 */
function drawNewGoldMine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const iconSize = s * 0.7;
    
    // 1. Hard Shadow Base
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + iconSize*0.35, iconSize*0.4, iconSize*0.15, 0, 0, Math.PI*2);
    ctx.fill();

    // 2. Rock Base (Dark Grey/Brown)
    ctx.fillStyle = '#544a4a';
    ctx.beginPath();
    ctx.moveTo(x - iconSize*0.4, y + iconSize*0.3);
    ctx.lineTo(x - iconSize*0.3, y - iconSize*0.1);
    ctx.lineTo(x + iconSize*0.2, y - iconSize*0.2);
    ctx.lineTo(x + iconSize*0.4, y + iconSize*0.2);
    ctx.closePath();
    ctx.fill();

    // 3. Gold Crystals (Sharp, bright polygons)
    ctx.fillStyle = '#ffd700'; // Bright Gold
    
    // Crystal 1 (Big left)
    ctx.beginPath();
    ctx.moveTo(x - iconSize*0.2, y + iconSize*0.1);
    ctx.lineTo(x - iconSize*0.1, y - iconSize*0.4);
    ctx.lineTo(x + iconSize*0.05, y + iconSize*0.1);
    ctx.fill();

    // Crystal 2 (Small right)
    ctx.fillStyle = '#ffecb3'; // Lighter gold facet
    ctx.beginPath();
    ctx.moveTo(x + iconSize*0.1, y + iconSize*0.1);
    ctx.lineTo(x + iconSize*0.25, y - iconSize*0.25);
    ctx.lineTo(x + iconSize*0.3, y + iconSize*0.15);
    ctx.fill();

    // Use stroke to define edges
    ctx.strokeStyle = '#c49a00'; // Dark gold outline
    ctx.lineWidth = 1.5;
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

function drawFactionUnit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Simple pawn shape on a baseplate
  const is = s * 0.6;
  // Base
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + is*0.4, is*0.4, is*0.15, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 5, s * 0.15, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath(); // Body
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 10, y + 12);
  ctx.lineTo(x - 10, y + 12);
  ctx.fill();
  // Outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
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