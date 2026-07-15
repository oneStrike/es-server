import type { Buffer } from 'node:buffer'
import type { PoolClient, QueryResultRow } from 'pg'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export const CANONICAL_EPOCH = '20260714004452_canonical_empty_db_baseline'
export const CANONICAL_MANIFEST_VERSION = 1
export const CANONICAL_OWNER_POLICY = '$MIGRATION_ROLE'
export const CANONICAL_REQUIRED_POSTGRESQL_VERSION = '17.2'
export const CANONICAL_REQUIRED_PG_TRGM_VERSION = '1.6'
export const CANONICAL_MIGRATIONS_SCHEMA = 'public'
export const CANONICAL_MIGRATIONS_TABLE = '__drizzle_migrations__'

const DB_DIRECTORY = resolve(__dirname)
const REPOSITORY_ROOT = resolve(DB_DIRECTORY, '..')
const MIGRATIONS_DIRECTORY = resolve(DB_DIRECTORY, 'migration')
const BASELINE_DIRECTORY = resolve(MIGRATIONS_DIRECTORY, CANONICAL_EPOCH)
const BASELINE_SQL_PATH = resolve(BASELINE_DIRECTORY, 'migration.sql')
const SNAPSHOT_PATH = resolve(BASELINE_DIRECTORY, 'snapshot.json')
const EPOCH_POLICY_PATH = resolve(BASELINE_DIRECTORY, 'epoch-policy.json')
const COMMENTS_PATH = resolve(DB_DIRECTORY, 'comments', 'generated.sql')
const SCHEMA_DIRECTORY = resolve(DB_DIRECTORY, 'schema')
const CATALOG_GENERATOR_PATH = resolve(
  REPOSITORY_ROOT,
  'scripts',
  'db-catalog-manifest.ts',
)
const CATALOG_CONTRACT_PATH = resolve(DB_DIRECTORY, 'canonical-epoch.ts')
const MANIFEST_PATH = resolve(BASELINE_DIRECTORY, 'catalog-manifest.json')
const HASH_SEPARATOR = String.fromCharCode(0)
const REQUIRED_PUBLIC_ROOT_CATALOGS = [
  'pg_class',
  'pg_collation',
  'pg_conversion',
  'pg_opclass',
  'pg_operator',
  'pg_opfamily',
  'pg_policy',
  'pg_proc',
  'pg_rewrite',
  'pg_statistic_ext',
  'pg_ts_config',
  'pg_ts_dict',
  'pg_ts_parser',
  'pg_ts_template',
  'pg_type',
] as const

const CATALOG_KEYS = [
  'tables',
  'columns',
  'sequences',
  'constraints',
  'indexes',
  'enums',
  'domains',
  'types',
  'views',
  'materializedViews',
  'routines',
  'triggers',
  'rules',
  'policies',
  'collations',
  'conversions',
  'textSearchConfigurations',
  'textSearchConfigurationMappings',
  'textSearchDictionaries',
  'textSearchParsers',
  'textSearchTemplates',
  'extendedStatistics',
  'operators',
  'operatorClasses',
  'operatorFamilies',
  'operatorFamilyOperators',
  'operatorFamilyProcedures',
  'unsupportedCatalogStates',
  'extensions',
  'extensionMembers',
  'extensionMemberDefinitions',
  'comments',
] as const

type CatalogKey = (typeof CATALOG_KEYS)[number]
type JsonPrimitive = boolean | null | number | string
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type CatalogRecord = Record<string, JsonValue>

export interface CanonicalEpochPolicy {
  classifierStates: ['NEW', 'CURRENT', 'REJECT']
  commentsRepair: 'comments-digest-only'
  epoch: typeof CANONICAL_EPOCH
  foreignKeysAllowed: false
  formatVersion: 1
  migrationsSchema: 'public'
  migrationsTable: '__drizzle_migrations__'
  nonExtensionRoutinesAllowed: false
  ownerPolicy: '$MIGRATION_ROLE'
  recoveryUnit: 'complete-epoch-only'
  requiredPgTrgmVersion: '1.6'
  requiredPostgreSqlVersion: '17.2'
  retiredFunctions: string[]
  retiredTriggers: string[]
  searchPath: ['public', 'pg_catalog']
  triggersAllowed: false
}

export interface CanonicalStaticInputs {
  baselineSqlSha256: string
  catalogGeneratorSha256: string
  commentsSqlSha256: string
  epochPolicySha256: string
  schemaSourceSha256: string
  snapshotSha256: string
}

export interface CanonicalJournal {
  createdAt: string
  hash: string
  name: typeof CANONICAL_EPOCH
  rowCount: 1
}

export type CanonicalCatalog = Record<CatalogKey, CatalogRecord[]>

export interface CanonicalCatalogManifest {
  catalog: CanonicalCatalog
  commentsDigest: string
  epoch: typeof CANONICAL_EPOCH
  inputs: CanonicalStaticInputs
  journal: CanonicalJournal
  manifestVersion: 1
  ownerPolicy: '$MIGRATION_ROLE'
  requiredPgTrgmVersion: '1.6'
  requiredPostgreSqlVersion: '17.2'
  structureDigest: string
}

export interface CanonicalTargetIdentity {
  capabilityDigest: string
  databaseCollation: string
  databaseCreatePrivilege: boolean
  databaseCtype: string
  databaseLocale: string
  databaseName: string
  databaseOid: string
  databaseOwnerMatchesRole: boolean
  fingerprint: string
  localeProvider: string
  pgTrgmAvailable: boolean
  publicSchemaCreatePrivilege: boolean
  resetAuthority: boolean
  roleOid: string
  serverEncoding: string
  serverVersion: string
  systemIdentifier: string
}

export interface CanonicalMigrationAuthorization {
  disposableAuthorization: string
  epoch: string
  initializeAuthorization?: string
  targetFingerprint: string
}

export interface CanonicalClassification {
  commentsDigest: string
  commentsRepairAllowed: boolean
  journalCount: number
  manifestDigest: string
  manifestVersion: 1
  reasonCode?: string
  requiredPgTrgmVersion: '1.6'
  state: 'CURRENT' | 'NEW' | 'REJECT'
  structureDigest: string
  targetFingerprint: string
}

export class CanonicalEpochError extends Error {
  constructor(
    readonly reasonCode: string,
    message: string,
  ) {
    super(message)
    this.name = 'CanonicalEpochError'
  }
}

interface JsonRow extends QueryResultRow {
  value: CatalogRecord
}

interface IdentityRow extends QueryResultRow {
  database_collation: string
  database_create_privilege: boolean
  database_ctype: string
  database_locale: string
  database_name: string
  database_oid: string
  database_owner_matches_role: boolean
  locale_provider: string
  pg_trgm_available: boolean
  public_schema_create_privilege: boolean
  reset_authority: boolean
  role_oid: string
  server_encoding: string
  server_version: string
  system_identifier: string
}

interface ScalarRow extends QueryResultRow {
  value: string
}

interface JournalRow extends QueryResultRow {
  created_at: string
  hash: string
  name: string
}

interface ExistsRow extends QueryResultRow {
  exists: boolean
}

export interface CanonicalCatalogExecutor {
  query: PoolClient['query']
}

export function getCanonicalManifestPath() {
  return MANIFEST_PATH
}

export function getCanonicalJournalContract() {
  return expectedJournal()
}

export function getCanonicalManifestDigest(manifest: CanonicalCatalogManifest) {
  return sha256(renderCanonicalManifest(manifest))
}

export function buildCanonicalAuthorizationDigest(
  purpose: 'disposable' | 'initialize',
  targetFingerprint: string,
) {
  return sha256([CANONICAL_EPOCH, targetFingerprint, purpose].join('|'))
}

export function renderCanonicalManifest(manifest: CanonicalCatalogManifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function readCanonicalEpochPolicy(): CanonicalEpochPolicy {
  const policy = parseJsonFile<CanonicalEpochPolicy>(
    EPOCH_POLICY_PATH,
    'EPOCH_POLICY_INVALID',
  )
  assertExactKeys(
    policy,
    [
      'classifierStates',
      'commentsRepair',
      'epoch',
      'foreignKeysAllowed',
      'formatVersion',
      'migrationsSchema',
      'migrationsTable',
      'nonExtensionRoutinesAllowed',
      'ownerPolicy',
      'recoveryUnit',
      'requiredPgTrgmVersion',
      'requiredPostgreSqlVersion',
      'retiredFunctions',
      'retiredTriggers',
      'searchPath',
      'triggersAllowed',
    ],
    'epoch policy',
  )
  if (
    policy.formatVersion !== 1 ||
    policy.epoch !== CANONICAL_EPOCH ||
    policy.requiredPostgreSqlVersion !==
      CANONICAL_REQUIRED_POSTGRESQL_VERSION ||
    policy.requiredPgTrgmVersion !== CANONICAL_REQUIRED_PG_TRGM_VERSION ||
    policy.ownerPolicy !== CANONICAL_OWNER_POLICY ||
    policy.migrationsSchema !== CANONICAL_MIGRATIONS_SCHEMA ||
    policy.migrationsTable !== CANONICAL_MIGRATIONS_TABLE ||
    JSON.stringify(policy.searchPath) !==
      JSON.stringify(['public', 'pg_catalog']) ||
    JSON.stringify(policy.classifierStates) !==
      JSON.stringify(['NEW', 'CURRENT', 'REJECT']) ||
    policy.commentsRepair !== 'comments-digest-only' ||
    policy.foreignKeysAllowed ||
    policy.nonExtensionRoutinesAllowed ||
    policy.triggersAllowed ||
    policy.recoveryUnit !== 'complete-epoch-only'
  ) {
    throw new CanonicalEpochError(
      'EPOCH_POLICY_INVALID',
      'Canonical epoch policy does not match the executable contract',
    )
  }
  return policy
}

export function readCanonicalStaticInputs(): CanonicalStaticInputs {
  return {
    baselineSqlSha256: hashCanonicalTextFile(BASELINE_SQL_PATH),
    catalogGeneratorSha256: digestFiles([
      CATALOG_CONTRACT_PATH,
      CATALOG_GENERATOR_PATH,
    ]),
    commentsSqlSha256: hashCanonicalTextFile(COMMENTS_PATH),
    epochPolicySha256: hashCanonicalTextFile(EPOCH_POLICY_PATH),
    schemaSourceSha256: digestFiles(listFiles(SCHEMA_DIRECTORY, '.ts')),
    snapshotSha256: hashCanonicalTextFile(SNAPSHOT_PATH),
  }
}

/** 防止迁移器按原始字节记账后才发现文本换行摘要不一致。 */
export function assertCanonicalTextInputsUseLf() {
  const paths = [
    BASELINE_SQL_PATH,
    SNAPSHOT_PATH,
    EPOCH_POLICY_PATH,
    COMMENTS_PATH,
    CATALOG_GENERATOR_PATH,
    CATALOG_CONTRACT_PATH,
  ]
  for (const path of paths) {
    if (readFileSync(path, 'utf8').includes('\r')) {
      throw new CanonicalEpochError(
        'CANONICAL_TEXT_EOL_INVALID',
        'Canonical text inputs must use LF line endings before connection',
      )
    }
  }
  assertCanonicalCatalogSurfaceClosure()
}

export function readCanonicalManifest(): CanonicalCatalogManifest {
  const diskBytes = readFileSync(MANIFEST_PATH, 'utf8')
  const raw = normalizeNewlines(diskBytes)
  if (diskBytes !== raw) {
    throw new CanonicalEpochError(
      'MANIFEST_NONCANONICAL',
      'Canonical catalog manifest must use LF line endings',
    )
  }
  let manifest: CanonicalCatalogManifest
  try {
    manifest = JSON.parse(raw) as CanonicalCatalogManifest
  } catch {
    throw new CanonicalEpochError(
      'MANIFEST_INVALID',
      'Canonical catalog manifest is not valid JSON',
    )
  }
  assertManifestShape(manifest)
  assertCanonicalManifestDigests(manifest)
  if (renderCanonicalManifest(manifest) !== raw) {
    throw new CanonicalEpochError(
      'MANIFEST_NONCANONICAL',
      'Canonical catalog manifest bytes are not canonical',
    )
  }
  if (
    manifest.manifestVersion !== CANONICAL_MANIFEST_VERSION ||
    manifest.epoch !== CANONICAL_EPOCH ||
    manifest.ownerPolicy !== CANONICAL_OWNER_POLICY ||
    manifest.requiredPostgreSqlVersion !==
      CANONICAL_REQUIRED_POSTGRESQL_VERSION ||
    manifest.requiredPgTrgmVersion !== CANONICAL_REQUIRED_PG_TRGM_VERSION
  ) {
    throw new CanonicalEpochError(
      'MANIFEST_VERSION_MISMATCH',
      'Canonical catalog manifest contract does not match this epoch',
    )
  }
  return manifest
}

export function assertCanonicalStaticInputs(
  manifest: CanonicalCatalogManifest,
) {
  const actual = readCanonicalStaticInputs()
  if (canonicalJson(actual) !== canonicalJson(manifest.inputs)) {
    throw new CanonicalEpochError(
      'MANIFEST_INPUT_DRIFT',
      'Canonical manifest fixed inputs have drifted',
    )
  }
}

export async function beginCanonicalTransaction(
  executor: CanonicalCatalogExecutor,
  readOnly: boolean,
) {
  await executor.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN')
  await executor.query('SET LOCAL search_path = public, pg_catalog')
  const result = await executor.query<{
    current_schema: string | null
    search_path: string
  }>(
    "SELECT current_schema() AS current_schema, current_setting('search_path') AS search_path",
  )
  const row = result.rows[0]
  if (
    row?.current_schema !== 'public' ||
    row.search_path !== 'public, pg_catalog'
  ) {
    throw new CanonicalEpochError(
      'SEARCH_PATH_INVALID',
      'Connected catalog session did not establish public, pg_catalog',
    )
  }
}

export async function readCanonicalTargetIdentity(
  executor: CanonicalCatalogExecutor,
): Promise<CanonicalTargetIdentity> {
  const result = await executor.query<IdentityRow>(
    `SELECT
       (pg_catalog.pg_control_system()).system_identifier::text AS system_identifier,
       current_database() AS database_name,
       database_record.oid::text AS database_oid,
       role_record.oid::text AS role_oid,
       current_setting('server_version') AS server_version,
       pg_catalog.pg_encoding_to_char(database_record.encoding) AS server_encoding,
       database_record.datcollate AS database_collation,
       database_record.datctype AS database_ctype,
       database_record.datlocprovider::text AS locale_provider,
       COALESCE(database_record.datlocale, '') AS database_locale,
       database_record.datdba = role_record.oid AS database_owner_matches_role,
       has_database_privilege(current_user, current_database(), 'CREATE') AS database_create_privilege,
       has_schema_privilege(current_user, 'public', 'CREATE') AS public_schema_create_privilege,
       (
         (database_record.datdba = role_record.oid OR role_record.rolsuper)
         AND (role_record.rolcreatedb OR role_record.rolsuper)
       ) AS reset_authority,
       EXISTS (
         SELECT 1
         FROM pg_catalog.pg_available_extension_versions AS available
         WHERE available.name = 'pg_trgm'
           AND available.version = '1.6'
       ) AS pg_trgm_available
     FROM pg_catalog.pg_roles AS role_record
     INNER JOIN pg_catalog.pg_database AS database_record
       ON database_record.datname = current_database()
     WHERE role_record.rolname = current_user`,
  )
  const row = result.rows[0]
  if (!row) {
    throw new CanonicalEpochError(
      'TARGET_IDENTITY_UNAVAILABLE',
      'Unable to read the connected target identity',
    )
  }
  const capabilityDigest = sha256(
    canonicalJson({
      databaseCollation: row.database_collation,
      databaseCreatePrivilege: row.database_create_privilege,
      databaseCtype: row.database_ctype,
      databaseLocale: row.database_locale,
      databaseOwnerMatchesRole: row.database_owner_matches_role,
      localeProvider: row.locale_provider,
      pgTrgmAvailable: row.pg_trgm_available,
      publicSchemaCreatePrivilege: row.public_schema_create_privilege,
      requiredPgTrgmVersion: CANONICAL_REQUIRED_PG_TRGM_VERSION,
      resetAuthority: row.reset_authority,
      roleOid: row.role_oid,
      serverEncoding: row.server_encoding,
      serverVersion: row.server_version,
    }),
  ).toUpperCase()
  const fingerprint = sha256(
    [
      row.system_identifier,
      row.database_oid,
      row.database_name,
      row.role_oid,
      capabilityDigest,
    ].join('|'),
  ).toUpperCase()
  return {
    capabilityDigest,
    databaseCollation: row.database_collation,
    databaseCreatePrivilege: row.database_create_privilege,
    databaseCtype: row.database_ctype,
    databaseLocale: row.database_locale,
    databaseName: row.database_name,
    databaseOid: row.database_oid,
    databaseOwnerMatchesRole: row.database_owner_matches_role,
    fingerprint,
    localeProvider: row.locale_provider,
    pgTrgmAvailable: row.pg_trgm_available,
    publicSchemaCreatePrivilege: row.public_schema_create_privilege,
    resetAuthority: row.reset_authority,
    roleOid: row.role_oid,
    serverEncoding: row.server_encoding,
    serverVersion: row.server_version,
    systemIdentifier: row.system_identifier,
  }
}

export async function assertCanonicalTarget(
  executor: CanonicalCatalogExecutor,
  authorization: CanonicalMigrationAuthorization,
) {
  const identity = await readCanonicalTargetIdentity(executor)
  const expectedDisposableAuthorization = buildCanonicalAuthorizationDigest(
    'disposable',
    authorization.targetFingerprint,
  )
  if (authorization.epoch !== CANONICAL_EPOCH) {
    throw new CanonicalEpochError(
      'EPOCH_AUTHORIZATION_MISMATCH',
      'Migration epoch authorization does not match',
    )
  }
  if (
    !/^[A-F0-9]{64}$/u.test(authorization.targetFingerprint) ||
    identity.fingerprint !== authorization.targetFingerprint
  ) {
    throw new CanonicalEpochError(
      'TARGET_FINGERPRINT_MISMATCH',
      'Connected target does not match the registered fingerprint',
    )
  }
  if (
    authorization.disposableAuthorization !== expectedDisposableAuthorization
  ) {
    throw new CanonicalEpochError(
      'DISPOSABLE_AUTHORIZATION_MISMATCH',
      'Disposable target authorization does not match',
    )
  }
  if (
    identity.serverVersion !== CANONICAL_REQUIRED_POSTGRESQL_VERSION ||
    identity.serverEncoding !== 'UTF8' ||
    !identity.databaseOwnerMatchesRole ||
    !identity.databaseCreatePrivilege ||
    !identity.publicSchemaCreatePrivilege ||
    !identity.pgTrgmAvailable ||
    !identity.resetAuthority
  ) {
    throw new CanonicalEpochError(
      'TARGET_CAPABILITY_MISMATCH',
      'Connected target does not satisfy the frozen capability contract',
    )
  }
  return identity
}

export async function collectCanonicalCatalog(
  executor: CanonicalCatalogExecutor,
  roleOid: string,
): Promise<{ catalog: CanonicalCatalog; journal: CanonicalJournal }> {
  await assertOwnerPolicy(executor, roleOid)
  const catalog = {} as CanonicalCatalog
  for (const key of CATALOG_KEYS) {
    catalog[key] = await queryJsonRows(executor, getCatalogSql()[key])
  }
  const journal = await readCanonicalJournal(executor)
  assertCatalogPolicy(catalog, journal)
  return { catalog, journal }
}

export function buildCanonicalManifest(
  catalog: CanonicalCatalog,
  journal: CanonicalJournal,
): CanonicalCatalogManifest {
  const catalogWithoutComments = {
    ...catalog,
    comments: [],
  }
  const manifest: CanonicalCatalogManifest = {
    catalog,
    commentsDigest: sha256(canonicalJson(catalog.comments)),
    epoch: CANONICAL_EPOCH,
    inputs: readCanonicalStaticInputs(),
    journal,
    manifestVersion: CANONICAL_MANIFEST_VERSION,
    ownerPolicy: CANONICAL_OWNER_POLICY,
    requiredPgTrgmVersion: CANONICAL_REQUIRED_PG_TRGM_VERSION,
    requiredPostgreSqlVersion: CANONICAL_REQUIRED_POSTGRESQL_VERSION,
    structureDigest: sha256(
      canonicalJson({ catalog: catalogWithoutComments, journal }),
    ),
  }
  assertCanonicalManifestDigests(manifest)
  return manifest
}

/** 验证清单内嵌的 comments/structure 摘要来自同一份内容。 */
export function assertCanonicalManifestDigests(
  manifest: CanonicalCatalogManifest,
) {
  const expectedCommentsDigest = sha256(
    canonicalJson(manifest.catalog.comments),
  )
  const expectedStructureDigest = sha256(
    canonicalJson({
      catalog: { ...manifest.catalog, comments: [] },
      journal: manifest.journal,
    }),
  )
  if (
    manifest.commentsDigest !== expectedCommentsDigest ||
    manifest.structureDigest !== expectedStructureDigest
  ) {
    throw new CanonicalEpochError(
      'MANIFEST_DIGEST_MISMATCH',
      'Canonical manifest self-digests do not match its catalog content',
    )
  }
}

export async function classifyCanonicalEpoch(
  executor: CanonicalCatalogExecutor,
  authorization: CanonicalMigrationAuthorization,
): Promise<CanonicalClassification> {
  const expected = readCanonicalManifest()
  const manifestDigest = getCanonicalManifestDigest(expected)
  const base = {
    commentsDigest: expected.commentsDigest,
    commentsRepairAllowed: false,
    journalCount: 0,
    manifestDigest,
    manifestVersion: CANONICAL_MANIFEST_VERSION,
    requiredPgTrgmVersion: CANONICAL_REQUIRED_PG_TRGM_VERSION,
    structureDigest: expected.structureDigest,
    targetFingerprint: authorization.targetFingerprint,
  } as const

  try {
    readCanonicalEpochPolicy()
    assertCanonicalStaticInputs(expected)
    const identity = await assertCanonicalTarget(executor, authorization)
    const journalExists = await relationExists(
      executor,
      'public.__drizzle_migrations__',
    )
    if (!journalExists) {
      await assertNewCatalog(executor, identity.roleOid, expected)
      const expectedInitializeAuthorization = buildCanonicalAuthorizationDigest(
        'initialize',
        authorization.targetFingerprint,
      )
      if (
        authorization.initializeAuthorization !==
        expectedInitializeAuthorization
      ) {
        throw new CanonicalEpochError(
          'INITIALIZE_AUTHORIZATION_MISMATCH',
          'NEW target initialization authorization does not match',
        )
      }
      return {
        ...base,
        state: 'NEW',
      }
    }

    const collected = await collectCanonicalCatalog(executor, identity.roleOid)
    const actual = buildCanonicalManifest(collected.catalog, collected.journal)
    const actualBytes = renderCanonicalManifest(actual)
    const expectedBytes = renderCanonicalManifest(expected)
    if (actualBytes === expectedBytes) {
      return {
        ...base,
        commentsDigest: actual.commentsDigest,
        journalCount: 1,
        state: 'CURRENT',
        structureDigest: actual.structureDigest,
      }
    }

    const actualWithExpectedComments: CanonicalCatalogManifest = {
      ...actual,
      catalog: {
        ...actual.catalog,
        comments: expected.catalog.comments,
      },
      commentsDigest: expected.commentsDigest,
    }
    if (renderCanonicalManifest(actualWithExpectedComments) === expectedBytes) {
      return {
        ...base,
        commentsDigest: actual.commentsDigest,
        commentsRepairAllowed: true,
        journalCount: 1,
        reasonCode: 'COMMENTS_DIGEST_MISMATCH',
        state: 'REJECT',
        structureDigest: actual.structureDigest,
      }
    }
    throw new CanonicalEpochError(
      'CATALOG_DRIFT',
      'Connected catalog does not match the canonical manifest',
    )
  } catch (error) {
    const reasonCode =
      error instanceof CanonicalEpochError
        ? error.reasonCode
        : 'CATALOG_CLASSIFICATION_FAILED'
    return {
      ...base,
      reasonCode,
      state: 'REJECT',
    }
  }
}

async function assertNewCatalog(
  executor: CanonicalCatalogExecutor,
  roleOid: string,
  expected: CanonicalCatalogManifest,
) {
  await assertOwnerPolicy(executor, roleOid)
  const unexpectedObjects = await queryJsonRows(
    executor,
    getNewPublicObjectsSql(),
  )
  const unsupportedCatalogStates = await queryJsonRows(
    executor,
    getCatalogSql().unsupportedCatalogStates,
  )
  if (unexpectedObjects.length > 0 || unsupportedCatalogStates.length > 0) {
    throw new CanonicalEpochError(
      'NEW_CATALOG_NOT_EMPTY',
      'NEW target contains non-extension public objects',
    )
  }
  const actualExtensions = await queryJsonRows(
    executor,
    getCatalogSql().extensions,
  )
  const expectedWithoutPgTrgm = expected.catalog.extensions.filter(
    (extension) => extension.name !== 'pg_trgm',
  )
  const expectedWithPgTrgm = expected.catalog.extensions
  const actualBytes = canonicalJson(actualExtensions)
  if (
    actualBytes !== canonicalJson(expectedWithoutPgTrgm) &&
    actualBytes !== canonicalJson(expectedWithPgTrgm)
  ) {
    throw new CanonicalEpochError(
      'NEW_EXTENSION_STATE_INVALID',
      'NEW target extension state is not permitted',
    )
  }
}

async function assertOwnerPolicy(
  executor: CanonicalCatalogExecutor,
  roleOid: string,
) {
  const result = await executor.query<ScalarRow>(
    `SELECT pg_catalog.pg_describe_object(violation.classid, violation.objid, 0) AS value
     FROM (
       SELECT 'pg_class'::regclass::oid AS classid, class_record.oid AS objid
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'p', 'S', 'v', 'm', 'i')
         AND class_record.relowner <> $1::oid
       UNION ALL
       SELECT 'pg_extension'::regclass::oid AS classid, extension_record.oid AS objid
       FROM pg_catalog.pg_extension AS extension_record
       WHERE extension_record.extowner <> $1::oid
       UNION ALL
       SELECT 'pg_collation'::regclass::oid AS classid, collation_record.oid AS objid
       FROM pg_catalog.pg_collation AS collation_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = collation_record.collnamespace
       WHERE namespace_record.nspname = 'public'
         AND collation_record.collowner <> $1::oid
       UNION ALL
       SELECT 'pg_conversion'::regclass::oid AS classid, conversion_record.oid AS objid
       FROM pg_catalog.pg_conversion AS conversion_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = conversion_record.connamespace
       WHERE namespace_record.nspname = 'public'
         AND conversion_record.conowner <> $1::oid
       UNION ALL
       SELECT 'pg_ts_config'::regclass::oid AS classid, configuration_record.oid AS objid
       FROM pg_catalog.pg_ts_config AS configuration_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = configuration_record.cfgnamespace
       WHERE namespace_record.nspname = 'public'
         AND configuration_record.cfgowner <> $1::oid
       UNION ALL
       SELECT 'pg_ts_dict'::regclass::oid AS classid, dictionary_record.oid AS objid
       FROM pg_catalog.pg_ts_dict AS dictionary_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = dictionary_record.dictnamespace
       WHERE namespace_record.nspname = 'public'
         AND dictionary_record.dictowner <> $1::oid
       UNION ALL
       SELECT 'pg_statistic_ext'::regclass::oid AS classid, statistics_record.oid AS objid
       FROM pg_catalog.pg_statistic_ext AS statistics_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = statistics_record.stxnamespace
       WHERE namespace_record.nspname = 'public'
         AND statistics_record.stxowner <> $1::oid
       UNION ALL
       SELECT 'pg_operator'::regclass::oid AS classid, operator_record.oid AS objid
       FROM pg_catalog.pg_operator AS operator_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = operator_record.oprnamespace
       WHERE namespace_record.nspname = 'public'
         AND operator_record.oprowner <> $1::oid
       UNION ALL
       SELECT 'pg_opclass'::regclass::oid AS classid, opclass_record.oid AS objid
       FROM pg_catalog.pg_opclass AS opclass_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = opclass_record.opcnamespace
       WHERE namespace_record.nspname = 'public'
         AND opclass_record.opcowner <> $1::oid
       UNION ALL
       SELECT 'pg_opfamily'::regclass::oid AS classid, family_record.oid AS objid
       FROM pg_catalog.pg_opfamily AS family_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = family_record.opfnamespace
       WHERE namespace_record.nspname = 'public'
         AND family_record.opfowner <> $1::oid
       UNION ALL
       SELECT 'pg_type'::regclass::oid AS classid, type_record.oid AS objid
       FROM pg_catalog.pg_type AS type_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = type_record.typnamespace
       WHERE namespace_record.nspname = 'public'
         AND type_record.typowner <> $1::oid
       UNION ALL
       SELECT 'pg_proc'::regclass::oid AS classid, procedure_record.oid AS objid
       FROM pg_catalog.pg_proc AS procedure_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = procedure_record.pronamespace
       WHERE namespace_record.nspname = 'public'
         AND procedure_record.proowner <> $1::oid
       UNION ALL
       SELECT 'pg_language'::regclass::oid AS classid, language_record.oid AS objid
       FROM pg_catalog.pg_language AS language_record
       INNER JOIN pg_catalog.pg_depend AS dependency_record
         ON dependency_record.classid = 'pg_language'::regclass
        AND dependency_record.objid = language_record.oid
        AND dependency_record.objsubid = 0
        AND dependency_record.refclassid = 'pg_extension'::regclass
        AND dependency_record.deptype = 'e'
       WHERE language_record.lanowner <> $1::oid
     ) AS violation
     ORDER BY value`,
    [roleOid],
  )
  if (result.rows.length > 0) {
    throw new CanonicalEpochError(
      'OWNER_POLICY_MISMATCH',
      'Catalog owner OID does not match the registered migration role',
    )
  }
}

async function readCanonicalJournal(
  executor: CanonicalCatalogExecutor,
): Promise<CanonicalJournal> {
  const result = await executor.query<JournalRow>(
    `SELECT hash, created_at::text AS created_at, name
     FROM public.__drizzle_migrations__
     ORDER BY id`,
  )
  const expected = expectedJournal()
  const row = result.rows[0]
  if (
    result.rows.length !== 1 ||
    !row ||
    row.hash !== expected.hash ||
    row.created_at !== expected.createdAt ||
    row.name !== expected.name
  ) {
    throw new CanonicalEpochError(
      'JOURNAL_MISMATCH',
      'Migration journal does not identify the canonical baseline exactly',
    )
  }
  return expected
}

function expectedJournal(): CanonicalJournal {
  const prefix = CANONICAL_EPOCH.slice(0, 14)
  const createdAt = Date.UTC(
    Number(prefix.slice(0, 4)),
    Number(prefix.slice(4, 6)) - 1,
    Number(prefix.slice(6, 8)),
    Number(prefix.slice(8, 10)),
    Number(prefix.slice(10, 12)),
    Number(prefix.slice(12, 14)),
  ).toString()
  return {
    createdAt,
    hash: hashCanonicalTextFile(BASELINE_SQL_PATH),
    name: CANONICAL_EPOCH,
    rowCount: 1,
  }
}

function assertCatalogPolicy(
  catalog: CanonicalCatalog,
  journal: CanonicalJournal,
) {
  const policy = readCanonicalEpochPolicy()
  if (journal.rowCount !== 1) {
    throw new CanonicalEpochError(
      'JOURNAL_MISMATCH',
      'Canonical journal row count must be one',
    )
  }
  if (catalog.constraints.some((item) => item.type === 'f')) {
    throw new CanonicalEpochError(
      'FOREIGN_KEY_FORBIDDEN',
      'Canonical catalog contains a foreign key',
    )
  }
  if (catalog.routines.length > 0) {
    throw new CanonicalEpochError(
      'BUSINESS_ROUTINE_FORBIDDEN',
      'Canonical catalog contains a non-extension routine',
    )
  }
  if (catalog.triggers.length > 0) {
    throw new CanonicalEpochError(
      'TRIGGER_FORBIDDEN',
      'Canonical catalog contains a non-extension trigger',
    )
  }
  if (catalog.unsupportedCatalogStates.length > 0) {
    throw new CanonicalEpochError(
      'UNSUPPORTED_CATALOG_STATE',
      'Canonical catalog contains an unsupported advanced or privilege state',
    )
  }
  const routineNames = new Set(
    catalog.routines.map((item) => String(item.name)),
  )
  const triggerNames = new Set(
    catalog.triggers.map((item) => String(item.name)),
  )
  if (
    policy.retiredFunctions.some((name) => routineNames.has(name)) ||
    policy.retiredTriggers.some((name) => triggerNames.has(name))
  ) {
    throw new CanonicalEpochError(
      'RETIRED_OBJECT_PRESENT',
      'A retired database object is present',
    )
  }
  const extensionNames = catalog.extensions.map((item) => item.name)
  if (canonicalJson(extensionNames) !== canonicalJson(['pg_trgm', 'plpgsql'])) {
    throw new CanonicalEpochError(
      'EXTENSION_SET_MISMATCH',
      'Canonical catalog extension set is not exact',
    )
  }
  const pgTrgm = catalog.extensions.find((item) => item.name === 'pg_trgm')
  if (
    pgTrgm?.schema !== 'public' ||
    pgTrgm.version !== CANONICAL_REQUIRED_PG_TRGM_VERSION ||
    pgTrgm.owner !== CANONICAL_OWNER_POLICY
  ) {
    throw new CanonicalEpochError(
      'PG_TRGM_MISMATCH',
      'pg_trgm does not match the frozen extension contract',
    )
  }
  const allowedExtensionMemberCatalogs = new Set([
    'pg_language',
    'pg_opclass',
    'pg_operator',
    'pg_opfamily',
    'pg_proc',
    'pg_type',
  ])
  if (
    catalog.extensionMembers.some(
      (member) =>
        !allowedExtensionMemberCatalogs.has(String(member.catalog)),
    )
  ) {
    throw new CanonicalEpochError(
      'EXTENSION_MEMBER_CATALOG_UNSUPPORTED',
      'An extension member belongs to a catalog without a frozen definition surface',
    )
  }
  const memberAddress = (member: CatalogRecord) =>
    canonicalJson([
      member.extension,
      member.catalog,
      member.objectType,
      member.objectNames,
      member.objectArguments,
    ])
  const addresses = catalog.extensionMembers.map(memberAddress).sort()
  const definitionAddresses = catalog.extensionMemberDefinitions
    .map(memberAddress)
    .sort()
  if (canonicalJson(addresses) !== canonicalJson(definitionAddresses)) {
    throw new CanonicalEpochError(
      'EXTENSION_MEMBER_DEFINITION_INCOMPLETE',
      'Every direct extension member must have exactly one frozen definition',
    )
  }
}

function assertManifestShape(manifest: CanonicalCatalogManifest) {
  assertExactKeys(
    manifest,
    [
      'catalog',
      'commentsDigest',
      'epoch',
      'inputs',
      'journal',
      'manifestVersion',
      'ownerPolicy',
      'requiredPgTrgmVersion',
      'requiredPostgreSqlVersion',
      'structureDigest',
    ],
    'catalog manifest',
  )
  assertExactKeys(
    manifest.inputs,
    [
      'baselineSqlSha256',
      'catalogGeneratorSha256',
      'commentsSqlSha256',
      'epochPolicySha256',
      'schemaSourceSha256',
      'snapshotSha256',
    ],
    'catalog manifest inputs',
  )
  assertExactKeys(
    manifest.catalog,
    [...CATALOG_KEYS],
    'catalog manifest catalog',
  )
  assertExactKeys(
    manifest.journal,
    ['createdAt', 'hash', 'name', 'rowCount'],
    'catalog manifest journal',
  )
  if (
    !isLowerSha256(manifest.commentsDigest) ||
    !isLowerSha256(manifest.structureDigest) ||
    Object.values(manifest.inputs).some((digest) => !isLowerSha256(digest))
  ) {
    throw new CanonicalEpochError(
      'MANIFEST_INVALID',
      'Canonical catalog manifest contains an invalid digest',
    )
  }
  for (const key of CATALOG_KEYS) {
    if (!Array.isArray(manifest.catalog[key])) {
      throw new CanonicalEpochError(
        'MANIFEST_INVALID',
        `Catalog manifest category is not an array: ${key}`,
      )
    }
  }
}

function isLowerSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}

function assertExactKeys(value: object, expectedKeys: string[], label: string) {
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new CanonicalEpochError(
      'CONTRACT_KEYS_INVALID',
      `${label} keys do not match the current contract`,
    )
  }
}

async function relationExists(
  executor: CanonicalCatalogExecutor,
  qualifiedName: string,
) {
  const result = await executor.query<ExistsRow>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [qualifiedName],
  )
  return result.rows[0]?.exists === true
}

async function queryJsonRows(executor: CanonicalCatalogExecutor, sql: string) {
  const result = await executor.query<JsonRow>(sql)
  return result.rows.map((row) => row.value)
}

function parseJsonFile<T>(path: string, reasonCode: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    throw new CanonicalEpochError(
      reasonCode,
      'Unable to read canonical JSON input',
    )
  }
}

function listFiles(directory: string, suffix?: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...listFiles(path, suffix))
    } else if (entry.isFile() && (!suffix || entry.name.endsWith(suffix))) {
      result.push(path)
    }
  }
  return result.sort(compareCanonicalStrings)
}

function digestFiles(paths: string[]) {
  const hash = createHash('sha256')
  for (const path of paths) {
    if (!statSync(path).isFile()) {
      throw new CanonicalEpochError(
        'MANIFEST_INPUT_MISSING',
        'Canonical manifest input is not a file',
      )
    }
    hash.update(relative(REPOSITORY_ROOT, path).replaceAll('\\', '/'))
    hash.update(HASH_SEPARATOR)
    hash.update(normalizeNewlines(readFileSync(path, 'utf8')))
    hash.update(HASH_SEPARATOR)
  }
  return hash.digest('hex')
}

function canonicalJson(value: unknown) {
  return JSON.stringify(value)
}

function compareCanonicalStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/gu, '\n')
}

function hashCanonicalTextFile(path: string) {
  return sha256(normalizeNewlines(readFileSync(path, 'utf8')))
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

const EXTENSION_DEPENDENCY_FILTER = `
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_depend AS extension_dependency
    WHERE extension_dependency.classid = '%CATALOG%'::regclass
      AND extension_dependency.objid = %OID%
      AND extension_dependency.objsubid = 0
      AND extension_dependency.refclassid = 'pg_extension'::regclass
      AND extension_dependency.deptype = 'e'
  )`

function withoutExtensionMembers(
  sql: string,
  catalog: string,
  oidExpression: string,
) {
  return sql.replaceAll(
    '%EXTENSION_FILTER%',
    EXTENSION_DEPENDENCY_FILTER.replace('%CATALOG%', catalog).replace(
      '%OID%',
      oidExpression,
    ),
  )
}

const CATALOG_SQL: Record<CatalogKey, string> = {
  tables: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', class_record.relname,
       'kind', class_record.relkind,
       'persistence', class_record.relpersistence,
       'replicaIdentity', class_record.relreplident,
       'rowSecurity', class_record.relrowsecurity,
       'forceRowSecurity', class_record.relforcerowsecurity,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_class AS class_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND class_record.relkind IN ('r', 'p')
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname`,
    'pg_class',
    'class_record.oid',
  ),
  columns: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'position', attribute_record.attnum::text,
       'name', attribute_record.attname,
       'type', pg_catalog.format_type(attribute_record.atttypid, attribute_record.atttypmod),
       'notNull', attribute_record.attnotnull,
       'identity', attribute_record.attidentity,
       'generated', attribute_record.attgenerated,
       'default', pg_catalog.pg_get_expr(default_record.adbin, default_record.adrelid, true),
       'collation', collation_record.collname
     ) AS value
     FROM pg_catalog.pg_attribute AS attribute_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = attribute_record.attrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     LEFT JOIN pg_catalog.pg_attrdef AS default_record
       ON default_record.adrelid = class_record.oid
      AND default_record.adnum = attribute_record.attnum
     LEFT JOIN pg_catalog.pg_collation AS collation_record
       ON collation_record.oid = attribute_record.attcollation
     WHERE namespace_record.nspname = 'public'
       AND class_record.relkind IN ('r', 'p', 'v', 'm')
       AND attribute_record.attnum > 0
       AND NOT attribute_record.attisdropped
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname, attribute_record.attnum`,
    'pg_class',
    'class_record.oid',
  ),
  sequences: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', class_record.relname,
       'dataType', pg_catalog.format_type(sequence_record.seqtypid, NULL),
       'start', sequence_record.seqstart::text,
       'minimum', sequence_record.seqmin::text,
       'maximum', sequence_record.seqmax::text,
       'increment', sequence_record.seqincrement::text,
       'cycle', sequence_record.seqcycle,
       'cache', sequence_record.seqcache::text,
       'ownershipDependencyType', ownership_record.dependency_type,
       'ownedBySchema', ownership_record.schema_name,
       'ownedByRelation', ownership_record.relation_name,
       'ownedByColumn', ownership_record.column_name,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_class AS class_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     INNER JOIN pg_catalog.pg_sequence AS sequence_record
       ON sequence_record.seqrelid = class_record.oid
     LEFT JOIN LATERAL (
       SELECT dependency_record.deptype AS dependency_type,
         owner_namespace.nspname AS schema_name,
         owner_class.relname AS relation_name,
         owner_attribute.attname AS column_name
       FROM pg_catalog.pg_depend AS dependency_record
       INNER JOIN pg_catalog.pg_class AS owner_class
         ON owner_class.oid = dependency_record.refobjid
       INNER JOIN pg_catalog.pg_namespace AS owner_namespace
         ON owner_namespace.oid = owner_class.relnamespace
       INNER JOIN pg_catalog.pg_attribute AS owner_attribute
         ON owner_attribute.attrelid = dependency_record.refobjid
        AND owner_attribute.attnum = dependency_record.refobjsubid
       WHERE dependency_record.classid = 'pg_class'::regclass
         AND dependency_record.objid = class_record.oid
         AND dependency_record.objsubid = 0
         AND dependency_record.refclassid = 'pg_class'::regclass
         AND dependency_record.deptype IN ('a', 'i')
       ORDER BY dependency_record.deptype
       LIMIT 1
     ) AS ownership_record ON true
     WHERE namespace_record.nspname = 'public'
       AND class_record.relkind = 'S'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname`,
    'pg_class',
    'class_record.oid',
  ),
  constraints: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'name', constraint_record.conname,
       'type', constraint_record.contype,
       'definition', pg_catalog.pg_get_constraintdef(constraint_record.oid, true),
       'deferrable', constraint_record.condeferrable,
       'deferred', constraint_record.condeferred,
       'validated', constraint_record.convalidated,
       'noInherit', constraint_record.connoinherit
     ) AS value
     FROM pg_catalog.pg_constraint AS constraint_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = constraint_record.conrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND constraint_record.contype IN ('c', 'p', 'u', 'f', 'x')
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname, constraint_record.conname`,
    'pg_constraint',
    'constraint_record.oid',
  ),
  indexes: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', table_record.relname,
       'name', index_class.relname,
       'method', access_method.amname,
       'definition', pg_catalog.pg_get_indexdef(index_record.indexrelid, 0, true),
       'expressions', pg_catalog.pg_get_expr(index_record.indexprs, index_record.indrelid, true),
       'predicate', pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid, true),
       'opclasses', ARRAY(
         SELECT opclass_namespace.nspname || '.' || opclass_record.opcname
         FROM unnest(index_record.indclass::oid[]) WITH ORDINALITY
           AS opclass_item(opclass_oid, position)
         INNER JOIN pg_catalog.pg_opclass AS opclass_record
           ON opclass_record.oid = opclass_item.opclass_oid
         INNER JOIN pg_catalog.pg_namespace AS opclass_namespace
           ON opclass_namespace.oid = opclass_record.opcnamespace
         ORDER BY opclass_item.position
       ),
       'keyAttributeCount', index_record.indnkeyatts::text,
       'attributeCount', index_record.indnatts::text,
       'unique', index_record.indisunique,
       'primary', index_record.indisprimary,
       'valid', index_record.indisvalid,
       'ready', index_record.indisready,
       'clustered', index_record.indisclustered,
       'replicaIdentity', index_record.indisreplident
     ) AS value
     FROM pg_catalog.pg_index AS index_record
     INNER JOIN pg_catalog.pg_class AS index_class
       ON index_class.oid = index_record.indexrelid
     INNER JOIN pg_catalog.pg_class AS table_record
       ON table_record.oid = index_record.indrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = table_record.relnamespace
     INNER JOIN pg_catalog.pg_am AS access_method
       ON access_method.oid = index_class.relam
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, table_record.relname, index_class.relname`,
    'pg_class',
    'index_class.oid',
  ),
  enums: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'type', type_record.typname,
       'label', enum_record.enumlabel,
       'sortOrder', enum_record.enumsortorder::text
     ) AS value
     FROM pg_catalog.pg_type AS type_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = type_record.typnamespace
     INNER JOIN pg_catalog.pg_enum AS enum_record
       ON enum_record.enumtypid = type_record.oid
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, type_record.typname, enum_record.enumsortorder`,
    'pg_type',
    'type_record.oid',
  ),
  domains: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', type_record.typname,
       'baseType', pg_catalog.format_type(type_record.typbasetype, type_record.typtypmod),
       'notNull', type_record.typnotnull,
       'default', type_record.typdefault,
       'collation', collation_record.collname
     ) AS value
     FROM pg_catalog.pg_type AS type_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = type_record.typnamespace
     LEFT JOIN pg_catalog.pg_collation AS collation_record
       ON collation_record.oid = type_record.typcollation
     WHERE namespace_record.nspname = 'public'
       AND type_record.typtype = 'd'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, type_record.typname`,
    'pg_type',
    'type_record.oid',
  ),
  types: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', type_record.typname,
       'kind', type_record.typtype,
       'category', type_record.typcategory,
       'preferred', type_record.typispreferred,
       'defined', type_record.typisdefined,
       'delimiter', type_record.typdelim,
       'elementType', CASE
         WHEN type_record.typelem = 0 THEN NULL
         ELSE pg_catalog.format_type(type_record.typelem, NULL)
       END,
       'arrayType', CASE
         WHEN type_record.typarray = 0 THEN NULL
         ELSE pg_catalog.format_type(type_record.typarray, NULL)
       END
     ) AS value
     FROM pg_catalog.pg_type AS type_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = type_record.typnamespace
     WHERE namespace_record.nspname = 'public'
       AND type_record.typtype NOT IN ('d', 'e')
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, type_record.typname`,
    'pg_type',
    'type_record.oid',
  ),
  views: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', class_record.relname,
       'definition', pg_catalog.pg_get_viewdef(class_record.oid, true),
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_class AS class_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND class_record.relkind = 'v'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname`,
    'pg_class',
    'class_record.oid',
  ),
  materializedViews: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', class_record.relname,
       'definition', pg_catalog.pg_get_viewdef(class_record.oid, true),
       'populated', class_record.relispopulated,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_class AS class_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND class_record.relkind = 'm'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname`,
    'pg_class',
    'class_record.oid',
  ),
  routines: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', procedure_record.proname,
       'identityArguments', pg_catalog.pg_get_function_identity_arguments(procedure_record.oid),
       'result', pg_catalog.pg_get_function_result(procedure_record.oid),
       'kind', procedure_record.prokind,
       'language', language_record.lanname,
       'volatility', procedure_record.provolatile,
       'securityDefiner', procedure_record.prosecdef,
       'parallel', procedure_record.proparallel,
       'definition', pg_catalog.pg_get_functiondef(procedure_record.oid)
     ) AS value
     FROM pg_catalog.pg_proc AS procedure_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = procedure_record.pronamespace
     INNER JOIN pg_catalog.pg_language AS language_record
       ON language_record.oid = procedure_record.prolang
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, procedure_record.proname,
       pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)`,
    'pg_proc',
    'procedure_record.oid',
  ),
  triggers: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'name', trigger_record.tgname,
       'definition', pg_catalog.pg_get_triggerdef(trigger_record.oid, true),
       'enabled', trigger_record.tgenabled
     ) AS value
     FROM pg_catalog.pg_trigger AS trigger_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = trigger_record.tgrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND NOT trigger_record.tgisinternal
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname, trigger_record.tgname`,
    'pg_trigger',
    'trigger_record.oid',
  ),
  rules: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'name', rewrite_record.rulename,
       'event', rewrite_record.ev_type,
       'instead', rewrite_record.is_instead,
       'definition', pg_catalog.pg_get_ruledef(rewrite_record.oid, true)
     ) AS value
     FROM pg_catalog.pg_rewrite AS rewrite_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = rewrite_record.ev_class
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       AND NOT (
         rewrite_record.rulename = '_RETURN'
         AND class_record.relkind IN ('v', 'm')
       )
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname,
       rewrite_record.rulename`,
    'pg_rewrite',
    'rewrite_record.oid',
  ),
  policies: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'name', policy_record.polname,
       'permissive', policy_record.polpermissive,
       'command', policy_record.polcmd,
       'roles', ARRAY(
         SELECT rendered_role.name
         FROM (
           SELECT CASE
             WHEN role_item.role_oid = 0 THEN 'PUBLIC'
             WHEN role_item.role_oid = current_user::regrole::oid
               THEN '$MIGRATION_ROLE'
             ELSE role_item.role_oid::regrole::text
           END AS name
           FROM unnest(policy_record.polroles) AS role_item(role_oid)
         ) AS rendered_role
         ORDER BY rendered_role.name
       ),
       'using', pg_catalog.pg_get_expr(
         policy_record.polqual,
         policy_record.polrelid,
         true
       ),
       'withCheck', pg_catalog.pg_get_expr(
         policy_record.polwithcheck,
         policy_record.polrelid,
         true
       )
     ) AS value
     FROM pg_catalog.pg_policy AS policy_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = policy_record.polrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = class_record.relnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, class_record.relname,
       policy_record.polname`,
    'pg_policy',
    'policy_record.oid',
  ),
  collations: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', collation_record.collname,
       'encoding', collation_record.collencoding::text,
       'provider', collation_record.collprovider,
       'deterministic', collation_record.collisdeterministic,
       'collate', collation_record.collcollate,
       'ctype', collation_record.collctype,
       'locale', collation_record.colllocale,
       'icuRules', collation_record.collicurules,
       'version', collation_record.collversion,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_collation AS collation_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = collation_record.collnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, collation_record.collname,
       collation_record.collencoding`,
    'pg_collation',
    'collation_record.oid',
  ),
  conversions: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', conversion_record.conname,
       'sourceEncoding', conversion_record.conforencoding::text,
       'targetEncoding', conversion_record.contoencoding::text,
       'procedure', conversion_record.conproc::regprocedure::text,
       'default', conversion_record.condefault,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_conversion AS conversion_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = conversion_record.connamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, conversion_record.conname`,
    'pg_conversion',
    'conversion_record.oid',
  ),
  textSearchConfigurations: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', configuration_record.cfgname,
       'parser', parser_namespace.nspname || '.' || parser_record.prsname,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_ts_config AS configuration_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = configuration_record.cfgnamespace
     INNER JOIN pg_catalog.pg_ts_parser AS parser_record
       ON parser_record.oid = configuration_record.cfgparser
     INNER JOIN pg_catalog.pg_namespace AS parser_namespace
       ON parser_namespace.oid = parser_record.prsnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, configuration_record.cfgname`,
    'pg_ts_config',
    'configuration_record.oid',
  ),
  textSearchConfigurationMappings: withoutExtensionMembers(
    `SELECT json_build_object(
       'configurationSchema', configuration_namespace.nspname,
       'configuration', configuration_record.cfgname,
       'tokenType', mapping_record.maptokentype::text,
       'sequence', mapping_record.mapseqno::text,
       'dictionarySchema', dictionary_namespace.nspname,
       'dictionary', dictionary_record.dictname
     ) AS value
     FROM pg_catalog.pg_ts_config_map AS mapping_record
     INNER JOIN pg_catalog.pg_ts_config AS configuration_record
       ON configuration_record.oid = mapping_record.mapcfg
     INNER JOIN pg_catalog.pg_namespace AS configuration_namespace
       ON configuration_namespace.oid = configuration_record.cfgnamespace
     INNER JOIN pg_catalog.pg_ts_dict AS dictionary_record
       ON dictionary_record.oid = mapping_record.mapdict
     INNER JOIN pg_catalog.pg_namespace AS dictionary_namespace
       ON dictionary_namespace.oid = dictionary_record.dictnamespace
     WHERE configuration_namespace.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY configuration_namespace.nspname, configuration_record.cfgname,
       mapping_record.maptokentype, mapping_record.mapseqno`,
    'pg_ts_config',
    'configuration_record.oid',
  ),
  textSearchDictionaries: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', dictionary_record.dictname,
       'template', template_namespace.nspname || '.' || template_record.tmplname,
       'options', dictionary_record.dictinitoption,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_ts_dict AS dictionary_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = dictionary_record.dictnamespace
     INNER JOIN pg_catalog.pg_ts_template AS template_record
       ON template_record.oid = dictionary_record.dicttemplate
     INNER JOIN pg_catalog.pg_namespace AS template_namespace
       ON template_namespace.oid = template_record.tmplnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, dictionary_record.dictname`,
    'pg_ts_dict',
    'dictionary_record.oid',
  ),
  textSearchParsers: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', parser_record.prsname,
       'start', parser_record.prsstart::regprocedure::text,
       'token', parser_record.prstoken::regprocedure::text,
       'end', parser_record.prsend::regprocedure::text,
       'headline', CASE
         WHEN parser_record.prsheadline = 0 THEN NULL
         ELSE parser_record.prsheadline::regprocedure::text
       END,
       'lexTypes', parser_record.prslextype::regprocedure::text
     ) AS value
     FROM pg_catalog.pg_ts_parser AS parser_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = parser_record.prsnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, parser_record.prsname`,
    'pg_ts_parser',
    'parser_record.oid',
  ),
  textSearchTemplates: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', template_record.tmplname,
       'initialize', CASE
         WHEN template_record.tmplinit = 0 THEN NULL
         ELSE template_record.tmplinit::regprocedure::text
       END,
       'lexize', template_record.tmpllexize::regprocedure::text
     ) AS value
     FROM pg_catalog.pg_ts_template AS template_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = template_record.tmplnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, template_record.tmplname`,
    'pg_ts_template',
    'template_record.oid',
  ),
  extendedStatistics: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'relation', class_record.relname,
       'name', statistics_record.stxname,
       'definition', pg_catalog.pg_get_statisticsobjdef(statistics_record.oid),
       'kinds', statistics_record.stxkind,
       'target', statistics_record.stxstattarget::text,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_statistic_ext AS statistics_record
     INNER JOIN pg_catalog.pg_class AS class_record
       ON class_record.oid = statistics_record.stxrelid
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = statistics_record.stxnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, statistics_record.stxname`,
    'pg_statistic_ext',
    'statistics_record.oid',
  ),
  operators: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', operator_record.oprname,
       'kind', operator_record.oprkind,
       'leftType', pg_catalog.format_type(operator_record.oprleft, NULL),
       'rightType', pg_catalog.format_type(operator_record.oprright, NULL),
       'resultType', pg_catalog.format_type(operator_record.oprresult, NULL),
       'procedure', operator_record.oprcode::regprocedure::text,
       'commutator', CASE
         WHEN operator_record.oprcom = 0 THEN NULL
         ELSE operator_record.oprcom::regoperator::text
       END,
       'negator', CASE
         WHEN operator_record.oprnegate = 0 THEN NULL
         ELSE operator_record.oprnegate::regoperator::text
       END,
       'canMerge', operator_record.oprcanmerge,
       'canHash', operator_record.oprcanhash,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_operator AS operator_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = operator_record.oprnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, operator_record.oprname,
       operator_record.oprleft, operator_record.oprright`,
    'pg_operator',
    'operator_record.oid',
  ),
  operatorClasses: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', opclass_record.opcname,
       'method', access_method.amname,
       'familySchema', family_namespace.nspname,
       'family', family_record.opfname,
       'inputType', pg_catalog.format_type(opclass_record.opcintype, NULL),
       'default', opclass_record.opcdefault,
       'keyType', CASE
         WHEN opclass_record.opckeytype = 0 THEN NULL
         ELSE pg_catalog.format_type(opclass_record.opckeytype, NULL)
       END,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_opclass AS opclass_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = opclass_record.opcnamespace
     INNER JOIN pg_catalog.pg_am AS access_method
       ON access_method.oid = opclass_record.opcmethod
     INNER JOIN pg_catalog.pg_opfamily AS family_record
       ON family_record.oid = opclass_record.opcfamily
     INNER JOIN pg_catalog.pg_namespace AS family_namespace
       ON family_namespace.oid = family_record.opfnamespace
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, opclass_record.opcname,
       access_method.amname`,
    'pg_opclass',
    'opclass_record.oid',
  ),
  operatorFamilies: withoutExtensionMembers(
    `SELECT json_build_object(
       'schema', namespace_record.nspname,
       'name', family_record.opfname,
       'method', access_method.amname,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_opfamily AS family_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = family_record.opfnamespace
     INNER JOIN pg_catalog.pg_am AS access_method
       ON access_method.oid = family_record.opfmethod
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, family_record.opfname,
       access_method.amname`,
    'pg_opfamily',
    'family_record.oid',
  ),
  operatorFamilyOperators: withoutExtensionMembers(
    `SELECT json_build_object(
       'familySchema', namespace_record.nspname,
       'family', family_record.opfname,
       'method', access_method.amname,
       'strategy', family_operator.amopstrategy::text,
       'purpose', family_operator.amoppurpose,
       'leftType', pg_catalog.format_type(family_operator.amoplefttype, NULL),
       'rightType', pg_catalog.format_type(family_operator.amoprighttype, NULL),
       'operator', family_operator.amopopr::regoperator::text,
       'sortFamily', CASE
         WHEN family_operator.amopsortfamily = 0 THEN NULL
         ELSE json_build_object(
           'schema', sort_family_namespace.nspname,
           'name', sort_family.opfname,
           'method', sort_access_method.amname
         )
       END
     ) AS value
     FROM pg_catalog.pg_amop AS family_operator
     INNER JOIN pg_catalog.pg_opfamily AS family_record
       ON family_record.oid = family_operator.amopfamily
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = family_record.opfnamespace
     INNER JOIN pg_catalog.pg_am AS access_method
       ON access_method.oid = family_record.opfmethod
     LEFT JOIN pg_catalog.pg_opfamily AS sort_family
       ON sort_family.oid = family_operator.amopsortfamily
     LEFT JOIN pg_catalog.pg_namespace AS sort_family_namespace
       ON sort_family_namespace.oid = sort_family.opfnamespace
     LEFT JOIN pg_catalog.pg_am AS sort_access_method
       ON sort_access_method.oid = sort_family.opfmethod
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, family_record.opfname,
       family_operator.amopstrategy, family_operator.amoplefttype,
       family_operator.amoprighttype`,
    'pg_opfamily',
    'family_record.oid',
  ),
  operatorFamilyProcedures: withoutExtensionMembers(
    `SELECT json_build_object(
       'familySchema', namespace_record.nspname,
       'family', family_record.opfname,
       'method', access_method.amname,
       'procedureNumber', family_procedure.amprocnum::text,
       'leftType', pg_catalog.format_type(family_procedure.amproclefttype, NULL),
       'rightType', pg_catalog.format_type(family_procedure.amprocrighttype, NULL),
       'procedure', family_procedure.amproc::regprocedure::text
     ) AS value
     FROM pg_catalog.pg_amproc AS family_procedure
     INNER JOIN pg_catalog.pg_opfamily AS family_record
       ON family_record.oid = family_procedure.amprocfamily
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = family_record.opfnamespace
     INNER JOIN pg_catalog.pg_am AS access_method
       ON access_method.oid = family_record.opfmethod
     WHERE namespace_record.nspname = 'public'
       %EXTENSION_FILTER%
     ORDER BY namespace_record.nspname, family_record.opfname,
       family_procedure.amprocnum, family_procedure.amproclefttype,
       family_procedure.amprocrighttype`,
    'pg_opfamily',
    'family_record.oid',
  ),
  unsupportedCatalogStates: `SELECT json_build_object(
       'kind', unsupported.kind,
       'identity', unsupported.identity
     ) AS value
     FROM (
       SELECT 'advanced-type' AS kind,
         namespace_record.nspname || '.' || type_record.typname AS identity
       FROM pg_catalog.pg_type AS type_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = type_record.typnamespace
       LEFT JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = type_record.typrelid
       WHERE namespace_record.nspname = 'public'
         AND (
           type_record.typtype IN ('d', 'r')
           OR (type_record.typtype = 'c' AND class_record.relkind = 'c')
         )
       UNION ALL
       SELECT 'partition-or-foreign-relation',
         namespace_record.nspname || '.' || class_record.relname
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND (class_record.relkind IN ('p', 'f') OR class_record.relispartition)
       UNION ALL
       SELECT 'relation-inheritance',
         child_namespace.nspname || '.' || child_record.relname
       FROM pg_catalog.pg_inherits AS inheritance_record
       INNER JOIN pg_catalog.pg_class AS child_record
         ON child_record.oid = inheritance_record.inhrelid
       INNER JOIN pg_catalog.pg_namespace AS child_namespace
         ON child_namespace.oid = child_record.relnamespace
       WHERE child_namespace.nspname = 'public'
       UNION ALL
       SELECT 'relation-acl',
         namespace_record.nspname || '.' || class_record.relname
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relacl IS NOT NULL
       UNION ALL
       SELECT 'column-acl',
         namespace_record.nspname || '.' || class_record.relname || '.' ||
           attribute_record.attname
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND attribute_record.attacl IS NOT NULL
       UNION ALL
       SELECT 'public-schema-acl',
         namespace_record.nspname
       FROM pg_catalog.pg_namespace AS namespace_record
       WHERE namespace_record.nspname = 'public'
         AND namespace_record.nspacl IS NOT NULL
       UNION ALL
       SELECT 'relation-storage-options',
         namespace_record.nspname || '.' || class_record.relname
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'p', 'S', 'v', 'm', 'i', 'I')
         AND class_record.reloptions IS NOT NULL
       UNION ALL
       SELECT 'relation-storage-options',
         namespace_record.nspname || '.' || parent_class.relname || ' [toast]'
       FROM pg_catalog.pg_class AS parent_class
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = parent_class.relnamespace
       INNER JOIN pg_catalog.pg_class AS toast_class
         ON toast_class.oid = parent_class.reltoastrelid
       WHERE namespace_record.nspname = 'public'
         AND toast_class.reloptions IS NOT NULL
       UNION ALL
       SELECT 'relation-tablespace',
         namespace_record.nspname || '.' || class_record.relname
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'p', 'S', 'v', 'm', 'i', 'I')
         AND class_record.reltablespace <> 0
       UNION ALL
       SELECT 'relation-access-method',
         namespace_record.nspname || '.' || class_record.relname
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       INNER JOIN pg_catalog.pg_am AS access_method
         ON access_method.oid = class_record.relam
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'm')
         AND access_method.amname <> 'heap'
       UNION ALL
       SELECT 'column-statistics-target',
         namespace_record.nspname || '.' || class_record.relname || '.' ||
           attribute_record.attname
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND attribute_record.attstattarget <> -1
       UNION ALL
       SELECT 'column-storage-override',
         namespace_record.nspname || '.' || class_record.relname || '.' ||
           attribute_record.attname
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       INNER JOIN pg_catalog.pg_type AS type_record
         ON type_record.oid = attribute_record.atttypid
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND attribute_record.attstorage <> type_record.typstorage
       UNION ALL
       SELECT 'column-compression-override',
         namespace_record.nspname || '.' || class_record.relname || '.' ||
           attribute_record.attname
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND pg_catalog.ascii(attribute_record.attcompression::text) <> 0
       UNION ALL
       SELECT 'column-options',
         namespace_record.nspname || '.' || class_record.relname || '.' ||
           attribute_record.attname
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND attribute_record.attoptions IS NOT NULL
       UNION ALL
       SELECT 'dropped-column',
         namespace_record.nspname || '.' || class_record.relname || ':' ||
           attribute_record.attnum::text
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND attribute_record.attnum > 0
         AND attribute_record.attisdropped
       UNION ALL
       SELECT 'routine-acl',
         namespace_record.nspname || '.' || procedure_record.proname
       FROM pg_catalog.pg_proc AS procedure_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = procedure_record.pronamespace
       WHERE namespace_record.nspname = 'public'
         AND procedure_record.proacl IS NOT NULL
       UNION ALL
       SELECT 'type-acl',
         namespace_record.nspname || '.' || type_record.typname
       FROM pg_catalog.pg_type AS type_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = type_record.typnamespace
       WHERE namespace_record.nspname = 'public'
         AND type_record.typacl IS NOT NULL
       UNION ALL
       SELECT 'language-acl',
         language_record.lanname
       FROM pg_catalog.pg_language AS language_record
       INNER JOIN pg_catalog.pg_depend AS dependency_record
         ON dependency_record.classid = 'pg_language'::regclass
        AND dependency_record.objid = language_record.oid
        AND dependency_record.objsubid = 0
        AND dependency_record.refclassid = 'pg_extension'::regclass
        AND dependency_record.deptype = 'e'
       WHERE language_record.lanacl IS NOT NULL
       UNION ALL
       SELECT 'default-acl',
         default_acl.oid::text
       FROM pg_catalog.pg_default_acl AS default_acl
       UNION ALL
       SELECT 'security-label',
         security_label.classoid::regclass::text || ':' ||
           security_label.objoid::text || ':' || security_label.objsubid::text
       FROM pg_catalog.pg_seclabel AS security_label
       UNION ALL
       SELECT 'foreign-data-wrapper',
         foreign_wrapper.fdwname
       FROM pg_catalog.pg_foreign_data_wrapper AS foreign_wrapper
       UNION ALL
       SELECT 'foreign-server',
         foreign_server.srvname
       FROM pg_catalog.pg_foreign_server AS foreign_server
       UNION ALL
       SELECT 'user-mapping',
         user_mapping.oid::text
       FROM pg_catalog.pg_user_mapping AS user_mapping
     ) AS unsupported
     ORDER BY unsupported.kind, unsupported.identity`,
  extensions: `SELECT json_build_object(
       'name', extension_record.extname,
       'schema', namespace_record.nspname,
       'version', extension_record.extversion,
       'relocatable', extension_record.extrelocatable,
       'owner', '$MIGRATION_ROLE'
     ) AS value
     FROM pg_catalog.pg_extension AS extension_record
     INNER JOIN pg_catalog.pg_namespace AS namespace_record
       ON namespace_record.oid = extension_record.extnamespace
     ORDER BY extension_record.extname`,
  extensionMembers: `SELECT json_build_object(
       'extension', extension_record.extname,
       'catalog', dependency_record.classid::regclass::text,
       'objectType', object_address.type,
       'objectNames', object_address.object_names,
       'objectArguments', object_address.object_args
     ) AS value
     FROM pg_catalog.pg_depend AS dependency_record
     INNER JOIN pg_catalog.pg_extension AS extension_record
       ON extension_record.oid = dependency_record.refobjid
     CROSS JOIN LATERAL pg_catalog.pg_identify_object_as_address(
       dependency_record.classid,
       dependency_record.objid,
       dependency_record.objsubid
     ) AS object_address
     WHERE dependency_record.refclassid = 'pg_extension'::regclass
       AND dependency_record.deptype = 'e'
     ORDER BY extension_record.extname,
       dependency_record.classid::regclass::text,
       object_address.type,
       object_address.object_names,
       object_address.object_args`,
  extensionMemberDefinitions: `WITH direct_members AS (
       SELECT dependency_record.classid,
         dependency_record.objid,
         extension_record.extname AS extension_name
       FROM pg_catalog.pg_depend AS dependency_record
       INNER JOIN pg_catalog.pg_extension AS extension_record
         ON extension_record.oid = dependency_record.refobjid
       WHERE dependency_record.refclassid = 'pg_extension'::regclass
         AND dependency_record.objsubid = 0
         AND dependency_record.deptype = 'e'
     )
     SELECT json_build_object(
       'extension', member_record.extension_name,
       'catalog', member_record.classid::regclass::text,
       'objectType', object_address.type,
       'objectNames', object_address.object_names,
       'objectArguments', object_address.object_args,
       'definition', member_record.definition
     ) AS value
     FROM (
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'sql', pg_catalog.pg_get_functiondef(procedure_record.oid),
           'comment', pg_catalog.obj_description(procedure_record.oid, 'pg_proc'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_proc AS procedure_record
         ON direct_member.classid = 'pg_proc'::regclass
        AND procedure_record.oid = direct_member.objid
       UNION ALL
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'kind', type_record.typtype,
           'category', type_record.typcategory,
           'preferred', type_record.typispreferred,
           'defined', type_record.typisdefined,
           'length', type_record.typlen::text,
           'byValue', type_record.typbyval,
           'alignment', type_record.typalign,
           'storage', type_record.typstorage,
           'delimiter', type_record.typdelim,
           'notNull', type_record.typnotnull,
           'default', type_record.typdefault,
           'elementType', CASE
             WHEN type_record.typelem = 0 THEN NULL
             ELSE pg_catalog.format_type(type_record.typelem, NULL)
           END,
           'arrayType', CASE
             WHEN type_record.typarray = 0 THEN NULL
             ELSE pg_catalog.format_type(type_record.typarray, NULL)
           END,
           'input', type_record.typinput::regprocedure::text,
           'output', type_record.typoutput::regprocedure::text,
           'receive', CASE
             WHEN type_record.typreceive = 0 THEN NULL
             ELSE type_record.typreceive::regprocedure::text
           END,
           'send', CASE
             WHEN type_record.typsend = 0 THEN NULL
             ELSE type_record.typsend::regprocedure::text
           END,
           'typmodIn', CASE
             WHEN type_record.typmodin = 0 THEN NULL
             ELSE type_record.typmodin::regprocedure::text
           END,
           'typmodOut', CASE
             WHEN type_record.typmodout = 0 THEN NULL
             ELSE type_record.typmodout::regprocedure::text
           END,
           'analyze', CASE
             WHEN type_record.typanalyze = 0 THEN NULL
             ELSE type_record.typanalyze::regprocedure::text
           END,
           'subscript', CASE
             WHEN type_record.typsubscript = 0 THEN NULL
             ELSE type_record.typsubscript::regprocedure::text
           END,
           'collation', CASE
             WHEN type_record.typcollation = 0 THEN NULL
             ELSE type_record.typcollation::regcollation::text
           END,
           'comment', pg_catalog.obj_description(type_record.oid, 'pg_type'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_type AS type_record
         ON direct_member.classid = 'pg_type'::regclass
        AND type_record.oid = direct_member.objid
       UNION ALL
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'kind', operator_record.oprkind,
           'leftType', pg_catalog.format_type(operator_record.oprleft, NULL),
           'rightType', pg_catalog.format_type(operator_record.oprright, NULL),
           'resultType', pg_catalog.format_type(operator_record.oprresult, NULL),
           'procedure', operator_record.oprcode::regprocedure::text,
           'commutator', CASE
             WHEN operator_record.oprcom = 0 THEN NULL
             ELSE operator_record.oprcom::regoperator::text
           END,
           'negator', CASE
             WHEN operator_record.oprnegate = 0 THEN NULL
             ELSE operator_record.oprnegate::regoperator::text
           END,
           'restrict', CASE
             WHEN operator_record.oprrest = 0 THEN NULL
             ELSE operator_record.oprrest::regprocedure::text
           END,
           'join', CASE
             WHEN operator_record.oprjoin = 0 THEN NULL
             ELSE operator_record.oprjoin::regprocedure::text
           END,
           'canMerge', operator_record.oprcanmerge,
           'canHash', operator_record.oprcanhash,
           'comment', pg_catalog.obj_description(operator_record.oid, 'pg_operator'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_operator AS operator_record
         ON direct_member.classid = 'pg_operator'::regclass
        AND operator_record.oid = direct_member.objid
       UNION ALL
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'method', access_method.amname,
           'familySchema', family_namespace.nspname,
           'family', family_record.opfname,
           'inputType', pg_catalog.format_type(opclass_record.opcintype, NULL),
           'default', opclass_record.opcdefault,
           'keyType', CASE
             WHEN opclass_record.opckeytype = 0 THEN NULL
             ELSE pg_catalog.format_type(opclass_record.opckeytype, NULL)
           END,
           'comment', pg_catalog.obj_description(opclass_record.oid, 'pg_opclass'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_opclass AS opclass_record
         ON direct_member.classid = 'pg_opclass'::regclass
        AND opclass_record.oid = direct_member.objid
       INNER JOIN pg_catalog.pg_am AS access_method
         ON access_method.oid = opclass_record.opcmethod
       INNER JOIN pg_catalog.pg_opfamily AS family_record
         ON family_record.oid = opclass_record.opcfamily
       INNER JOIN pg_catalog.pg_namespace AS family_namespace
         ON family_namespace.oid = family_record.opfnamespace
       UNION ALL
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'method', access_method.amname,
           'operators', COALESCE((
             SELECT jsonb_agg(
               jsonb_build_object(
                 'strategy', family_operator.amopstrategy::text,
                 'purpose', family_operator.amoppurpose,
                 'leftType', pg_catalog.format_type(family_operator.amoplefttype, NULL),
                 'rightType', pg_catalog.format_type(family_operator.amoprighttype, NULL),
                 'operator', family_operator.amopopr::regoperator::text,
                 'sortFamily', CASE
                   WHEN family_operator.amopsortfamily = 0 THEN NULL
                   ELSE sort_namespace.nspname || '.' || sort_family.opfname ||
                     ':' || sort_method.amname
                 END
               ) ORDER BY family_operator.amopstrategy,
                 family_operator.amoplefttype,
                 family_operator.amoprighttype
             )
             FROM pg_catalog.pg_amop AS family_operator
             LEFT JOIN pg_catalog.pg_opfamily AS sort_family
               ON sort_family.oid = family_operator.amopsortfamily
             LEFT JOIN pg_catalog.pg_namespace AS sort_namespace
               ON sort_namespace.oid = sort_family.opfnamespace
             LEFT JOIN pg_catalog.pg_am AS sort_method
               ON sort_method.oid = sort_family.opfmethod
             WHERE family_operator.amopfamily = family_record.oid
           ), '[]'::jsonb),
           'procedures', COALESCE((
             SELECT jsonb_agg(
               jsonb_build_object(
                 'number', family_procedure.amprocnum::text,
                 'leftType', pg_catalog.format_type(family_procedure.amproclefttype, NULL),
                 'rightType', pg_catalog.format_type(family_procedure.amprocrighttype, NULL),
                 'procedure', family_procedure.amproc::regprocedure::text
               ) ORDER BY family_procedure.amprocnum,
                 family_procedure.amproclefttype,
                 family_procedure.amprocrighttype
             )
             FROM pg_catalog.pg_amproc AS family_procedure
             WHERE family_procedure.amprocfamily = family_record.oid
           ), '[]'::jsonb),
           'comment', pg_catalog.obj_description(family_record.oid, 'pg_opfamily'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_opfamily AS family_record
         ON direct_member.classid = 'pg_opfamily'::regclass
        AND family_record.oid = direct_member.objid
       INNER JOIN pg_catalog.pg_am AS access_method
         ON access_method.oid = family_record.opfmethod
       UNION ALL
       SELECT direct_member.extension_name,
         direct_member.classid,
         direct_member.objid,
         jsonb_build_object(
           'trusted', language_record.lanpltrusted,
           'procedural', language_record.lanispl,
           'handler', language_record.lanplcallfoid::regprocedure::text,
           'inline', CASE
             WHEN language_record.laninline = 0 THEN NULL
             ELSE language_record.laninline::regprocedure::text
           END,
           'validator', CASE
             WHEN language_record.lanvalidator = 0 THEN NULL
             ELSE language_record.lanvalidator::regprocedure::text
           END,
           'comment', pg_catalog.obj_description(language_record.oid, 'pg_language'),
           'owner', '$MIGRATION_ROLE'
         ) AS definition
       FROM direct_members AS direct_member
       INNER JOIN pg_catalog.pg_language AS language_record
         ON direct_member.classid = 'pg_language'::regclass
        AND language_record.oid = direct_member.objid
     ) AS member_record
     CROSS JOIN LATERAL pg_catalog.pg_identify_object_as_address(
       member_record.classid,
       member_record.objid,
       0
     ) AS object_address
     ORDER BY member_record.extension_name,
       member_record.classid::regclass::text,
       object_address.type,
       object_address.object_names,
       object_address.object_args`,
  comments: withoutExtensionMembers(
    `SELECT value
     FROM (
       SELECT json_build_object(
         'kind', 'relation',
         'schema', namespace_record.nspname,
         'relation', class_record.relname,
         'column', NULL,
         'text', pg_catalog.obj_description(class_record.oid, 'pg_class')
       ) AS value,
       namespace_record.nspname AS schema_name,
       class_record.relname AS relation_name,
       0 AS column_position
       FROM pg_catalog.pg_class AS class_record
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'p', 'v', 'm', 'S')
         AND pg_catalog.obj_description(class_record.oid, 'pg_class') IS NOT NULL
         %EXTENSION_FILTER%
       UNION ALL
       SELECT json_build_object(
         'kind', 'column',
         'schema', namespace_record.nspname,
         'relation', class_record.relname,
         'column', attribute_record.attname,
         'text', pg_catalog.col_description(class_record.oid, attribute_record.attnum)
       ) AS value,
       namespace_record.nspname AS schema_name,
       class_record.relname AS relation_name,
       attribute_record.attnum AS column_position
       FROM pg_catalog.pg_attribute AS attribute_record
       INNER JOIN pg_catalog.pg_class AS class_record
         ON class_record.oid = attribute_record.attrelid
       INNER JOIN pg_catalog.pg_namespace AS namespace_record
         ON namespace_record.oid = class_record.relnamespace
       WHERE namespace_record.nspname = 'public'
         AND class_record.relkind IN ('r', 'p', 'v', 'm')
         AND attribute_record.attnum > 0
         AND NOT attribute_record.attisdropped
         AND pg_catalog.col_description(class_record.oid, attribute_record.attnum) IS NOT NULL
         %EXTENSION_FILTER%
     ) AS comments
     ORDER BY schema_name, relation_name, column_position`,
    'pg_class',
    'class_record.oid',
  ),
}

const NEW_PUBLIC_OBJECTS_SQL = `SELECT json_build_object(
    'catalog', object_record.catalog_name,
    'identity', object_record.identity
  ) AS value
  FROM (
    SELECT 'pg_class' AS catalog_name,
      pg_catalog.pg_describe_object('pg_class'::regclass, class_record.oid, 0) AS identity
    FROM pg_catalog.pg_class AS class_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_class'::regclass
          AND dependency_record.objid = class_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_proc',
      pg_catalog.pg_describe_object('pg_proc'::regclass, procedure_record.oid, 0)
    FROM pg_catalog.pg_proc AS procedure_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = procedure_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_proc'::regclass
          AND dependency_record.objid = procedure_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_type',
      pg_catalog.pg_describe_object('pg_type'::regclass, type_record.oid, 0)
    FROM pg_catalog.pg_type AS type_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = type_record.typnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_type'::regclass
          AND dependency_record.objid = type_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_operator',
      pg_catalog.pg_describe_object('pg_operator'::regclass, operator_record.oid, 0)
    FROM pg_catalog.pg_operator AS operator_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = operator_record.oprnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_operator'::regclass
          AND dependency_record.objid = operator_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_opclass',
      pg_catalog.pg_describe_object('pg_opclass'::regclass, opclass_record.oid, 0)
    FROM pg_catalog.pg_opclass AS opclass_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = opclass_record.opcnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_opclass'::regclass
          AND dependency_record.objid = opclass_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_opfamily',
      pg_catalog.pg_describe_object('pg_opfamily'::regclass, family_record.oid, 0)
    FROM pg_catalog.pg_opfamily AS family_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = family_record.opfnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_opfamily'::regclass
          AND dependency_record.objid = family_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_rewrite',
      pg_catalog.pg_describe_object('pg_rewrite'::regclass, rewrite_record.oid, 0)
    FROM pg_catalog.pg_rewrite AS rewrite_record
    INNER JOIN pg_catalog.pg_class AS class_record
      ON class_record.oid = rewrite_record.ev_class
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT (
        rewrite_record.rulename = '_RETURN'
        AND class_record.relkind IN ('v', 'm')
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_rewrite'::regclass
          AND dependency_record.objid = rewrite_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_policy',
      pg_catalog.pg_describe_object('pg_policy'::regclass, policy_record.oid, 0)
    FROM pg_catalog.pg_policy AS policy_record
    INNER JOIN pg_catalog.pg_class AS class_record
      ON class_record.oid = policy_record.polrelid
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_policy'::regclass
          AND dependency_record.objid = policy_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_collation',
      pg_catalog.pg_describe_object('pg_collation'::regclass, collation_record.oid, 0)
    FROM pg_catalog.pg_collation AS collation_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = collation_record.collnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_collation'::regclass
          AND dependency_record.objid = collation_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_conversion',
      pg_catalog.pg_describe_object('pg_conversion'::regclass, conversion_record.oid, 0)
    FROM pg_catalog.pg_conversion AS conversion_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = conversion_record.connamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_conversion'::regclass
          AND dependency_record.objid = conversion_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_ts_config',
      pg_catalog.pg_describe_object('pg_ts_config'::regclass, configuration_record.oid, 0)
    FROM pg_catalog.pg_ts_config AS configuration_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = configuration_record.cfgnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_ts_config'::regclass
          AND dependency_record.objid = configuration_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_ts_dict',
      pg_catalog.pg_describe_object('pg_ts_dict'::regclass, dictionary_record.oid, 0)
    FROM pg_catalog.pg_ts_dict AS dictionary_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = dictionary_record.dictnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_ts_dict'::regclass
          AND dependency_record.objid = dictionary_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_ts_parser',
      pg_catalog.pg_describe_object('pg_ts_parser'::regclass, parser_record.oid, 0)
    FROM pg_catalog.pg_ts_parser AS parser_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = parser_record.prsnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_ts_parser'::regclass
          AND dependency_record.objid = parser_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_ts_template',
      pg_catalog.pg_describe_object('pg_ts_template'::regclass, template_record.oid, 0)
    FROM pg_catalog.pg_ts_template AS template_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = template_record.tmplnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_ts_template'::regclass
          AND dependency_record.objid = template_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
    UNION ALL
    SELECT 'pg_statistic_ext',
      pg_catalog.pg_describe_object('pg_statistic_ext'::regclass, statistics_record.oid, 0)
    FROM pg_catalog.pg_statistic_ext AS statistics_record
    INNER JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = statistics_record.stxnamespace
    WHERE namespace_record.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS dependency_record
        WHERE dependency_record.classid = 'pg_statistic_ext'::regclass
          AND dependency_record.objid = statistics_record.oid
          AND dependency_record.objsubid = 0
          AND dependency_record.refclassid = 'pg_extension'::regclass
          AND dependency_record.deptype = 'e'
      )
  ) AS object_record
  ORDER BY object_record.catalog_name, object_record.identity`

function getCatalogSql() {
  return CATALOG_SQL
}

function getNewPublicObjectsSql() {
  return NEW_PUBLIC_OBJECTS_SQL
}

function assertCanonicalCatalogSurfaceClosure() {
  const currentSurface = Object.values(CATALOG_SQL).join('\n')
  for (const catalog of REQUIRED_PUBLIC_ROOT_CATALOGS) {
    if (
      !currentSurface.includes(`pg_catalog.${catalog}`) ||
      !NEW_PUBLIC_OBJECTS_SQL.includes(`'${catalog}'::regclass`)
    ) {
      throw new CanonicalEpochError(
        'CATALOG_SURFACE_INCOMPLETE',
        `Canonical catalog surface is missing ${catalog}`,
      )
    }
  }
}
