import { attempt, isError } from 'lodash-es';

export function safeParseJson(jsonString: string): any {
  const result = attempt(JSON.parse, jsonString);
  if (isError(result)) {
    // 如果解析失败，返回 undefined 或者你想要的默认值
    return undefined;
  }
  return result;
}
