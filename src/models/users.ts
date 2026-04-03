import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pg } from '@/db'
import { timestampMsSchema, toTimestampMs } from '@/utils/time'

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

export const selectApi = select.extend({
  createdAt: timestampMsSchema,
  updatedAt: timestampMsSchema,
})

export type UserDTO = z.infer<typeof select>
export type UserApiDTO = z.infer<typeof selectApi>

export function toUserApi(user: UserDTO): UserApiDTO {
  return {
    ...user,
    createdAt: toTimestampMs(user.createdAt),
    updatedAt: toTimestampMs(user.updatedAt),
  }
}
