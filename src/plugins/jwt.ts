import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { z } from 'zod'
import env from '@/env'
import { userDTO } from '@/models'
import { ResponseCodeError, responseDTO } from './formatResponse'

const jwtSecret = env.jwtSecret
const AUTH_BYPASS_FLAG = Symbol.for('yuumi.auth.bypass')

type AuthBypassContext = {
  [AUTH_BYPASS_FLAG]?: boolean
}

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
    secret: jwtSecret,
  }))
  .macro({
    useAuth: (enabled: boolean = true) => {
      if (!enabled) {
        return {
          transform(context) {
            ;(context as AuthBypassContext)[AUTH_BYPASS_FLAG] = true
          },
        }
      }

      return {
        headers: z.object({
          authorization: z.string().optional(),
        }),
        response: {
          401: responseDTO(z.null()),
        },
        async resolve(context) {
          const bypassContext = context as typeof context & AuthBypassContext
          if (bypassContext[AUTH_BYPASS_FLAG]) {
            return {}
          }

          const { authSchema, headers, jwt } = context
          const token = headers.authorization?.startsWith('Bearer ')
            ? headers.authorization.slice(7)
            : undefined

          if (!token) {
            throw new ResponseCodeError(401)
          }

          let auth: unknown
          try {
            auth = await jwt.verify(token)
          }
          catch {
            throw new ResponseCodeError(401)
          }

          const parsedAuth = authSchema.safeParse(auth)

          if (!parsedAuth.success) {
            throw new ResponseCodeError(401)
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
