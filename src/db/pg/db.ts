import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as tables from './schemas/tables'

const client = new SQL(import.meta.env.DATABASE_URL)
export default drizzle({
  client,
  schema: tables,
})
