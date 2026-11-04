import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';

export const progress = pgTable('player_progress', {
  userId: text('user_id').primaryKey(),
  state: jsonb('state').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
