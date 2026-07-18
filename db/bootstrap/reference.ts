import type { Buffer } from 'node:buffer'
import type { PoolClient } from 'pg'
import type { ReferenceBootstrapTransaction } from './reference-rbac'
import { scrypt as _scrypt, createHash, randomBytes } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'
import {
  acquireIntegrityLocks,
  ADMIN_RBAC_RELATION_INTEGRITY_LOCKS,
  exclusiveIntegrityLock,
  jobIntegrityLock,
} from '@db/core'
import { adminRole, adminUser, adminUserRole } from '@db/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  acquireMigrationSessionLock,
  readMigrationLockTimeoutMs,
  releaseMigrationSessionLock,
} from '../migration-session-lock'
import {
  readDatabaseConnection,
  readReferenceBootstrapOptions,
} from '../runtime-guard'
import {
  ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST,
  ADMIN_REFERENCE_PERMISSIONS,
} from './admin-rbac-permissions.generated'
import {
  ensureAdminRbacReferenceFoundation,
  grantAdminRbacBuiltInRoleDefaults,
  syncAdminRbacReferencePermissions,
} from './reference-rbac'

const DATABASE_INITIALIZATION_JOB_LOCK = 'reference-data-bootstrap'
const SUPER_ADMIN_ROLE_CODE = 'super_admin'
const scrypt = promisify(_scrypt)

export interface ReferenceBootstrapCommand {
  checkEnvironmentOnly: boolean
  createAdmin?: boolean
}

export interface ReferenceBootstrapResult {
  adminCreated: boolean
  manifest: {
    count: number
    digest: string
  }
}

function readReferenceBootstrapCommand(
  argv = process.argv,
): ReferenceBootstrapCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--check-env':
      case '--dry-run': {
        if (checkEnvironmentOnly) {
          throw new Error(
            'Reference bootstrap environment check may be specified only once',
          )
        }
        checkEnvironmentOnly = true
        break
      }
      default:
        throw new Error(`Unknown reference bootstrap argument: ${argument}`)
    }
  }

  return { checkEnvironmentOnly }
}

async function assertTargetIdentity(client: PoolClient, databaseName: string) {
  const result = await client.query<{ database_name: string }>(
    'SELECT current_database() AS database_name',
  )
  if (result.rows[0]?.database_name !== databaseName) {
    throw new Error('Connected database does not match DATABASE_URL')
  }
}

async function createBootstrapAdministrator(
  tx: ReferenceBootstrapTransaction,
  admin: NonNullable<ReturnType<typeof readReferenceBootstrapOptions>['admin']>,
) {
  const [existingAdmin] = await tx
    .select({ id: adminUser.id })
    .from(adminUser)
    .where(eq(adminUser.username, admin.username))
    .limit(1)
  if (existingAdmin) {
    return false
  }

  if (admin.mobile) {
    const [existingMobile] = await tx
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.mobile, admin.mobile))
      .limit(1)
    if (existingMobile) {
      throw new Error(
        `BOOTSTRAP_ADMIN_MOBILE 已被管理员 ${existingMobile.id} 使用`,
      )
    }
  }

  const [superAdminRole] = await tx
    .select({ id: adminRole.id })
    .from(adminRole)
    .where(eq(adminRole.code, SUPER_ADMIN_ROLE_CODE))
    .limit(1)
  if (!superAdminRole) {
    throw new Error('未找到内置超级管理员角色，无法创建引导管理员')
  }

  const [createdAdmin] = await tx
    .insert(adminUser)
    .values({
      ...(admin.avatar ? { avatar: admin.avatar } : {}),
      isEnabled: true,
      ...(admin.mobile ? { mobile: admin.mobile } : {}),
      password: await encryptPassword(admin.password),
      username: admin.username,
    })
    .returning({ id: adminUser.id })
  if (!createdAdmin) {
    throw new Error('引导管理员创建未返回主键')
  }

  await tx
    .insert(adminUserRole)
    .values({ adminUserId: createdAdmin.id, roleId: superAdminRole.id })
    .onConflictDoNothing()
  return true
}

export async function runReferenceBootstrap(
  command: ReferenceBootstrapCommand,
): Promise<ReferenceBootstrapResult> {
  const database = readDatabaseConnection(
    process.env,
    'Reference bootstrap 需要 DATABASE_URL',
  )
  // Docker 构建时 manifest:write 已保证 generated 文件与 controller 装饰器一致；
  // runtime 只需校验 digest 自洽，防止文件被篡改或损坏，不再依赖源码扫描。
  const computedDigest = createHash('sha256')
    .update(JSON.stringify(ADMIN_REFERENCE_PERMISSIONS), 'utf8')
    .digest('hex')
  if (computedDigest !== ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST) {
    throw new Error(
      'Admin RBAC reference permission manifest digest mismatch',
    )
  }
  const manifest = {
    count: ADMIN_REFERENCE_PERMISSIONS.length,
    digest: ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST,
  }
  const admin =
    command.createAdmin === false
      ? undefined
      : readReferenceBootstrapOptions(process.env).admin
  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify({
        adminRequested: Boolean(admin),
        permissionCount: manifest.count,
        permissionManifestDigest: manifest.digest,
        status: 'environment-ready',
        database: database.safeLabel,
      })}\n`,
    )
    return { adminCreated: false, manifest }
  }

  const pool = new Pool({ connectionString: database.databaseUrl, max: 1 })
  let client: PoolClient | undefined
  let lockAcquired = false
  let primaryError: unknown
  let releaseError: unknown
  let result: ReferenceBootstrapResult | undefined

  try {
    client = await pool.connect()
    await assertTargetIdentity(client, database.databaseName)
    const lock = await acquireMigrationSessionLock(
      client,
      readMigrationLockTimeoutMs(),
    )
    lockAcquired = true
    const db = drizzle({ client })
    const adminCreated = await db.transaction(async (tx) => {
      await acquireIntegrityLocks(tx, [
        exclusiveIntegrityLock(
          jobIntegrityLock(DATABASE_INITIALIZATION_JOB_LOCK),
        ),
        exclusiveIntegrityLock(ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.mutation),
        exclusiveIntegrityLock(
          ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.superAdminMembership,
        ),
      ])
      await ensureAdminRbacReferenceFoundation(tx)
      await syncAdminRbacReferencePermissions(tx, ADMIN_REFERENCE_PERMISSIONS)
      await grantAdminRbacBuiltInRoleDefaults(tx)
      return admin ? createBootstrapAdministrator(tx, admin) : false
    })
    result = { adminCreated, manifest }
    process.stdout.write(
      `${JSON.stringify({
        adminCreated,
        lockAttempts: lock.attempts,
        permissionCount: manifest.count,
        permissionManifestDigest: manifest.digest,
        status: 'pass',
        database: database.safeLabel,
      })}\n`,
    )
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    if (client && lockAcquired) {
      try {
        await releaseMigrationSessionLock(client)
      } catch (error) {
        if (primaryError) {
          console.error('Migration session lock release failed', error)
        } else {
          releaseError = error
        }
      }
    }
    client?.release()
    await pool.end()
  }

  if (releaseError) {
    throw releaseError
  }
  if (!result) {
    throw new Error('Reference bootstrap did not produce a result')
  }
  return result
}

async function encryptPassword(password: string) {
  if (!password || password.length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD 长度至少为 8')
  }

  const salt = randomBytes(16).toString('hex')
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}.${key.toString('hex')}`
}

async function main() {
  await runReferenceBootstrap(readReferenceBootstrapCommand())
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

export { encryptPassword, readReferenceBootstrapCommand }
