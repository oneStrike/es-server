/**
 * Seed 脚本使用的数据库客户端类型。
 * 传入完整 schema（表 + relations），使 db.query 拥有完整的类型推导。
 */
import type { SeedDb } from '@db/core'

export type Db = SeedDb
