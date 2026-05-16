import process from 'node:process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'

// Safety rule: this verifier refuses production-looking database names/hosts.
// It connects only to a local/test/dev/verify database, then creates and drops
// disposable schemas so the migration SQL is exercised from a pre-cutover state.
const IMPORT_TASK_TYPE = 'content.third-party-comic-import'
const MIGRATION_PATH = join(
  process.cwd(),
  'db',
  'migration',
  '20260517183000_third_party_import_background_task_reservation',
  'migration.sql',
)
const REQUIRED_BACKGROUND_TASK_COLUMNS = ['dedupe_key', 'serial_key']
const REQUIRED_INDEXES = [
  'background_task_task_type_dedupe_key_idx',
  'background_task_task_type_serial_key_status_idx',
  'background_task_task_type_active_dedupe_key_uidx',
  'background_task_task_type_executing_serial_key_uidx',
  'background_task_conflict_key_task_type_active_key_uidx',
  'background_task_conflict_key_task_id_idx',
  'background_task_conflict_key_task_type_key_idx',
  'background_task_conflict_key_released_created_at_idx',
]

interface CountRow {
  count: string
}

interface BindingOids {
  chapterBindingOid: string
  sourceBindingOid: string
}

async function main() {
  const databaseUrl = process.env.MIGRATION_VERIFY_DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('MIGRATION_VERIFY_DATABASE_URL 环境变量未设置')
  }
  assertSafeDatabaseUrl(databaseUrl)

  const migrationSql = await readFile(MIGRATION_PATH, 'utf8')
  const client = new Client(buildClientConfig(databaseUrl))
  await client.connect()
  try {
    await verifyActiveTaskBlocker(client, migrationSql)
    await verifySuccessfulMigration(client, migrationSql)
  } finally {
    await client.end()
  }

  console.log('third-party import reservation migration verification passed')
}

function buildClientConfig(databaseUrl: string) {
  const parsedUrl = new URL(databaseUrl)
  if (!parsedUrl.password && !process.env.PGPASSWORD) {
    throw new Error(
      'MIGRATION_VERIFY_DATABASE_URL 缺少密码；请在 URL 中包含密码或设置 PGPASSWORD',
    )
  }

  return {
    database: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
    host: parsedUrl.hostname,
    password: parsedUrl.password
      ? decodeURIComponent(parsedUrl.password)
      : (process.env.PGPASSWORD ?? ''),
    port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
    user: parsedUrl.username
      ? decodeURIComponent(parsedUrl.username)
      : (process.env.PGUSER ?? process.env.USERNAME ?? process.env.USER ?? ''),
  }
}

function assertSafeDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl)
  const databaseName = url.pathname.replace(/^\//, '')
  const safeHost = ['127.0.0.1', '::1', 'localhost'].includes(url.hostname)
  const safeName = /dev|local|migration|test|verify/i.test(databaseName)
  const productionName = /prod|production/i.test(databaseName)

  if (productionName || (!safeHost && !safeName)) {
    throw new Error(
      `拒绝在疑似生产库运行 migration verifier: ${url.hostname}/${databaseName}`,
    )
  }
}

async function verifyActiveTaskBlocker(client: Client, migrationSql: string) {
  const schema = buildHarnessSchemaName('blocker')
  await createHarnessSchema(client, schema, { activeImportTaskStatus: 2 })
  try {
    await expectMigrationToThrow(client, schema, migrationSql)
    const dedupeColumnCount = await readCount(
      client,
      `
        select count(*)::text as count
        from information_schema.columns
        where table_schema = $1
          and table_name = 'background_task'
          and column_name = 'dedupe_key'
      `,
      [schema],
    )
    if (dedupeColumnCount !== 0) {
      throw new Error('active blocker 场景不应写入 reservation DDL')
    }
  } finally {
    await dropHarnessSchema(client, schema)
  }
}

async function verifySuccessfulMigration(client: Client, migrationSql: string) {
  const schema = buildHarnessSchemaName('success')
  await createHarnessSchema(client, schema, { activeImportTaskStatus: null })
  try {
    const beforeOids = await readBindingOids(client, schema)
    await runInSchema(client, schema, migrationSql)
    const afterOids = await readBindingOids(client, schema)

    assertBindingOidsUnchanged(beforeOids, afterOids)
    await assertNoActiveOldImportTasks(client, schema)
    await assertBackgroundTaskReservationDdl(client, schema)
    await assertPendingCutoverShape(client, schema)
  } finally {
    await dropHarnessSchema(client, schema)
  }
}

async function createHarnessSchema(
  client: Client,
  schema: string,
  options: { activeImportTaskStatus: 2 | 3 | null },
) {
  await client.query(`create schema ${quoteIdent(schema)}`)
  await runInSchema(
    client,
    schema,
    `
      create table background_task (
        id bigint primary key generated always as identity,
        task_id varchar(36) not null,
        task_type varchar(120) not null,
        operator_type smallint not null,
        operator_user_id integer,
        status smallint not null,
        payload jsonb not null,
        progress jsonb not null,
        result jsonb,
        error jsonb,
        residue jsonb,
        rollback_error jsonb,
        retry_count integer default 0 not null,
        max_retries integer default 3 not null,
        cancel_requested_at timestamp(6) with time zone,
        claimed_by varchar(120),
        claim_expires_at timestamp(6) with time zone,
        started_at timestamp(6) with time zone,
        finalizing_at timestamp(6) with time zone,
        finished_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone default now() not null,
        updated_at timestamp(6) with time zone not null
      );

      create table work_third_party_source_binding (
        id bigint primary key generated always as identity,
        work_id integer not null,
        platform varchar(40) not null,
        provider_comic_id varchar(120) not null,
        provider_path_word varchar(240) not null,
        provider_group_path_word varchar(240) not null,
        provider_uuid varchar(120),
        source_snapshot jsonb not null,
        deleted_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone default now() not null,
        updated_at timestamp(6) with time zone not null
      );

      create table work_third_party_chapter_binding (
        id bigint primary key generated always as identity,
        work_third_party_source_binding_id bigint not null,
        chapter_id integer not null,
        provider_chapter_id varchar(120) not null,
        remote_sort_order integer not null,
        deleted_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone default now() not null,
        updated_at timestamp(6) with time zone not null
      );
    `,
  )
  await seedHarnessRows(client, schema, options.activeImportTaskStatus)
}

async function seedHarnessRows(
  client: Client,
  schema: string,
  activeImportTaskStatus: 2 | 3 | null,
) {
  await runInSchema(
    client,
    schema,
    `
      insert into background_task (
        task_id,
        task_type,
        operator_type,
        operator_user_id,
        status,
        payload,
        progress,
        error,
        rollback_error,
        claimed_by,
        claim_expires_at,
        started_at,
        created_at,
        updated_at
      )
      values (
        'old-pending-import',
        '${IMPORT_TASK_TYPE}',
        1,
        7,
        1,
        '{"comicId":"old"}'::jsonb,
        '{"percent":0}'::jsonb,
        null,
        '{"stale":true}'::jsonb,
        'stale-worker',
        now() + interval '1 hour',
        now(),
        now(),
        now()
      );

      insert into background_task (
        task_id,
        task_type,
        operator_type,
        operator_user_id,
        status,
        payload,
        progress,
        created_at,
        updated_at
      )
      values (
        'old-failed-import',
        '${IMPORT_TASK_TYPE}',
        1,
        7,
        5,
        '{"comicId":"failed"}'::jsonb,
        '{"percent":100}'::jsonb,
        now(),
        now()
      );

      insert into work_third_party_source_binding (
        work_id,
        platform,
        provider_comic_id,
        provider_path_word,
        provider_group_path_word,
        provider_uuid,
        source_snapshot,
        updated_at
      )
      values (
        100,
        'copy',
        'woduzishenji',
        'woduzishenji',
        'default',
        'comic-uuid',
        '{"providerComicId":"woduzishenji"}'::jsonb,
        now()
      );

      insert into work_third_party_chapter_binding (
        work_third_party_source_binding_id,
        chapter_id,
        provider_chapter_id,
        remote_sort_order,
        updated_at
      )
      values (1, 300, 'chapter-001', 1, now());
    `,
  )

  if (activeImportTaskStatus === null) {
    return
  }

  await runInSchema(
    client,
    schema,
    `
      insert into background_task (
        task_id,
        task_type,
        operator_type,
        operator_user_id,
        status,
        payload,
        progress,
        claimed_by,
        claim_expires_at,
        started_at,
        created_at,
        updated_at
      )
      values (
        'active-import',
        '${IMPORT_TASK_TYPE}',
        1,
        7,
        ${activeImportTaskStatus},
        '{"comicId":"active"}'::jsonb,
        '{"percent":50}'::jsonb,
        'worker-active',
        now() + interval '1 hour',
        now(),
        now(),
        now()
      );
    `,
  )
}

async function expectMigrationToThrow(
  client: Client,
  schema: string,
  migrationSql: string,
) {
  try {
    await runInSchema(client, schema, migrationSql)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('third_party_import_cutover_blocked_active_tasks')) {
      throw error
    }
    return
  }
  throw new Error('存在 PROCESSING/FINALIZING 导入任务时 migration 未阻断')
}

async function assertNoActiveOldImportTasks(client: Client, schema: string) {
  const activeCount = await readCount(
    client,
    `
      select count(*)::text as count
      from ${quoteIdent(schema)}.background_task
      where task_type = $1
        and status in (2, 3)
    `,
    [IMPORT_TASK_TYPE],
  )
  if (activeCount > 0) {
    throw new Error(`仍存在运行中的旧三方导入任务: ${activeCount}`)
  }
}

async function assertBackgroundTaskReservationDdl(
  client: Client,
  schema: string,
) {
  const columnRows = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1
        and table_name = 'background_task'
        and column_name = any($2::text[])
    `,
    [schema, REQUIRED_BACKGROUND_TASK_COLUMNS],
  )
  const actualColumns = new Set(columnRows.rows.map((row) => row.column_name))
  for (const column of REQUIRED_BACKGROUND_TASK_COLUMNS) {
    if (!actualColumns.has(column)) {
      throw new Error(`background_task 缺少列: ${column}`)
    }
  }

  const conflictTable = await client.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`${schema}.background_task_conflict_key`],
  )
  if (!conflictTable.rows[0]?.exists) {
    throw new Error('缺少 background_task_conflict_key 表')
  }

  const indexRows = await client.query<{ indexname: string }>(
    `
      select indexname
      from pg_indexes
      where schemaname = $1
        and indexname = any($2::text[])
    `,
    [schema, REQUIRED_INDEXES],
  )
  const actualIndexes = new Set(indexRows.rows.map((row) => row.indexname))
  for (const index of REQUIRED_INDEXES) {
    if (!actualIndexes.has(index)) {
      throw new Error(`缺少 reservation 索引: ${index}`)
    }
  }
}

async function assertPendingCutoverShape(client: Client, schema: string) {
  const stalePendingCount = await readCount(
    client,
    `
      select count(*)::text as count
      from ${quoteIdent(schema)}.background_task
      where task_type = $1
        and status = 1
        and dedupe_key is null
        and serial_key is null
    `,
    [IMPORT_TASK_TYPE],
  )
  if (stalePendingCount > 0) {
    throw new Error(
      `仍存在缺少 reservation snapshot 的旧 PENDING 导入任务: ${stalePendingCount}`,
    )
  }

  const dirtyCancelledCount = await readCount(
    client,
    `
      select count(*)::text as count
      from ${quoteIdent(schema)}.background_task
      where task_id = 'old-pending-import'
        and (
          task_type <> $1
          or status <> 6
          or error->>'name' <> 'BackgroundTaskCutoverCancelledError'
          or error->>'message' <> '破坏性更新取消旧待执行导入任务，请重新提交'
          or error->'cause'->>'code' <> 'third_party_import_cutover_cancelled'
          or cancel_requested_at is null
          or finished_at is null
          or updated_at is null
          or claimed_by is not null
          or claim_expires_at is not null
          or rollback_error is not null
        )
    `,
    [IMPORT_TASK_TYPE],
  )
  if (dirtyCancelledCount > 0) {
    throw new Error(
      `migration-cancelled 任务终态字段不符合约定: ${dirtyCancelledCount}`,
    )
  }
}

async function readBindingOids(
  client: Client,
  schema: string,
): Promise<BindingOids> {
  const result = await client.query<{
    chapter_binding_oid: null | string
    source_binding_oid: null | string
  }>(
    `
      select
        to_regclass($1)::oid::text as source_binding_oid,
        to_regclass($2)::oid::text as chapter_binding_oid
    `,
    [
      `${schema}.work_third_party_source_binding`,
      `${schema}.work_third_party_chapter_binding`,
    ],
  )
  const row = result.rows[0]
  if (!row?.source_binding_oid) {
    throw new Error('work_third_party_source_binding 表不存在')
  }
  if (!row.chapter_binding_oid) {
    throw new Error('work_third_party_chapter_binding 表不存在')
  }
  return {
    chapterBindingOid: row.chapter_binding_oid,
    sourceBindingOid: row.source_binding_oid,
  }
}

function assertBindingOidsUnchanged(before: BindingOids, after: BindingOids) {
  if (before.sourceBindingOid !== after.sourceBindingOid) {
    throw new Error(
      `work_third_party_source_binding OID 发生变化: expected=${before.sourceBindingOid}, actual=${after.sourceBindingOid}`,
    )
  }
  if (before.chapterBindingOid !== after.chapterBindingOid) {
    throw new Error(
      `work_third_party_chapter_binding OID 发生变化: expected=${before.chapterBindingOid}, actual=${after.chapterBindingOid}`,
    )
  }
  console.log(`work_third_party_source_binding oid: ${after.sourceBindingOid}`)
  console.log(
    `work_third_party_chapter_binding oid: ${after.chapterBindingOid}`,
  )
}

async function runInSchema(client: Client, schema: string, sql: string) {
  await client.query('begin')
  try {
    await client.query(`set local search_path to ${quoteIdent(schema)}, public`)
    await client.query(sql)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

async function dropHarnessSchema(client: Client, schema: string) {
  await client.query(`drop schema if exists ${quoteIdent(schema)} cascade`)
}

function buildHarnessSchemaName(label: string) {
  return `migration_verify_${label}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

async function readCount(client: Client, sql: string, values: unknown[] = []) {
  const result = await client.query<CountRow>(sql, values)
  return Number(result.rows[0]?.count ?? 0)
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error)
  process.exitCode = 1
})
