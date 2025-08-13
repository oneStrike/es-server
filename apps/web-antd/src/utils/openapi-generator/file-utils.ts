import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 清空目录中的所有文件
 */
export async function clearDirectory(dirPath: string): Promise<void> {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await clearDirectory(filePath);
        await fs.rmdir(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
    console.log(`已清空目录: ${dirPath}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('清空目录失败:', error);
    }
  }
}

/**
 * 确保目录存在
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('创建目录失败:', error);
  }
}

/**
 * 写入文件
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`已生成文件: ${filePath}`);
  } catch (error) {
    console.error(`写入文件失败 ${filePath}:`, error);
  }
}
