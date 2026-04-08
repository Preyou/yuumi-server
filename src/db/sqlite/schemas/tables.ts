/* eslint-disable perfectionist/sort-objects */
import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age').notNull(),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .defaultNow(),

  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .defaultNow(),

  password: text('password').notNull(),
}, table => [
  unique('users_email_unique').on(table.email),
  check('users_age_check', sql`${table.age} > 0 and ${table.age} < 200`),
])

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  method: text('method').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  summary: text('summary'),
  tags: text('tags'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .defaultNow(),
}, table => [
  unique('permissions_path_unique').on(table.path),
])
