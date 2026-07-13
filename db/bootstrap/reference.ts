import type { Buffer } from 'node:buffer'
import type { PoolClient } from 'pg'
import type { ReferenceBootstrapTransaction } from './reference-rbac'
import { scrypt as _scrypt, randomBytes } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'
import {
  acquireIntegrityLocks,
  ADMIN_RBAC_RELATION_INTEGRITY_LOCKS,
  jobIntegrityLock,
} from '@db/core'
import { adminRole, adminUser, adminUserRole } from '@db/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { assertAdminRbacReferencePermissionManifestCurrent } from '../../scripts/generate-admin-rbac-reference-permissions'
import {
  acquireMigrationSessionLock,
  readMigrationLockTimeoutMs,
  releaseMigrationSessionLock,
} from '../migration-session-lock'
import { readReferenceBootstrapOptions } from '../runtime-guard'
import { readRegisteredDisposableDatabaseTarget } from '../targets/registered-disposable-target'
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
  targetId: string
}

export interface ReferenceBootstrapResult {
  adminCreated: boolean
  manifest: {
    count: number
    digest: string
  }
  targetId: string
}

function readReferenceBootstrapCommand(
  argv = process.argv,
): ReferenceBootstrapCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false
  let targetId: string | undefined

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
      case '--target-id': {
        if (targetId) {
          throw new Error('--target-id may be specified only once')
        }
        const value = args[index + 1]
        if (!value || value.startsWith('--')) {
          throw new Error('--target-id requires a registered target id')
        }
        targetId = value
        index += 1
        break
      }
      default:
        throw new Error(`Unknown reference bootstrap argument: ${argument}`)
    }
  }

  if (!targetId) {
    throw new Error('--target-id is required')
  }
  return { checkEnvironmentOnly, targetId }
}

async function assertTargetIdentity(client: PoolClient, databaseName: string) {
  const result = await client.query<{ database_name: string }>(
    'SELECT current_database() AS database_name',
  )
  if (result.rows[0]?.database_name !== databaseName) {
    throw new Error(
      'Connected database does not match the registered reference bootstrap target',
    )
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
  const target = readRegisteredDisposableDatabaseTarget(command.targetId)
  const manifest = assertAdminRbacReferencePermissionManifestCurrent()
  if (
    manifest.count !== ADMIN_REFERENCE_PERMISSIONS.length ||
    manifest.digest !== ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST
  ) {
    throw new Error(
      'Admin RBAC reference permission manifest integrity check failed',
    )
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
        target: target.safeLabel,
      })}\n`,
    )
    return { adminCreated: false, manifest, targetId: target.id }
  }

  const pool = new Pool({ connectionString: target.url, max: 1 })
  let client: PoolClient | undefined
  let lockAcquired = false
  let primaryError: unknown
  let releaseError: unknown
  let result: ReferenceBootstrapResult | undefined

  try {
    client = await pool.connect()
    await assertTargetIdentity(client, target.databaseName)
    const lock = await acquireMigrationSessionLock(
      client,
      readMigrationLockTimeoutMs(),
    )
    lockAcquired = true
    const db = drizzle({ client })
    const adminCreated = await db.transaction(async (tx) => {
      await acquireIntegrityLocks(tx, [
        jobIntegrityLock(DATABASE_INITIALIZATION_JOB_LOCK),
        ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.mutation,
        ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.superAdminMembership,
      ])
      await ensureAdminRbacReferenceFoundation(tx)
      await syncAdminRbacReferencePermissions(tx, ADMIN_REFERENCE_PERMISSIONS)
      await grantAdminRbacBuiltInRoleDefaults(tx)
      return admin ? createBootstrapAdministrator(tx, admin) : false
    })
    result = { adminCreated, manifest, targetId: target.id }
    process.stdout.write(
      `${JSON.stringify({
        adminCreated,
        lockAttempts: lock.attempts,
        permissionCount: manifest.count,
        permissionManifestDigest: manifest.digest,
        status: 'pass',
        target: target.safeLabel,
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
