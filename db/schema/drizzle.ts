import type { DrizzleConfig } from 'drizzle-orm'
import { relations } from './relations'
import * as schema from './schema'

/**
 * Centralized Drizzle config for this schema.
 * Enable automatic camelCase <-> snake_case mapping.
 */
export const drizzleConfig: DrizzleConfig<typeof schema, typeof relations> = {
  schema,
  relations,
  casing: 'snake_case',
}
