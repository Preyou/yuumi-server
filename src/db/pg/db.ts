import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { serverConfig } from '@/config/env'
import * as tables from './schemas/tables'

const client = new SQL(serverConfig.DATABASE_URL)
export default drizzle({
  client,
  schema: tables,
})
