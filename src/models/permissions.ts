import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pg } from '@/db'

export const all = createSelectSchema(pg.schemas.tables.permissions)

export const insert = all.omit({
  createdAt: true,
  id: true,
  updatedAt: true,
})

export const update = insert.partial()

export const select = all

export type PermissionDTO = z.infer<typeof select>
