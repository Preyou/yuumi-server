import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { REALTIME_DOMAINS } from '@/constants/realtimeDomains'
import { userDTO } from '@/models'
import { responseDTO } from '@/plugins/formatResponse'
import { globalPlugin } from '@/global'

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
        .get('/user/:id', async ({ db, format, params }) => {
          const users = await db
            .select()
            .from(db.tables.users)
            .where(eq(db.tables.users.id, params.id))
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
        .get('/me', async ({ auth, db, format }) => {
          const users = await db
            .select()
            .from(db.tables.users)
            .where(eq(db.tables.users.id, auth.id))
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
