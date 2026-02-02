import { Knex } from 'knex';
import { Item } from '../../../domain/entities/Item.js';
import { ItemData, ItemSlot } from '../../../shared/types/items.js';

export class ItemRepository {
  constructor(private db: Knex) {}

  async create(item: Item): Promise<Item> {
    const data = item.toData();
    const [row] = await this.db('hero_items')
      .insert({
        hero_id: data.heroId.toString(),
        slot: data.slot,
        rarity: data.rarity,
        level: data.level,
        primary_stat: JSON.stringify(data.primaryStat),
        secondary_stats: JSON.stringify(data.secondaryStats),
        equipped: data.equipped,
      })
      .returning('*');

    return this.mapToItem(row);
  }

  async findById(id: bigint): Promise<Item | null> {
    const row = await this.db('hero_items')
      .where('id', id.toString())
      .first();

    return row ? this.mapToItem(row) : null;
  }

  async findByHeroId(heroId: bigint): Promise<Item[]> {
    const rows = await this.db('hero_items')
      .where('hero_id', heroId.toString())
      .orderBy('slot');

    return rows.map(row => this.mapToItem(row));
  }

  async findEquippedByHeroId(heroId: bigint): Promise<Item[]> {
    const rows = await this.db('hero_items')
      .where('hero_id', heroId.toString())
      .where('equipped', true)
      .orderBy('slot');

    return rows.map(row => this.mapToItem(row));
  }

  async findByHeroIdAndSlot(heroId: bigint, slot: ItemSlot): Promise<Item[]> {
    const rows = await this.db('hero_items')
      .where('hero_id', heroId.toString())
      .where('slot', slot)
      .orderBy('level', 'desc');

    return rows.map(row => this.mapToItem(row));
  }

  async update(item: Item): Promise<void> {
    const data = item.toData();
    await this.db('hero_items')
      .where('id', data.id.toString())
      .update({
        level: data.level,
        equipped: data.equipped,
      });
  }

  async delete(id: bigint): Promise<void> {
    await this.db('hero_items')
      .where('id', id.toString())
      .delete();
  }

  async unequipSlot(heroId: bigint, slot: ItemSlot): Promise<void> {
    await this.db('hero_items')
      .where('hero_id', heroId.toString())
      .where('slot', slot)
      .update({ equipped: false });
  }

  private mapToItem(row: any): Item {
    const primaryStat = typeof row.primary_stat === 'string' 
      ? JSON.parse(row.primary_stat) 
      : row.primary_stat;
    
    const secondaryStats = typeof row.secondary_stats === 'string'
      ? JSON.parse(row.secondary_stats)
      : row.secondary_stats;

    const data: ItemData = {
      id: BigInt(row.id),
      heroId: BigInt(row.hero_id),
      slot: row.slot,
      rarity: row.rarity,
      level: row.level,
      primaryStat,
      secondaryStats,
      equipped: row.equipped,
      createdAt: new Date(row.created_at),
    };

    return new Item(data);
  }
}
