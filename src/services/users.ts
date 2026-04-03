import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { REALTIME_DOMAINS } from '@/constants/realtimeDomains'
import { pg } from '@/db'
import { userDTO } from '@/models'
import { responseDTO } from '@/plugins/formatResponse'
import { globalPlugin } from '@/plugins/global'

const userPublicColumns = {
  age: pg.schemas.tables.users.age,
  createdAt: pg.schemas.tables.users.createdAt,
  email: pg.schemas.tables.users.email,
  id: pg.schemas.tables.users.id,
  name: pg.schemas.tables.users.name,
  updatedAt: pg.schemas.tables.users.updatedAt,
}

export const usersService = new Elysia({
  name: 'service.users',
})
  .use(globalPlugin)
  .group(
    '/users',
    {
      detail: {
        tags: ['users'],
      },
      useAuth: true,
    },
    app =>
      app
        .get('/user/:id', async ({ format, params }) => {
          const users = await pg.db
            .select(userPublicColumns)
            .from(pg.schemas.tables.users)
            .where(eq(pg.schemas.tables.users.id, params.id))
            .limit(1)

          const user = users[0]

          if (!user) {
            return format(null, 404)
          }

          return format(userDTO.toUserApi(user))
        }, {
          domains: [REALTIME_DOMAINS.USER_PROFILE],
          params: z.object({
            id: z.coerce.number().int(),
          }),
          response: {
            200: responseDTO(userDTO.selectApi),
            404: responseDTO(z.null()),
          },
        })
        .get('/me', async ({ auth, format }) => {
          const users = await pg.db
            .select(userPublicColumns)
            .from(pg.schemas.tables.users)
            .where(eq(pg.schemas.tables.users.id, auth.id))
            .limit(1)

          const user = users[0]

          if (!user) { return format(null, 404) }

          return format(userDTO.toUserApi(user))
        }, {
          domains: [REALTIME_DOMAINS.USER_PROFILE],
          response: {
            200: responseDTO(userDTO.selectApi),
            404: responseDTO(z.null()),
          },
        }),
  )
