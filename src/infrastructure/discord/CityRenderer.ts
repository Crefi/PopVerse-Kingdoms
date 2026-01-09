import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import type { Faction, Resources } from '../../shared/types/index.js';

// --- CONFIGURATION ---
const CANVAS_SIZE = 600;
const CENTER = CANVAS_SIZE / 2;
// Layout Geometry
const ISLAND_RADIUS = 210;
const CLIFF_HEIGHT = 25;
const PLAZA_RADIUS = 70; // Central paved area
const ROAD_RADIUS = 125; // Where the ring road sits
const BUILDING_RADIUS = 165; // Where buildings sit surrounding the road

const PALETTE = {
  bg: '#1a1d24',
  grassTop: '#5a7c3e',
  grassEdge: '#4a6332',
  dirt: '#6b5847',
  dirtDark: '#4d3f33',
  // New road/plaza palette
  road: '#8b7355',
  roadBorder: '#6b5645',
  plaza: '#7a6b5d', 
  plazaBorder: '#5a4a3a',

  uiBg: 'rgba(26, 29, 36, 0.95)',
  text: '#e8e8e8',
  textDim: '#8a8a8a',
  accent: '#d4af37',
  buildingLabel: 'rgba(0, 0, 0, 0.75)',
};

const FACTION_COLORS: Record<Faction, string> = {
  cinema: '#8b3a3a',
  otaku:  '#2d5c3e',
  arcade: '#2b4c7e',
};

interface BuildingData {
  type: string;
  level: number;
  upgrading?: boolean;
}

interface TroopData {
  tier: number;
  count: number;
  wounded: number;
}

export interface CityRenderOptions {
  username: string;
  faction: Faction;
  hqLevel: number;
  buildings: BuildingData[];
  troops: TroopData[];
  resources: Resources;
  diamonds: number;
  power: number;
  isProtected: boolean;
}

export function renderCityImage(options: CityRenderOptions): Buffer {
  const { faction, hqLevel, buildings, troops, resources, diamonds, power, isProtected, username } = options;

  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');

  // 1. Background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 2. Base Island & Environment
  drawFloatingIsland(ctx);
  drawEnvironment(ctx);
  
  // 3. Infrastructure (Plaza & Roads) - Drawn BEFORE buildings
  drawCityInfrastructure(ctx);

  // 4. Buildings
  const outerBuildings = buildings.filter(b => b.type.toLowerCase() !== 'hq');
  // Draw perimeter buildings first (behind HQ)
  drawPerimeterBuildings(ctx, outerBuildings);
  // Draw HQ at center (on top of plaza)
  drawHQ(ctx, hqLevel, FACTION_COLORS[faction]);
  
  // 5. Units & Effects
  drawTroops(ctx, troops, FACTION_COLORS[faction]);
  if (isProtected) drawShield(ctx);

  // 6. UI
  drawUI(ctx, username, faction, resources, diamonds, power);

  // Border
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  return canvas.toBuffer('image/png');
}

// ================= DRAWING HELPERS =================

function drawFloatingIsland(ctx: CanvasRenderingContext2D) {
  const x = CENTER;
  const y = CENTER + 15;
  const r = ISLAND_RADIUS;

  // Cliff Layers
  ctx.fillStyle = PALETTE.dirtDark;
  ctx.beginPath(); ctx.arc(x, y + CLIFF_HEIGHT, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.dirt;
  ctx.beginPath(); ctx.arc(x, y + CLIFF_HEIGHT - 5, r, 0, Math.PI * 2); ctx.fill();

  // Grass Layers
  ctx.fillStyle = PALETTE.grassEdge;
  ctx.beginPath(); ctx.arc(x, y + 5, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.grassTop;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  // Inner Vignette for depth
  const grad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawEnvironment(ctx: CanvasRenderingContext2D) {
  // Simple grass texture
  for(let i=0; i<40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (ISLAND_RADIUS - 10);
    const x = CENTER + Math.cos(angle) * dist;
    const y = CENTER + 15 + Math.sin(angle) * dist;

    // Don't draw grass in the central plaza area
    if(dist < PLAZA_RADIUS + 5) continue;

    if (i % 2 === 0) {
        // Lighter grass blades
        ctx.fillStyle = '#6a8c5e';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
    } else {
        // Darker patches
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawCityInfrastructure(ctx: CanvasRenderingContext2D) {
    const cy = CENTER + 15; // Adjust for island perspective

    // 1. Central Plaza (Stone paved area for HQ)
    ctx.fillStyle = PALETTE.plazaBorder;
    ctx.beginPath(); ctx.arc(CENTER, cy, PLAZA_RADIUS + 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = PALETTE.plaza;
    ctx.beginPath(); ctx.arc(CENTER, cy, PLAZA_RADIUS, 0, Math.PI*2); ctx.fill();

    // Cobbweb pattern on plaza
    ctx.strokeStyle = PALETTE.plazaBorder;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CENTER, cy, PLAZA_RADIUS*0.6, 0, Math.PI*2); ctx.stroke();
    for(let i=0; i<8; i++) {
        const angle = i * (Math.PI*2)/8;
        ctx.beginPath();
        ctx.moveTo(CENTER, cy);
        ctx.lineTo(CENTER + Math.cos(angle)*PLAZA_RADIUS, cy + Math.sin(angle)*PLAZA_RADIUS);
        ctx.stroke();
    }

    // 2. Ring Road (Circular road separating HQ from other buildings)
    ctx.strokeStyle = PALETTE.roadBorder;
    ctx.lineWidth = 22;
    ctx.beginPath(); ctx.arc(CENTER, cy, ROAD_RADIUS, 0, Math.PI*2); ctx.stroke();
    
    ctx.strokeStyle = PALETTE.road;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(CENTER, cy, ROAD_RADIUS, 0, Math.PI*2); ctx.stroke();

    // 3. Connector Roads (Small spokes connecting plaza to ring road)
    for(let i=0; i<4; i++) {
        const angle = i * Math.PI/2; // 4 cardinal directions
        ctx.lineCap = 'butt';
        // Border
        ctx.strokeStyle = PALETTE.roadBorder;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(CENTER + Math.cos(angle)*(PLAZA_RADIUS-2), cy + Math.sin(angle)*(PLAZA_RADIUS-2));
        ctx.lineTo(CENTER + Math.cos(angle)*(ROAD_RADIUS+2), cy + Math.sin(angle)*(ROAD_RADIUS+2));
        ctx.stroke();
        // Pavement
        ctx.strokeStyle = PALETTE.road;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(CENTER + Math.cos(angle)*PLAZA_RADIUS, cy + Math.sin(angle)*PLAZA_RADIUS);
        ctx.lineTo(CENTER + Math.cos(angle)*ROAD_RADIUS, cy + Math.sin(angle)*ROAD_RADIUS);
        ctx.stroke();
    }
}


function drawPerimeterBuildings(ctx: CanvasRenderingContext2D, buildings: BuildingData[]) {
  const count = buildings.length;
  const startAngle = -Math.PI / 2; // Start top

  buildings.forEach((b, i) => {
    // Distribute evenly around the BUILDING_RADIUS circle
    const angle = startAngle + (i * (Math.PI * 2) / count);
    const x = CENTER + Math.cos(angle) * BUILDING_RADIUS;
    const y = CENTER + 15 + Math.sin(angle) * BUILDING_RADIUS;

    drawBuildingSprite(ctx, x, y, b);
  });
}

function drawBuildingSprite(ctx: CanvasRenderingContext2D, x: number, y: number, b: BuildingData) {
  // REMOVED: The generic elliptical shadow bubble.
  // The buildings now rely on their own darker base colors to look grounded.

  switch(b.type.toLowerCase()) {
    case 'farm': drawFarm(ctx, x, y); break;
    case 'mine': drawMine(ctx, x, y); break;
    case 'barracks': drawBarracks(ctx, x, y); break;
    case 'vault': drawVault(ctx, x, y); break;
    case 'academy': drawAcademy(ctx, x, y); break;
    default: drawGenericHouse(ctx, x, y, b.type); break;
  }

  // Draw pill and label slightly lower to clear the building art
  drawLevelPill(ctx, x + 20, y - 30, b.level, b.upgrading);
  drawBuildingLabel(ctx, x, y + 35, getBuildingName(b.type));
}

// ================= BUILDING DESIGNS (Unchanged, they look good) =================

function drawHQ(ctx: CanvasRenderingContext2D, level: number, color: string) {
  const x = CENTER;
  const y = CENTER - 5; // Centered on plaza

  // REMOVED: Generic shadow bubble.

  // Base Keep (Stone)
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(x - 35, y, 70, 25);
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(x - 32, y - 20, 64, 25);
  for(let i = 0; i < 6; i++) {
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(x - 28 + i * 11, y - 16, 6, 12);
  }
  ctx.fillStyle = '#909090';
  ctx.fillRect(x - 22, y - 50, 44, 30);
  for(let i = 0; i < 4; i++) {
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(x - 18 + i * 12, y - 46, 6, 14);
  }
  
  // Roofs
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 20); ctx.lineTo(x, y - 40); ctx.lineTo(x + 40, y - 20); ctx.closePath(); ctx.fill();
  const darkerColor = adjustBrightness(color, -0.2);
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(x, y - 40); ctx.lineTo(x + 40, y - 20); ctx.lineTo(x + 40, y - 17); ctx.lineTo(x, y - 37); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 28, y - 50); ctx.lineTo(x, y - 75); ctx.lineTo(x + 28, y - 50); ctx.closePath(); ctx.fill();
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(x, y - 75); ctx.lineTo(x + 28, y - 50); ctx.lineTo(x + 28, y - 47); ctx.lineTo(x, y - 72); ctx.closePath(); ctx.fill();
  
  // Door
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath(); ctx.arc(x, y + 25, 14, Math.PI, 0); ctx.fill();
  
  drawLevelPill(ctx, x + 35, y - 65, level);
}

function drawFarm(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#7a6b5d'; ctx.fillRect(x - 25, y + 5, 50, 10);
  ctx.fillStyle = '#8b6f47'; ctx.fillRect(x - 22, y - 15, 44, 30);
  ctx.strokeStyle = '#6b5537'; ctx.lineWidth = 1;
  for(let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 22 + i * 11, y - 15); ctx.lineTo(x - 22 + i * 11, y + 15); ctx.stroke(); }
  ctx.fillStyle = '#8b4545'; ctx.beginPath(); ctx.moveTo(x - 28, y - 15); ctx.lineTo(x, y - 35); ctx.lineTo(x + 28, y - 15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b3535'; ctx.beginPath(); ctx.moveTo(x, y - 35); ctx.lineTo(x + 28, y - 15); ctx.lineTo(x + 28, y - 12); ctx.lineTo(x, y - 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a3f35'; ctx.fillRect(x - 10, y + 5, 20, 20);
  ctx.strokeStyle = '#3a2f25'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y + 5, 20, 20);
  ctx.fillStyle = '#d4a76a'; ctx.fillRect(x + 25, y + 10, 12, 10); ctx.fillRect(x - 37, y + 10, 12, 10);
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.moveTo(x - 30, y + 25); ctx.lineTo(x - 15, y - 10); ctx.lineTo(x + 5, y + 5); ctx.lineTo(x + 30, y + 25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#787878'; ctx.beginPath(); ctx.moveTo(x - 15, y - 10); ctx.lineTo(x + 5, y - 20); ctx.lineTo(x + 20, y + 5); ctx.lineTo(x + 5, y + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 2, y + 5, 18, 20);
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + 14, y + 7); ctx.lineTo(x + 14, y + 25); ctx.lineTo(x, y + 25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 25); ctx.moveTo(x + 16, y + 5); ctx.lineTo(x + 16, y + 25); ctx.stroke();
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 20, y + 18, 14, 8);
  ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x - 16, y + 26, 3, 0, Math.PI*2); ctx.arc(x - 10, y + 26, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c9a961'; ctx.beginPath(); ctx.arc(x + 22, y + 15, 4, 0, Math.PI*2); ctx.arc(x - 8, y + 8, 3, 0, Math.PI*2); ctx.fill();
}

function drawBarracks(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#6b6b6b'; ctx.fillRect(x - 28, y + 10, 56, 15);
  ctx.fillStyle = '#8a8a8a'; ctx.fillRect(x - 25, y - 15, 50, 25);
  ctx.strokeStyle = '#5a5a5a'; ctx.lineWidth = 1; for(let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 25, y - 15 + i * 8); ctx.lineTo(x + 25, y - 15 + i * 8); ctx.stroke(); }
  for(let i = 0; i < 5; i++) { if(i % 2 === 0) { ctx.fillStyle = '#7a7a7a'; ctx.fillRect(x - 25 + i * 12.5, y - 20, 10, 5); }}
  ctx.fillStyle = '#5a4530'; ctx.fillRect(x - 12, y + 2, 24, 23);
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, y + 10); ctx.lineTo(x + 12, y + 10); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 25); ctx.stroke();
  ctx.fillStyle = '#d4a76a'; ctx.fillRect(x - 32, y + 15, 4, 10); ctx.fillRect(x + 28, y + 15, 4, 10);
  ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 40); ctx.stroke();
  ctx.fillStyle = '#a04040'; ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + 15, y - 35); ctx.lineTo(x + 15, y - 25); ctx.lineTo(x, y - 30); ctx.closePath(); ctx.fill();
}

function drawVault(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x - 28, y + 15, 56, 10);
  ctx.fillStyle = '#6b6b6b'; ctx.fillRect(x - 25, y - 15, 50, 30);
  ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 1; for(let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 25, y - 15 + i * 6); ctx.lineTo(x + 25, y - 15 + i * 6); ctx.stroke(); } for(let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - 25 + i * 7, y - 15); ctx.lineTo(x - 25 + i * 7, y + 15); ctx.stroke(); }
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 15, y - 5, 30, 25);
  ctx.fillStyle = '#c9a961'; ctx.beginPath(); ctx.arc(x, y + 7, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#b8935d'; ctx.beginPath(); ctx.arc(x, y + 7, 8, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 7, 5, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x - 2, y - 10, 4, 8);
}

function drawAcademy(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#7a6b5d'; ctx.fillRect(x - 28, y + 15, 56, 10);
  ctx.fillStyle = '#c9b8a0'; ctx.fillRect(x - 25, y - 10, 50, 25);
  for(let i = 0; i < 4; i++) { ctx.fillStyle = '#4a6a8a'; ctx.fillRect(x - 20 + i * 13, y - 5, 8, 18); }
  ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.moveTo(x - 30, y - 10); ctx.lineTo(x, y - 30); ctx.lineTo(x + 30, y - 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x + 30, y - 10); ctx.lineTo(x + 30, y - 7); ctx.lineTo(x, y - 27); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4530'; ctx.fillRect(x - 8, y + 5, 16, 20);
}

function drawGenericHouse(ctx: CanvasRenderingContext2D, x: number, y: number, _type: string) {
  ctx.fillStyle = '#9a8a7a'; ctx.fillRect(x - 20, y - 10, 40, 30);
  ctx.fillStyle = '#6a5545'; ctx.beginPath(); ctx.moveTo(x - 25, y - 10); ctx.lineTo(x, y - 28); ctx.lineTo(x + 25, y - 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4a35'; ctx.fillRect(x - 10, y + 5, 20, 15);
}

// ================= UTILS & UI =================

function getBuildingName(type: string): string {
  const names: Record<string, string> = { farm: 'Farm', mine: 'Mine', barracks: 'Barracks', vault: 'Vault', academy: 'Academy', hospital: 'Hospital' };
  return names[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
}

function drawBuildingLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = '11px Arial';
  const width = ctx.measureText(text).width + 12;
  ctx.fillStyle = PALETTE.buildingLabel;
  ctx.beginPath(); ctx.roundRect(x - width/2, y - 8, width, 16, 3); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
}

function drawLevelPill(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, upgrading?: boolean) {
  ctx.fillStyle = upgrading ? '#d4af37' : 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath(); ctx.roundRect(x - 10, y - 8, 20, 16, 8); ctx.fill();
  ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(upgrading ? '⚙' : `${level}`, x, y);
}

function drawTroops(ctx: CanvasRenderingContext2D, troops: TroopData[], color: string) {
  const count = troops.reduce((a,b) => a+b.count, 0);
  if (count === 0) return;
  // Place troops on the Ring Road near the bottom
  for(let i=0; i<3; i++) {
    const tx = CENTER - 20 + (i*20);
    const ty = CENTER + ROAD_RADIUS + 15 + (i%2)*5;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(tx, ty - 12); ctx.lineTo(tx + 6, ty); ctx.lineTo(tx - 6, ty); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d4b896'; ctx.beginPath(); ctx.arc(tx, ty - 14, 5, 0, Math.PI*2); ctx.fill();
  }
}

function drawShield(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#5a8abf'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.shadowColor = '#5a8abf'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(CENTER, CENTER + 15, ISLAND_RADIUS + 10, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.shadowBlur = 0;
}

function drawUI(ctx: CanvasRenderingContext2D, name: string, faction: Faction, res: Resources, diamonds: number, power: number) {
  const barH = 50;
  ctx.fillStyle = PALETTE.uiBg; ctx.fillRect(0, 0, CANVAS_SIZE, barH);
  const items = [
    { l: 'FOOD', v: res.food, c: '#7a9a6a' }, { l: 'IRON', v: res.iron, c: '#9a9a9a' },
    { l: 'GOLD', v: res.gold, c: '#d4af37' }, { l: 'DIAMONDS', v: diamonds, c: '#5a8abf' }
  ];
  const w = CANVAS_SIZE / 4;
  items.forEach((item, i) => {
    const x = i * w + (w/2);
    ctx.fillStyle = item.c; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText(item.l, x, 18);
    ctx.fillStyle = PALETTE.text; ctx.font = 'bold 14px Arial'; ctx.fillText(formatNumber(item.v), x, 35);
  });

  const bottomY = CANVAS_SIZE - 60;
  ctx.fillStyle = PALETTE.uiBg; ctx.fillRect(0, bottomY, CANVAS_SIZE, 60);
  ctx.fillStyle = FACTION_COLORS[faction]; ctx.beginPath(); ctx.arc(40, bottomY + 30, 22, 0, Math.PI*2); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = PALETTE.text; ctx.font = 'bold 18px Arial'; ctx.fillText(name, 75, bottomY + 25);
  ctx.fillStyle = PALETTE.textDim; ctx.font = '12px Arial'; ctx.fillText(`${faction.toUpperCase()} Faction`, 75, bottomY + 42);
  ctx.textAlign = 'right'; ctx.fillStyle = '#a04040'; ctx.font = 'bold 20px Arial'; ctx.fillText(`⚔ ${formatNumber(power)}`, CANVAS_SIZE - 30, bottomY + 38);
}

function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace("#",""), 16);
  const amt = Math.round(2.55 * percent * 100);
  const R = (num >> 16) + amt; const G = (num >> 8 & 0x00FF) + amt; const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}