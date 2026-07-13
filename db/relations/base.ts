import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

/**
 * RQB v2 的空 relation base part。
 *
 * 无 callback 的 base part 自动为所有 schema table 注册空 relation root；领域
 * relation part 在聚合时始终排在本 part 之后，以其显式关系覆盖对应 root。这样新增
 * table 会自动进入唯一的 canonical query contract，不会因手工空根清单而漂移。
 */
export const baseRelations = defineRelationsPart(schema)
