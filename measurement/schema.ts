import {sqliteTable,text,integer,primaryKey,check} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const usageDaily=sqliteTable('usage_daily',{day:text('day').notNull(),event:text('event').notNull(),count:integer('count').notNull()},t=>[primaryKey({columns:[t.day,t.event]}),check('usage_event',sql`${t.event} in ('landing','start','complete')`),check('usage_count',sql`${t.count} between 0 and 10000`)]);
