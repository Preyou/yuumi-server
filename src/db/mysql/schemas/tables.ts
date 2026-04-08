/* eslint-disable perfectionist/sort-objects */
import { sql } from 'drizzle-orm'
import { boolean, check, int, mysqlTable, text, timestamp, unique, varchar } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  age: int('age').notNull(),

  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .onUpdateNow(),

  password: varchar('password', { length: 255 }).notNull(),
}, table => [
  unique('users_email_unique').on(table.email),
  check('users_age_check', sql`${table.age} > 0 and ${table.age} < 200`),
])

export const permissions = mysqlTable('permissions', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  path: varchar('path', { length: 100 }).notNull(),
  method: varchar('method', { length: 16 }).notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  summary: text('summary'),
  tags: text('tags'),
  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .onUpdateNow(),
}, table => [
  unique('permissions_path_unique').on(table.path),
])
