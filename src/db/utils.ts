import type { Table } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

type ZodObjectSchema = z.ZodObject<Record<string, z.ZodTypeAny>>
type SchemaSource = ZodObjectSchema | Table

function isZodObjectSchema(schema: SchemaSource): schema is ZodObjectSchema {
  return schema instanceof z.ZodObject
}

/**
 * Spread a Zod schema or Drizzle table schema into a plain shape object.
 */
export function spread(schema: SchemaSource, mode?: 'select' | 'insert') {
  if (isZodObjectSchema(schema))
    return schema.shape

  const zodSchema = mode === 'insert'
    ? createInsertSchema(schema)
    : createSelectSchema(schema)

  return zodSchema.shape
}

/**
 * Spread a map of Zod schemas or Drizzle tables into plain shape objects.
 */
export function spreads(
  models: Record<string, SchemaSource>,
  mode?: 'select' | 'insert',
) {
  const newSchema: Record<string, unknown> = {}
  const keys = Object.keys(models)

  for (const key of keys)
    newSchema[key] = spread(models[key], mode)

  return newSchema
}
