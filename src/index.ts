import { Elysia } from 'elysia'
import env from './env'
import { authService } from './services/auth'
import { usersService } from './services/users'

export const app = new Elysia()
  .group(env.apiPrefix, app => app
    .use(authService)
    .use(usersService))

app.listen(env.port)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
