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
import { tutorialCommand } from './tutorial.js';

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
    tutorialCommand,
  ];
}
