import { drizzle } from 'drizzle-orm/mysql2'
import drizzleEnv from '@/drizzle-env'
import * as tables from './schemas/tables'

export default drizzle(drizzleEnv.databaseUrl, {
  mode: 'default',
  schema: tables,
})
