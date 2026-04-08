import { z } from 'zod'

export const all = z.object({
  createdAt: z.date(),
  id: z.number().int().positive(),
  isPublic: z.boolean(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  name: z.string().min(1).max(255),
  path: z.string().min(1).max(100),
  summary: z.string().nullable(),
  tags: z.string().nullable(),
  updatedAt: z.date(),
})

export const insert = all.omit({
  createdAt: true,
  id: true,
  updatedAt: true,
})

export const update = insert.partial()

export const select = all

export type PermissionDTO = z.infer<typeof select>
