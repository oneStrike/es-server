/**
 * 游标上下文指纹允许参与比较的基础值。
 */
export type CursorContextScalar = string | number | boolean | null

/**
 * 游标上下文指纹中的字段值。
 */
export type CursorContextValue = CursorContextScalar | CursorContextScalar[]

/**
 * 用于校验分页游标是否仍匹配当前查询上下文的指纹。
 */
export type CursorContextFingerprint = Record<string, CursorContextValue>
