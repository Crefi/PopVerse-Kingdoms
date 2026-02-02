# Implementation Plan: Resource Exchange & Shop Improvements

## Overview

Implement player-to-player resource trading, expand shop inventory, add dynamic pricing, and create guild resource banks.

## Tasks

- [ ] 1. Create player-to-player resource market
  - Implement market order creation (quantity, price, 48-hour expiration)
  - Hold listed resources in escrow
  - Transfer resources to buyer and payment to seller on purchase
  - Return unsold resources after expiration
  - Charge 5% cancellation fee for cancelled orders
  - Limit to 10 active orders per player

- [ ] 2. Set up exchange rates and price limits
  - Enforce min/max prices (50%-200% of base value)
  - Set base values: 100 Food = 1 Gold, 50 Iron = 1 Gold, 1,000 Gold = 1 Diamond
  - Validate prices when creating market orders

- [ ] 3. Implement market search and filtering
  - Display all active orders sorted by price (lowest first)
  - Add filters: resource type, price range, seller name
  - Show order details: seller, quantity, unit price, total price, time remaining

- [ ] 4. Expand shop inventory
  - Create shop categories: Resources, Speedups, Items, Materials, Special
  - Add resource bundles (Food, Iron, Gold) in various sizes
  - Add speedup items (5min to 24hr for building, research, training)
  - Add random item boxes by rarity (Common to Legendary)
  - Add crafting materials at premium prices


- [ ] 5. Implement dynamic shop pricing
  - Track resource supply/demand
  - Adjust prices: +50% high demand, -30% low demand
  - Add volume discounts: 5% for 10+ items, 10% for 50+ items
  - Create 3 daily deals at 25% discount (refresh daily)
  - Offer guild shop with exclusive items at reduced prices

- [ ] 6. Add shop purchase limits
  - Limit resource bundles to 5 per day per type
  - Limit speedups to 10 per day per type
  - Limit item boxes to 3 per day per rarity
  - Reset limits daily at 00:00 UTC


- [ ] 7. Create guild resource bank
  - Allow guild members to donate resources
  - Track individual contributions
  - Allow withdrawals up to contribution amount (with leader approval)
  - Display total resources, top contributors, withdrawal history
  - Apply 10% bonus on donations with guild perks
  - Prevent donations when bank reaches capacity

- [ ] 8. Implement trade history and analytics
  - Track all completed trades with dates, quantities, prices
  - Show market analytics: average prices, volume traded, price trends
  - Compare current market price vs shop price vs historical average
  - Allow CSV export of trade history
  - Add guild aggregate trading data

- [ ] 9. Create market and shop commands
  - `!market list [resource]` - View market orders
  - `!market sell [resource] [quantity] [price]` - List resources for sale
  - `!market buy [order_id]` - Purchase from market
  - `!market cancel [order_id]` - Cancel your order
  - `!shop [category]` - View shop inventory
  - `!buy [item] [quantity]` - Purchase from shop
  - `!guild bank` - View guild resource bank
  - `!guild donate [resource] [quantity]` - Donate to guild bank
