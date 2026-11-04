import { pgTable, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const progress = pgTable('player_progress', {
  userId: text('user_id').primaryKey(),
  state: jsonb('state').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Goals that players published for everyone. user_id is only used to let the author withdraw it; it is never returned.
export const sharedGoals = pgTable('shared_goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  quests: jsonb('quests').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('shared_goals_user_id_idx').on(t.userId)]);
