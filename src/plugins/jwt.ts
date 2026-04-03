import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { serverConfig } from '@/config/env'
import { userDTO } from '@/models'
import { ResponseCodeError, responseDTO } from './formatResponse'

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
    secret: serverConfig.JWT_SECRET,
  }))
  .macro({
    useAuth: (enabled: boolean = true) => {
      if (!enabled)
        return {}

      return {
        headers: z.object({
          authorization: z.string().optional(),
        }),
        response: {
          401: responseDTO(z.null()),
        },
        async resolve({ authSchema, headers, jwt }) {
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
