import { z } from 'zod'
import { timestampMsSchema, toTimestampMs } from '@/utils/time'

export const all = z.object({
  age: z.number().int().min(0).max(200),
  createdAt: z.date(),
  email: z.email(),
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  updatedAt: z.date(),
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

export function toUserApi(user: Pick<UserDTO, 'age' | 'createdAt' | 'email' | 'id' | 'name' | 'updatedAt'>): UserApiDTO {
  return {
    age: user.age,
    createdAt: toTimestampMs(user.createdAt),
    email: user.email,
    id: user.id,
    name: user.name,
    updatedAt: toTimestampMs(user.updatedAt),
  }
}
