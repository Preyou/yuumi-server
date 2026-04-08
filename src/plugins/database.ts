import { Elysia } from 'elysia'

export interface DrizzleDatabaseModule<
  TDb extends object = object,
  TTables extends Record<string, unknown> = Record<string, unknown>,
> {
  db: TDb
  schemas: {
    tables: TTables
  }
}

export type DatabaseClient<TDatabase extends DrizzleDatabaseModule = DrizzleDatabaseModule> = TDatabase['db'] & {
  tables: TDatabase['schemas']['tables']
}

export function createDatabasePlugin<TDatabase extends DrizzleDatabaseModule>(database: TDatabase) {
  const dbClient = Object.assign(database.db, {
    tables: database.schemas.tables,
  }) as DatabaseClient<TDatabase>

  return new Elysia({
    name: 'database-plugin',
  })
    .decorate('db', dbClient)
    .as('scoped')
}
