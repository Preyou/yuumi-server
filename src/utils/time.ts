import { z } from 'zod'

export const timestampMsSchema = z.number().int().nonnegative()
export const timestampMsToDateSchema = timestampMsSchema.transform(value => new Date(value))

export type TimestampMs = z.infer<typeof timestampMsSchema>

export function toTimestampMs(date: Date): TimestampMs {
  return date.getTime() as TimestampMs
}
