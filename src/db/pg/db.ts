import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import env from '@/env'
import * as tables from './schemas/tables'

const client = new SQL(env.databaseUrl)
export default drizzle({
  client,
  schema: tables,
})
