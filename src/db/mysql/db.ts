import { drizzle } from 'drizzle-orm/mysql2'
import env from '@/env'
import * as tables from './schemas/tables'

export default drizzle(env.databaseUrl, {
  mode: 'default',
  schema: tables,
})
