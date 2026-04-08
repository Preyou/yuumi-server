import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import drizzleEnv from '@/drizzle-env'
import * as tables from './schemas/tables'

const client = new SQL(drizzleEnv.databaseUrl)
export default drizzle({
  client,
  schema: tables,
})
