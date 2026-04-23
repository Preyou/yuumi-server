import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { REALTIME_DOMAINS } from '@/constants/realtimeDomains'
import { globalPlugin } from '@/global'
import { userDTO } from '@/models'
import { responseDTO } from '@/plugins/formatResponse'

export const authService = new Elysia({
  name: 'service.auth',
})
  .use(globalPlugin)
  .group(
    '/auth',
    {
      body: userDTO.all.pick({
        password: true,
      }),
      detail: {
        tags: ['auth'],
      },
      useAuth: false,
    },
    app =>
      app
        .post(
          '/register',
          async ({ body, db, format }) => {
            const existingUsers = await db
              .select({
                id: db.tables.users.id,
              })
              .from(db.tables.users)
              .where(eq(db.tables.users.email, body.email))
              .limit(1)

            if (existingUsers[0]) {
              return format(null, 409)
            }

            await db.insert(db.tables.users).values(body)
            return format(true, 201)
          },
          {
            async beforeHandle({ body }) {
              body.password = await Bun.password.hash(body.password)
            },
            body: userDTO.insert,
            domains: [REALTIME_DOMAINS.USER_PROFILE],
            response: {
              201: responseDTO(z.boolean()),
              409: responseDTO(z.null()),
            },
          },
        )
        .group('/sign', app => app
          .post('/email', async ({ body, db, format, jwt }) => {
            const users = await db
              .select()
              .from(db.tables.users)
              .where(eq(db.tables.users.email, body.email))
              .limit(1)
            const user = users[0]
            if (!user) { return format(null, 400) }

            return await Bun.password.verify(body.password, user.password)
              ? format({
                  token: await jwt.sign({
                    id: user.id,
                  }),
                })
              : format(null, 401)
          }, {
            body: z.object({
              email: z.email(),
              password: z.string(),
            }),
            response: {
              200: responseDTO(z.object({
                token: z.string(),
              })),
              400: responseDTO(z.null()),
              401: responseDTO(z.null()),
            },
          })),
  )
