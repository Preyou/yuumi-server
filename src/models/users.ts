import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pg } from '@/db'

export const all = createSelectSchema(pg.schemas.tables.users, {
  age: z.number().min(0).max(200),
  email: z.string().email(),
})

export const insert = all.omit({
  createdAt: true,
  id: true,
  updatedAt: true,
})

export const update = insert.partial()

export const select = all.omit({
  password: true,
})

export type UserDTO = z.infer<typeof select>
