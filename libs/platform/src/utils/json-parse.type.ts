/**
 * JSON 可表达的基础字面量。
 */
export type JsonPrimitive = string | number | boolean | null

/**
 * JSON 对象结构。
 */
export interface JsonObject {
  [key: string]: JsonValue
}

/**
 * JSON 可表达的完整值类型。
 */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

/**
 * JSON 解析工具接受的输入。
 */
export type JsonInput = JsonValue | undefined

/**
 * 结构化对象输出。
 */
export interface StructuredObject {
  [key: string]: StructuredValue
}

/**
 * 结构化输出中的值类型。
 */
export type StructuredValue =
  JsonPrimitive | Date | object | StructuredValue[] | StructuredObject
