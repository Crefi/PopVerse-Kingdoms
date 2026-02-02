# Implementation Plan: Auto-Collect Resources

## Overview

Implement automatic resource collection from production buildings with collection caps, offline limits, notifications, and smart prioritization.

## Tasks

- [ ] 1. Implement automatic resource collection
  - Auto-add resources from production buildings to player storage
  - Respect vault capacity limits
  - Stop auto-collection when vault is full
  - Resume auto-collection when vault space becomes available
  - Log all collections in activity history

- [ ] 2. Set up collection caps and offline limits
  - Accumulate resources up to 12 hours of production while offline
  - Stop generating resources after 12-hour cap until player logs in
  - Extend offline cap to 24 hours for VIP players
  - Display total resources collected during absence on login
  - Prioritize auto-collection up to vault capacity

- [ ] 3. Create collection notification system
  - Send warning notification at 80% vault capacity
  - Send urgent notification at 100% vault capacity
  - Send notification when offline cap is reached
  - Display collection summary on login after extended absence
  - Respect player notification preferences

- [ ] 4. Apply collection bonuses and multipliers
  - Apply Resource Production research bonuses to auto-collection
  - Apply guild Resource Boost perk to auto-collection
  - Apply VIP production bonuses to auto-collection
  - Stack bonuses multiplicatively
  - Display which bonuses were applied during collection

- [ ] 5. Implement manual collection override
  - Display current uncollected resources in city view
  - Add manual collect buttons for immediate gathering
  - Apply same bonuses as auto-collection
  - Allow disabling auto-collection in settings
  - Accumulate resources without automatic transfer when disabled

- [ ] 6. Create collection history and analytics
  - Display daily, weekly, and monthly collection totals
  - Show per-building production rates
  - Display production trends and changes over time
  - Show percentage of time at vault capacity (efficiency metric)
  - Add guild aggregate production statistics

- [ ] 7. Implement smart collection prioritization
  - Allow players to set resource collection priorities
  - Default to proportional collection when no priority set
  - Adjust collection behavior based on priorities when vault space limited
  - Immediately apply priority changes
  - Resume collecting all types when vault space available

- [ ] 8. Integrate with offline protection
  - Place auto-collected resources in protected storage during shield
  - Move excess to vulnerable storage when shield expires
  - Respect 50% vault protection rule
  - Only allow raiding from vulnerable storage
  - Update resource distribution immediately on protection changes

- [ ] 9. Add resource collection commands
  - `!collect` - Manually collect all pending resources
  - `!resources history` - View collection history
  - `!resources stats` - View production analytics
  - `!resources priority [food|iron|gold]` - Set collection priority
  - `!settings autocollect [on|off]` - Toggle auto-collection
