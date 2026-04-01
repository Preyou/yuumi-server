import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { serverConfig } from '@/config/env'
import { userDTO } from '@/models'

export default new Elysia({
  name: 'jwt-plugin',
})
  .decorate('authSchema', userDTO.select.pick({
    id: true,
  }))
  .use(jwt({
    alg: 'HS256',
    exp: '15m',
    name: 'jwt',
    schema: userDTO.select.pick({
      id: true,
    }) as any,
    secret: serverConfig.JWT_SECRET,
  }))
  .macro({
    useAuth: (enabled: boolean = true) => {
      if (!enabled)
        return {}

      return {
        headers: z.object({
          authorization: z.string().regex(/^Bearer\s.+/),
        }),
        async resolve({ authSchema, headers, jwt }) {
          const token = headers.authorization?.startsWith('Bearer ')
            ? headers.authorization.slice(7)
            : undefined

          const auth = await jwt.verify(token)
          const parsedAuth = authSchema.safeParse(auth)

          if (!token || !parsedAuth.success) {
            throw new Error('unauthorized')
          }

          return {
            auth: parsedAuth.data,
            token,
          }
        },
      }
    },
  })
  .guard({
    useAuth: true,
  })
  .as('scoped')
