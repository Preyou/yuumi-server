import { drizzle } from 'drizzle-orm/mysql2'

export default drizzle(import.meta.env.DATABASE_URL)
