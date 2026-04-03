import { Elysia } from 'elysia'
import { serverConfig } from '@/config/env'
import { authService } from './services/auth'
import { usersService } from './services/users'

export const app = new Elysia()
  .group(serverConfig.API_PREFIX, app => app
    .use(authService)
    .use(usersService))

app.listen(serverConfig.PORT)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
