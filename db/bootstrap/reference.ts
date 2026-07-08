import type { Buffer } from 'node:buffer'
import { scrypt as _scrypt, randomBytes } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'
import { adminUser } from '@db/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  assertReferenceBootstrapEnvironment,
  shouldCheckDatabaseToolEnvironmentOnly,
} from '../runtime-guard'

const SUPER_ADMIN_ROLE = 1
const scrypt = promisify(_scrypt)

async function runReferenceBootstrap() {
  const environment = assertReferenceBootstrapEnvironment(process.env)

  if (shouldCheckDatabaseToolEnvironmentOnly(process.argv)) {
    console.log('✅ Reference bootstrap 环境检查通过')
    console.log(`  - target: ${environment.safeLabel}`)
    console.log(
      `  - admin: ${environment.admin ? environment.admin.username : '(skip)'}`,
    )
    return
  }

  if (!environment.admin) {
    console.log('ℹ️ 未设置 BOOTSTRAP_ADMIN_USERNAME/PASSWORD，跳过管理员创建')
    return
  }

  const pool = new Pool({
    connectionString: environment.databaseUrl,
  })
  const db = drizzle({
    client: pool,
  })

  try {
    const [existingAdmin] = await db
      .select({
        id: adminUser.id,
      })
      .from(adminUser)
      .where(eq(adminUser.username, environment.admin.username))
      .limit(1)

    if (existingAdmin) {
      console.log(`ℹ️ 管理员 ${environment.admin.username} 已存在，跳过创建`)
      return
    }

    if (environment.admin.mobile) {
      const [existingMobile] = await db
        .select({
          id: adminUser.id,
        })
        .from(adminUser)
        .where(eq(adminUser.mobile, environment.admin.mobile))
        .limit(1)

      if (existingMobile) {
        throw new Error(
          `BOOTSTRAP_ADMIN_MOBILE 已被管理员 ${existingMobile.id} 使用`,
        )
      }
    }

    await db.insert(adminUser).values({
      username: environment.admin.username,
      password: await encryptPassword(environment.admin.password),
      ...(environment.admin.mobile ? { mobile: environment.admin.mobile } : {}),
      ...(environment.admin.avatar ? { avatar: environment.admin.avatar } : {}),
      role: SUPER_ADMIN_ROLE,
      isEnabled: true,
    })

    console.log(`✅ 管理员 ${environment.admin.username} 创建完成`)
  } finally {
    await pool.end()
  }
}

async function encryptPassword(password: string) {
  if (!password || password.length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD 长度至少为 8')
  }

  const salt = randomBytes(16).toString('hex')
  const key = (await scrypt(password, salt, 64)) as Buffer

  return `${salt}.${key.toString('hex')}`
}

if (require.main === module) {
  runReferenceBootstrap()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { encryptPassword, runReferenceBootstrap }
