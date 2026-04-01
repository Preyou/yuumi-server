import type { OpenAPI3 } from 'openapi-typescript'
import type { z } from 'zod'
import axios from 'axios'
import { serverConfig } from '@/config/env'
import { permissionDTO } from '@/models'
import { pg } from '@/db'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])
const openapiUrl = serverConfig.OPENAPI_URL

const { data: openapi } = await axios.get<OpenAPI3>(openapiUrl)

const permissions = Object.entries(openapi.paths ?? {}).flatMap(([path, pathItem]) => {
  if (!pathItem) {
    return []
  }

  return Object.entries(pathItem).flatMap(([method, operation]) => {
    if (!HTTP_METHODS.has(method)) {
      return []
    }

    if (!operation || typeof operation !== 'object') {
      return []
    }

    const operationObject = operation as {
      operationId?: string
      summary?: string
      tags?: string[]
    }
    if (!operationObject.operationId) {
      return []
    }

    return [{
      method: method.toUpperCase() as z.infer<typeof permissionDTO.insert>['method'],
      name: operationObject.operationId,
      path,
      isPublic: false,
      summary: operationObject.summary ?? null,
      tags: operationObject.tags?.join(',') ?? null,
    } satisfies z.infer<typeof permissionDTO.insert>]
  })
})

if (permissions.length > 0) {
  await pg.db.insert(pg.schemas.tables.permissions)
    .values(permissions)
    .onConflictDoNothing()
}
