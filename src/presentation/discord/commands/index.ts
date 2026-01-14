import type { Command } from '../../../infrastructure/discord/types.js';
import { beginCommand } from './begin.js';
import { helpCommand } from './help.js';
import { pingCommand } from './ping.js';
import { mapCommand } from './map.js';
import { cityCommand } from './city.js';
import { buildCommand } from './build.js';
import { trainCommand } from './train.js';
import { attackCommand } from './attack.js';
import { scoutCommand } from './scout.js';
import { heroesCommand } from './heroes.js';
import { dailyCommand } from './daily.js';
import { activityCommand } from './activity.js';
import { tutorialCommand } from './tutorial.js';
import { arenaCommand } from './arena.js';
import { landCommand } from './land.js';
import { guildCommand } from './guild.js';
import { rallyCommand } from './rally.js';
import { guildquestsCommand } from './guildquests.js';
import { researchCommand } from './research.js';
import { shopCommand } from './shop.js';
import { teleportCommand } from './teleport.js';
import { conquestCommand } from './conquest.js';
import { seasonCommand } from './season.js';
import { prestigeCommand } from './prestige.js';

export function loadCommands(): Command[] {
  return [
    beginCommand,
    helpCommand,
    pingCommand,
    mapCommand,
    cityCommand,
    buildCommand,
    trainCommand,
    attackCommand,
    scoutCommand,
    heroesCommand,
    dailyCommand,
    activityCommand,
    tutorialCommand,
    arenaCommand,
    landCommand,
    guildCommand,
    rallyCommand,
    guildquestsCommand,
    researchCommand,
    shopCommand,
    teleportCommand,
    conquestCommand,
    seasonCommand,
    prestigeCommand,
  ];
}
