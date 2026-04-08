import { Elysia } from 'elysia'
import { authService } from './services/auth'
import { usersService } from './services/users'

const apiPrefix = import.meta.env.API_PREFIX
const port = Number.parseInt(import.meta.env.PORT, 10)

export const app = new Elysia()
  .group(apiPrefix, app => app
    .use(authService)
    .use(usersService))

app.listen(port)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
