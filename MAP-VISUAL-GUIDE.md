# Map Visual Guide

## What You'll See on the Map

### Terrain Types

| Icon | Terrain | Description |
|------|---------|-------------|
| 🟩 | Plains | Basic terrain, safe for building |
| 🌲 | Forest | Provides wood, slows movement |
| ⛰️ | Mountain | Impassable, forms natural borders |
| 💎 | Resource | Gold mines with wooden supports and cart tracks |

### Units & Structures

| Icon | Type | Description |
|------|------|-------------|
| 🏰 | Player HQ | Your fortified keep with faction flag |
| 👹 | Monster/NPC | Horned creature with red danger zone |
| 🛡️ | Other Player | Faction-specific unit design |
| 🏛️ | Control Point | Ancient war temple (conquest events only) |

### Land Parcels

Land parcels have colored borders:

| Color | Type | Bonus |
|-------|------|-------|
| 🟢 Green | Farm | +15% food production |
| ⚪ Grey | Mine | +15% iron production |
| 🟡 Yellow | Gold Mine | +20% gold production |
| 🟣 Purple | Fort | +10% defense |

**Border Style:**
- Solid border = Owned (by player or guild)
- Dashed border = Available for purchase

### Conquest Control Points

During conquest events, you'll see 5 control points as ancient temples:

**Neutral (Uncaptured):**
- Grey stone temple
- No faction flag
- Point ID badge (1-5)

**Captured:**
- Colored roof matching faction:
  - 🔴 Red = Cinema
  - 🟢 Green = Otaku
  - 🔵 Blue = Arcade
- Faction flag on top
- Glowing aura effect

## Map Zones

The map is divided into 3 zones (from center outward):

### 🏛️ Temple Zone (Center)
- **Radius:** 0-15 tiles from center (50, 50)
- **NPCs:** Strongest (Dragon Lairs, high-level camps)
- **Resources:** 15-25% resource tiles
- **Difficulty:** Endgame content
- **Lands:** Gold mines, strategic forts

### 💎 Resource Zone (Middle Ring)
- **Radius:** 15-30 tiles from center
- **NPCs:** Medium strength (mixed types)
- **Resources:** 25-30% resource tiles (highest density)
- **Difficulty:** Mid-game content
- **Lands:** All types, higher concentration

### 🛡️ Spawn Zone (Outer Ring)
- **Radius:** 30-70 tiles from center
- **NPCs:** Weakest (Bandit camps, low-level goblins)
- **Resources:** 10-15% resource tiles
- **Difficulty:** Beginner-friendly
- **Lands:** Farms, basic mines, forts

### ⛰️ Mountain Border
- **Location:** Map edges (tiles 0-4 from edge)
- **Purpose:** Natural barrier, prevents edge camping
- **Impassable:** Cannot build or move through

## Reading the Map

### Coordinate System
- **X-axis:** Horizontal (left to right)
- **Y-axis:** Vertical (top to bottom)
- **Origin:** Top-left corner (0, 0)
- **Center:** (50, 50)
- **Max:** (99, 99)

### Map Commands

```
/map                    # View map centered on your position
/map x:50 y:50         # View specific coordinates
/map zoom:15           # Adjust zoom level (10-30)
```

### What the Colors Mean

**Terrain Colors:**
- Light green = Plains (safe)
- Dark green = Forest (wood resource)
- Grey = Mountain (impassable)
- Yellow/Orange = Resource node (gold mine)

**Unit Colors:**
- Red = Cinema faction
- Green = Otaku faction
- Blue = Arcade faction
- Purple = Neutral/NPC

## Map Features by View Size

### Zoomed Out (30 tiles)
- See overall zone layout
- Identify resource clusters
- Spot control points
- Plan long-distance moves

### Standard View (15 tiles)
- Default view
- Good balance of detail and overview
- See nearby threats and resources

### Zoomed In (10 tiles)
- Maximum detail
- See all land parcel borders
- Identify specific NPCs
- Tactical positioning

## Tips for Reading the Map

1. **Find Resources:** Look for yellow/orange mine entrances
2. **Avoid Danger:** Red danger zones indicate strong NPCs
3. **Claim Lands:** Dashed borders = available for purchase
4. **Check Zones:** Distance from center (50,50) determines difficulty
5. **Conquest Events:** Look for temple icons during events
6. **Scout First:** Use `/scout x:X y:Y` before attacking
7. **Plan Routes:** Mountains block movement, plan around them

## Map Legend Summary

```
🟩 Plains          🏰 Your HQ         🟢 Farm (owned)
🌲 Forest          👹 Monster         ⚪ Mine (owned)
⛰️ Mountain         🛡️ Player          🟡 Gold Mine (owned)
💎 Resource        🏛️ Control Point   🟣 Fort (owned)
```

## Common Map Patterns

### Resource Clusters
Resources appear in natural-looking clusters due to smooth noise algorithm. Look for groups of 3-5 resource tiles together.

### NPC Camps
NPCs spawn in clearings (plains/forest). Stronger NPCs appear closer to center.

### Land Parcels
Land parcels are rectangular areas (2x2 to 5x5 tiles) with colored borders. They don't overlap.

### Control Points
During conquest events, 5 temples spawn in strategic locations across the map. They're evenly distributed across zones.

## Map Updates

The map image is cached for 5 minutes. If you don't see recent changes:

```bash
# Clear cache (admin/dev only)
npx tsx scripts/clear-cache.ts
```

Or wait 5 minutes and use `/map` again.

## Troubleshooting

**Map shows all green tiles:**
- Map data is missing or corrupted
- Run: `npm run db:seed:dev`
- Then: `npx tsx scripts/clear-cache.ts`

**Control points not showing:**
- No active conquest event
- Start one with: `/conquest start duration:60` (admin only)

**Resources all in center:**
- Old map generation algorithm
- Regenerate: `npx tsx scripts/regenerate-map.ts`

**Map won't load:**
- Check bot logs for errors
- Verify Docker containers are running
- Check Redis connection
