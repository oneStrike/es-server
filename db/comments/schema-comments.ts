import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as runtimeSchema from '@db/schema'
import {
  getTableColumns,
  getTableName,
  getTableUniqueName,
  isTable,
} from 'drizzle-orm'
import ts from 'typescript'

const DB_DIR = resolve(__dirname, '..')
const SCHEMA_DIR = resolve(DB_DIR, 'schema')
const DEFAULT_OUTPUT_PATH = resolve(DB_DIR, 'comments', 'generated.sql')
const WINDOWS_NEWLINE_REGEX = /\r\n/g

type WarningKind =
  | 'missing-source-table'
  | 'missing-table-comment'
  | 'missing-column-comment'
  | 'orphan-source-column'

interface SourceTableComments {
  exportName: string
  filePath: string
  tableComment: string | null
  columnComments: Map<string, string>
}

interface SchemaCommentWarning {
  kind: WarningKind
  exportName: string
  filePath: string
  message: string
  columnKey?: string
}

export type SchemaCommentTarget =
  | {
      kind: 'table'
      schemaName: string
      tableName: string
      targetKey: string
    }
  | {
      columnName: string
      kind: 'column'
      schemaName: string
      tableName: string
      targetKey: string
    }

export interface SchemaCommentStatement {
  sql: string
  target: SchemaCommentTarget
}

export interface SchemaCommentsArtifact {
  commentStatements: SchemaCommentStatement[]
  outputPath: string
  sql: string
  tableCommentCount: number
  columnCommentCount: number
  warnings: SchemaCommentWarning[]
}

interface WriteSchemaCommentsResult {
  changed: boolean
  outputPath: string
}

export interface BuildSchemaCommentsOptions {
  outputPath?: string
}

/**
 * 返回 schema comments 生成产物的输出路径。
 */
export function getSchemaCommentsOutputPath(
  outputPath: string = DEFAULT_OUTPUT_PATH,
): string {
  return outputPath
}

/**
 * 扫描 db/schema 源码中的 JSDoc 注释，生成结构化 COMMENT ON 语句列表与 warnings。
 */
export function buildSchemaCommentsArtifact(
  options: BuildSchemaCommentsOptions = {},
): SchemaCommentsArtifact {
  const outputPath = getSchemaCommentsOutputPath(options.outputPath)
  const sourceComments = parseSchemaSourceComments()
  const warnings: SchemaCommentWarning[] = []
  const commentStatements: SchemaCommentStatement[] = []
  let tableCommentCount = 0
  let columnCommentCount = 0

  const runtimeTables = Object.entries(runtimeSchema)
    .flatMap(([exportName, table]) => {
      if (!isTable(table)) {
        return []
      }

      const tableName = getTableName(table)
      const uniqueName = getTableUniqueName(table)
      const schemaName = uniqueName.endsWith(`.${tableName}`)
        ? uniqueName.slice(0, -tableName.length - 1)
        : 'public'

      return [
        {
          exportName,
          table,
          tableName,
          schemaName,
        },
      ]
    })
    .sort((left, right) => {
      const leftName = `${left.schemaName}.${left.tableName}`
      const rightName = `${right.schemaName}.${right.tableName}`
      return leftName.localeCompare(rightName)
    })

  for (const runtimeTable of runtimeTables) {
    const sourceTable = sourceComments.get(runtimeTable.exportName)

    if (!sourceTable) {
      warnings.push({
        kind: 'missing-source-table',
        exportName: runtimeTable.exportName,
        filePath: '',
        message: `未找到 ${runtimeTable.exportName} 对应的 schema 源定义`,
      })
      continue
    }

    const runtimeColumns = getTableColumns(runtimeTable.table)
    const runtimeColumnKeys = new Set(Object.keys(runtimeColumns))

    if (sourceTable.tableComment) {
      commentStatements.push({
        sql: `COMMENT ON TABLE ${quoteQualifiedName(runtimeTable.schemaName, runtimeTable.tableName)} IS ${toPgTextLiteral(sourceTable.tableComment)};`,
        target: createSchemaCommentTarget(
          'table',
          runtimeTable.schemaName,
          runtimeTable.tableName,
        ),
      })
      tableCommentCount += 1
    } else {
      warnings.push({
        kind: 'missing-table-comment',
        exportName: runtimeTable.exportName,
        filePath: sourceTable.filePath,
        message: `${runtimeTable.exportName} 缺少表注释`,
      })
    }

    for (const [columnKey, column] of Object.entries(runtimeColumns)) {
      const columnComment = sourceTable.columnComments.get(columnKey)
      const columnName: string = (column as { name: string }).name

      if (!columnComment) {
        warnings.push({
          kind: 'missing-column-comment',
          exportName: runtimeTable.exportName,
          filePath: sourceTable.filePath,
          columnKey,
          message: `${runtimeTable.exportName}.${columnKey} 缺少字段注释`,
        })
        continue
      }

      commentStatements.push({
        sql: `COMMENT ON COLUMN ${quoteQualifiedName(runtimeTable.schemaName, runtimeTable.tableName, columnName)} IS ${toPgTextLiteral(columnComment)};`,
        target: createSchemaCommentTarget(
          'column',
          runtimeTable.schemaName,
          runtimeTable.tableName,
          columnName,
        ),
      })
      columnCommentCount += 1
    }

    for (const orphanColumnKey of sourceTable.columnComments.keys()) {
      if (runtimeColumnKeys.has(orphanColumnKey)) {
        continue
      }

      warnings.push({
        kind: 'orphan-source-column',
        exportName: runtimeTable.exportName,
        filePath: sourceTable.filePath,
        columnKey: orphanColumnKey,
        message: `${runtimeTable.exportName}.${orphanColumnKey} 在源码中存在注释，但运行时表中未找到对应字段`,
      })
    }
  }

  const sql = [
    '-- Generated from db/schema JSDoc comments.',
    '-- Do not edit this file directly.',
    '-- Run `pnpm db:comments:generate` to refresh.',
    'BEGIN;',
    ...commentStatements.map((statement) => statement.sql),
    'COMMIT;',
    '',
  ].join('\n')

  return {
    commentStatements,
    outputPath,
    sql,
    tableCommentCount,
    columnCommentCount,
    warnings,
  }
}

/**
 * 将生成产物写入 generated.sql，仅在内容变化时返回 changed=true。
 */
export function writeSchemaCommentsFile(
  artifact: SchemaCommentsArtifact,
): WriteSchemaCommentsResult {
  const previousContent = safeReadFile(artifact.outputPath)
  mkdirSync(dirname(artifact.outputPath), { recursive: true })
  writeFileSync(artifact.outputPath, artifact.sql, 'utf8')

  return {
    changed: previousContent !== artifact.sql,
    outputPath: artifact.outputPath,
  }
}

// 解析 db/schema 目录下所有 .ts 源文件，提取表级和字段级 JSDoc 注释。
function parseSchemaSourceComments() {
  const result = new Map<string, SourceTableComments>()

  for (const filePath of listSchemaSourceFiles(SCHEMA_DIR)) {
    const sourceText = readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    sourceFile.forEachChild((node) => {
      if (!ts.isVariableStatement(node) || !hasExportModifier(node)) {
        return
      }

      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue
        }

        const columnsDefinition = getTableColumnsDefinition(
          declaration.initializer,
        )

        if (columnsDefinition === undefined) {
          continue
        }

        if (columnsDefinition === null) {
          result.set(declaration.name.text, {
            exportName: declaration.name.text,
            filePath,
            tableComment: getNodeJsDoc(node) ?? getNodeJsDoc(declaration),
            columnComments: new Map(),
          })
          continue
        }

        const columnComments = new Map<string, string>()

        for (const property of columnsDefinition.properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue
          }

          const propertyName = getPropertyName(property.name)

          if (!propertyName) {
            continue
          }

          const propertyComment = getNodeJsDoc(property)

          if (propertyComment) {
            columnComments.set(propertyName, propertyComment)
          }
        }

        result.set(declaration.name.text, {
          exportName: declaration.name.text,
          filePath,
          tableComment: getNodeJsDoc(node) ?? getNodeJsDoc(declaration),
          columnComments,
        })
      }
    })
  }

  return result
}

// 递归列出 schema 目录下所有 .ts 源文件，按路径排序。
function listSchemaSourceFiles(directoryPath: string) {
  const entries = readdirSync(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...listSchemaSourceFiles(entryPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

// 判断 TypeScript 节点是否带有 export 修饰符。
function hasExportModifier(node: ts.Node) {
  return Boolean(
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  )
}

// 从 snakeCase.table() 调用表达式中提取列定义对象字面量，返回 null 表示无列定义。
function getTableColumnsDefinition(initializer: ts.Expression) {
  if (!ts.isCallExpression(initializer)) {
    return undefined
  }

  if (!isSnakeCaseTableExpression(initializer.expression)) {
    return undefined
  }

  const columnsArgument = initializer.arguments[1]

  if (!columnsArgument) {
    return null
  }

  if (ts.isObjectLiteralExpression(columnsArgument)) {
    return columnsArgument
  }

  if (
    ts.isArrowFunction(columnsArgument) ||
    ts.isFunctionExpression(columnsArgument)
  ) {
    const body = columnsArgument.body

    if (ts.isObjectLiteralExpression(body)) {
      return body
    }

    if (
      ts.isParenthesizedExpression(body) &&
      ts.isObjectLiteralExpression(body.expression)
    ) {
      return body.expression
    }
  }

  return null
}

// 判断表达式是否为 snakeCase.table 属性访问。
function isSnakeCaseTableExpression(expression: ts.LeftHandSideExpression) {
  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.expression.getText() === 'snakeCase'
  ) {
    return expression.name.text === 'table'
  }

  return false
}

// 从 TypeScript 属性名节点提取字符串文本。
function getPropertyName(name: ts.PropertyName) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }

  return null
}

// 提取节点上最后一段 JSDoc 注释文本。
function getNodeJsDoc(node: ts.Node) {
  const jsDocNodes = ts
    .getJSDocCommentsAndTags(node)
    .filter((entry): entry is ts.JSDoc => ts.isJSDoc(entry))

  if (jsDocNodes.length === 0) {
    return null
  }

  const lastDoc = jsDocNodes[jsDocNodes.length - 1]
  if (!lastDoc) {
    return null
  }

  return normalizeJsDocComment(renderJsDocComment(lastDoc.comment))
}

// 将 JSDoc comment 节点渲染为纯文本字符串。
function renderJsDocComment(comment: ts.JSDoc['comment']) {
  if (typeof comment === 'string') {
    return comment
  }

  if (!comment) {
    return ''
  }

  return comment
    .map((part) => {
      if ('text' in part && typeof part.text === 'string') {
        return part.text
      }

      return part.getText()
    })
    .join('')
}

// 规范化 JSDoc 注释文本：统一换行、去除首尾空行。
function normalizeJsDocComment(comment: string) {
  const normalizedLines = comment
    .replace(WINDOWS_NEWLINE_REGEX, '\n')
    .split('\n')
    .map((line) => line.trim())

  while (normalizedLines[0] === '') {
    normalizedLines.shift()
  }

  while (normalizedLines.at(-1) === '') {
    normalizedLines.pop()
  }

  if (normalizedLines.length === 0) {
    return null
  }

  return normalizedLines.join('\n')
}

// 安全读取文件内容，文件不存在或读取失败时返回 null。
function safeReadFile(filePath: string) {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

// 构建表级或字段级的 schema comment 目标对象。
function createSchemaCommentTarget(
  kind: SchemaCommentTarget['kind'],
  schemaName: string,
  tableName: string,
  columnName?: string,
): SchemaCommentTarget {
  const targetKey = getSchemaCommentTargetKey(
    kind,
    schemaName,
    tableName,
    columnName,
  )

  if (kind === 'column') {
    if (!columnName) {
      throw new TypeError('Column comment targets require a column name')
    }

    return {
      columnName,
      kind,
      schemaName,
      tableName,
      targetKey,
    }
  }

  return {
    kind,
    schemaName,
    tableName,
    targetKey,
  }
}

/**
 * 生成 schema comment 目标的唯一 key，用于去重和比对。
 */
export function getSchemaCommentTargetKey(
  kind: SchemaCommentTarget['kind'],
  schemaName: string,
  tableName: string,
  columnName?: string,
): string {
  return JSON.stringify([kind, schemaName, tableName, columnName ?? null])
}

// 对 SQL 标识符加双引号转义。
function quoteQualifiedName(...parts: string[]) {
  return parts.map((part) => `"${part.replaceAll('"', '""')}"`).join('.')
}

// 将字符串转为 PostgreSQL E'...' 文本字面量，转义反斜杠、单引号和换行。
function toPgTextLiteral(value: string) {
  return `E'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "''")
    .replaceAll('\n', '\\n')}'`
}
