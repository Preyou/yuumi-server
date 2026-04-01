import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { pg } from '@/db'
import { userDTO } from '@/models'
import { responseDTO } from '@/plugins/formatResponse'
import { globalPlugin } from '@/plugins/global'

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
          async ({ body, format }) => {
            await pg.db.insert(pg.schemas.tables.users).values(body)
            return format(true, 201)
          },
          {
            async beforeHandle({ body }) {
              body.password = await Bun.password.hash(body.password)
            },
            body: userDTO.insert,
            response: {
              201: responseDTO(z.boolean()),
            },
          },
        )
        .group('/sign', app => app
          .post('/email', async ({ body, format, jwt }) => {
            const users = await pg.db
              .select()
              .from(pg.schemas.tables.users)
              .where(eq(pg.schemas.tables.users.email, body.email))
              .limit(1)

            const user = users[0]
            if (!user) { return format(null, 400) }

            return await Bun.password.verify(body.password, user.password)
              ? format({
                  token: await jwt.sign({
                    id: user.id,
                  } as any),
                })
              : format(null, 401)
          }, {
            body: z.object({
              email: z.string().email(),
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
