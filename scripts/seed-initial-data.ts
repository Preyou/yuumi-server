import { mysql, pg, sqlite } from '../src/db'

interface SeedPermission {
  isPublic: boolean
  method: string
  name: string
  path: string
  summary: string
  tags: string
}

interface SeedUser {
  age: number
  email: string
  name: string
  password: string
}

type DatabaseDialect = 'mysql' | 'postgresql' | 'sqlite'
type RawEnv = Record<string, string | undefined>
const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized ? normalized : undefined
}

function parseDialect(input: string | undefined): DatabaseDialect {
  const value = input?.toLowerCase()

  if (!value) {
    return 'sqlite'
  }

  if (value === 'mysql') {
    return 'mysql'
  }

  if (value === 'postgresql' || value === 'pg' || value === 'postgres') {
    return 'postgresql'
  }

  if (value === 'sqlite') {
    return 'sqlite'
  }

  throw new Error(`[seed] DIALECT must be mysql|postgresql|sqlite, got "${input}"`)
}

const DIALECT: DatabaseDialect = parseDialect(normalizeText(rawEnv.DIALECT))

const seedPermissions: SeedPermission[] = [
  {
    isPublic: true,
    method: 'POST',
    name: 'Auth Register',
    path: '/auth/register',
    summary: 'Public register endpoint',
    tags: 'auth,public',
  },
  {
    isPublic: true,
    method: 'POST',
    name: 'Auth Sign Email',
    path: '/auth/sign/email',
    summary: 'Public sign-in by email',
    tags: 'auth,public',
  },
  {
    isPublic: false,
    method: 'GET',
    name: 'Users Me',
    path: '/users/me',
    summary: 'Read current authenticated user',
    tags: 'users,profile',
  },
  {
    isPublic: false,
    method: 'GET',
    name: 'Users Detail',
    path: '/users/user/:id',
    summary: 'Read user detail by id',
    tags: 'users,profile',
  },
]

const seedUsers: SeedUser[] = [
  {
    age: 28,
    email: 'admin@example.com',
    name: 'Admin',
    password: 'ChangeMe_12345',
  },
  {
    age: 22,
    email: 'demo@example.com',
    name: 'Demo User',
    password: 'ChangeMe_12345',
  },
]

function normalizePermission(input: SeedPermission): SeedPermission {
  return {
    ...input,
    method: input.method.trim().toUpperCase(),
    path: input.path.trim(),
  }
}

async function seedPostgreSQL() {
  const permissionsTable = pg.schemas.tables.permissions
  const usersTable = pg.schemas.tables.users

  for (const row of seedPermissions.map(normalizePermission)) {
    await pg.db
      .insert(permissionsTable)
      .values(row)
      .onConflictDoUpdate({
        set: {
          isPublic: row.isPublic,
          method: row.method,
          name: row.name,
          summary: row.summary,
          tags: row.tags,
        },
        target: permissionsTable.path,
      })
  }

  for (const row of seedUsers) {
    const passwordHash = await Bun.password.hash(row.password)

    await pg.db
      .insert(usersTable)
      .values({
        age: row.age,
        email: row.email,
        name: row.name,
        password: passwordHash,
      })
      .onConflictDoNothing({
        target: usersTable.email,
      })
  }
}

async function seedMySQL() {
  const permissionsTable = mysql.schemas.tables.permissions
  const usersTable = mysql.schemas.tables.users

  for (const row of seedPermissions.map(normalizePermission)) {
    await mysql.db
      .insert(permissionsTable)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          isPublic: row.isPublic,
          method: row.method,
          name: row.name,
          summary: row.summary,
          tags: row.tags,
        },
      })
  }

  for (const row of seedUsers) {
    const passwordHash = await Bun.password.hash(row.password)

    await mysql.db
      .insert(usersTable)
      .values({
        age: row.age,
        email: row.email,
        name: row.name,
        password: passwordHash,
      })
      .onDuplicateKeyUpdate({
        set: {
          age: row.age,
          name: row.name,
        },
      })
  }
}

async function seedSQLite() {
  const permissionsTable = sqlite.schemas.tables.permissions
  const usersTable = sqlite.schemas.tables.users

  for (const row of seedPermissions.map(normalizePermission)) {
    await sqlite.db
      .insert(permissionsTable)
      .values(row)
      .onConflictDoUpdate({
        set: {
          isPublic: row.isPublic,
          method: row.method,
          name: row.name,
          summary: row.summary,
          tags: row.tags,
        },
        target: permissionsTable.path,
      })
  }

  for (const row of seedUsers) {
    const passwordHash = await Bun.password.hash(row.password)

    await sqlite.db
      .insert(usersTable)
      .values({
        age: row.age,
        email: row.email,
        name: row.name,
        password: passwordHash,
      })
      .onConflictDoUpdate({
        set: {
          age: row.age,
          name: row.name,
        },
        target: usersTable.email,
      })
  }
}

switch (DIALECT) {
  case 'mysql': {
    await seedMySQL()
    break
  }
  case 'postgresql': {
    await seedPostgreSQL()
    break
  }
  case 'sqlite': {
    await seedSQLite()
    break
  }
  default: {
    throw new Error(`Unsupported DIALECT: ${DIALECT}`)
  }
}

console.log(`[seed] done, dialect=${DIALECT}, permissions=${seedPermissions.length}, users=${seedUsers.length}`)
