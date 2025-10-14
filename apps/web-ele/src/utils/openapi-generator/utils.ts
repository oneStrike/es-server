import { TYPE_MAPPING } from './config';

/**
 * 转换为驼峰命名
 */
export function toCamelCase(str: string): string {
  return str
    .replaceAll(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * 转换为帕斯卡命名
 */
export function toPascalCase(str: string): string {
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * 映射 OpenAPI 类型到 TypeScript 类型
 */
export function mapOpenAPIType(type: string, format?: string): string {
  // 如果有格式，尝试使用格式化的类型映射
  if (format) {
    const formatKey = `${type}:${format}` as keyof typeof TYPE_MAPPING;
    if (TYPE_MAPPING[formatKey]) {
      return TYPE_MAPPING[formatKey];
    }
  }

  // 使用基础类型映射
  return (
    TYPE_MAPPING[type as keyof typeof TYPE_MAPPING] || TYPE_MAPPING.default
  );
}

/**
 * 映射 schema 到 TypeScript 类型
 */
export function mapSchemaToType(schema: any, depth: number = 0): string {
  if (!schema) return 'any';

  // 处理 $ref 引用
  if (schema.$ref) {
    return resolveRef(schema.$ref) as string;
  }

  // 处理 allOf, oneOf, anyOf
  if (schema.allOf) {
    const types = schema.allOf.map((s: any) => mapSchemaToType(s, depth + 1));
    return types.join(' & ');
  }

  if (schema.oneOf || schema.anyOf) {
    const schemas = schema.oneOf || schema.anyOf;
    const types = schemas.map((s: any) => mapSchemaToType(s, depth + 1));
    return types.join(' | ');
  }

  switch (schema.type) {
    case 'array': {
      if (!schema.items) return 'any[]';
      const itemType = mapSchemaToType(schema.items, depth + 1);
      return `${itemType}[]`;
    }
    case 'boolean': {
      return 'boolean';
    }
    case 'integer':
    case 'number': {
      // 处理枚举值
      if (schema.enum && Array.isArray(schema.enum)) {
        return schema.enum.join(' | ');
      }
      return 'number';
    }
    case 'object': {
      if (schema.properties) {
        // 避免过深的嵌套，超过8层使用通用类型
        if (depth > 8) {
          return 'Record<string, any>';
        }

        // 生成内联对象类型
        const props = Object.entries(schema.properties).map(
          ([key, prop]: [string, any]) => {
            const required = schema.required?.includes(key) ? '' : '?';
            const propType = mapSchemaToType(prop, depth + 1);
            return `  ${key}${required}: ${propType}`;
          },
        );

        if (props.length === 0) {
          return 'Record<string, any>';
        }

        return `{\n${props.join(';\n')};\n  /** 任意合法数值 */\n  [property: string]: any;\n}`;
      }

      // 处理 additionalProperties
      if (schema.additionalProperties) {
        if (typeof schema.additionalProperties === 'object') {
          const valueType = mapSchemaToType(
            schema.additionalProperties,
            depth + 1,
          );
          return `Record<string, ${valueType}>`;
        }
        return 'Record<string, any>';
      }

      return 'Record<string, any>';
    }
    case 'string': {
      // 处理字符串枚举
      if (schema.enum && Array.isArray(schema.enum)) {
        return schema.enum.map((val: any) => `'${val}'`).join(' | ');
      }

      // 处理格式化字符串
      switch (schema.format) {
        case 'binary': {
          return 'File | Blob';
        }
        case 'date':
        case 'date-time': {
          return 'string';
        } // 可以考虑使用 Date 类型
        case 'email':
        case 'uri':
        case 'uuid': {
          return 'string';
        }
        default: {
          return 'string';
        }
      }
    }
    case 'null': {
      return 'null';
    }
    default: {
      // 处理没有明确类型但有属性的情况
      if (schema.properties) {
        return mapSchemaToType({ ...schema, type: 'object' }, depth);
      }

      // 处理枚举但没有类型的情况
      if (schema.enum && Array.isArray(schema.enum)) {
        const firstType = typeof schema.enum[0];
        if (firstType === 'string') {
          return schema.enum.map((val: string) => `'${val}'`).join(' | ');
        } else if (firstType === 'number') {
          return schema.enum.join(' | ');
        }
      }

      return 'any';
    }
  }
}

/**
 * 解析 $ref 引用
 */
export function resolveRef(ref: string) {
  // 从 $ref 中提取类型名称
  // 例如: "#/components/schemas/AuthorDetailResponse" -> "AuthorDetailResponse"
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

/**
 * 格式化当前时间
 */
export function formatCurrentTime(options: Intl.DateTimeFormatOptions): string {
  return new Date().toLocaleString('zh-CN', options).replaceAll('/', '-');
}

/**
 * 收集引用的类型
 */
export function collectReferencedTypes(
  schema: any,
  referencedTypes: Set<string>,
): void {
  if (!schema) return;

  if (schema.$ref) {
    const typeName = resolveRef(schema.$ref);
    referencedTypes.add(typeName as string);
    return;
  }

  // 处理 allOf, oneOf, anyOf
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      collectReferencedTypes(subSchema, referencedTypes);
    }
    return;
  }

  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      collectReferencedTypes(subSchema, referencedTypes);
    }
    return;
  }

  if (schema.anyOf) {
    for (const subSchema of schema.anyOf) {
      collectReferencedTypes(subSchema, referencedTypes);
    }
    return;
  }

  // 处理数组类型
  if (schema.type === 'array' && schema.items) {
    collectReferencedTypes(schema.items, referencedTypes);
    return;
  }

  // 处理对象类型
  if (schema.type === 'object' && schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      collectReferencedTypes(prop, referencedTypes);
    }
    return;
  }

  // 处理 additionalProperties
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === 'object'
  ) {
    collectReferencedTypes(schema.additionalProperties, referencedTypes);
    return;
  }

  // 处理没有明确类型但有属性的情况
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      collectReferencedTypes(prop, referencedTypes);
    }
  }
}
