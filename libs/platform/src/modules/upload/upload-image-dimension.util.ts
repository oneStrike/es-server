import type { UploadImageDimensions } from './upload.type'
import { imageSizeFromFile } from 'image-size/fromFile'

/**
 * 从本地图片文件中解析像素尺寸。
 * 解析失败时返回 null，避免尺寸命名影响主上传链路。
 */
export async function resolveImageDimensionsFromFile(filePath: string) {
  try {
    const dimensions = await imageSizeFromFile(filePath)
    if (!dimensions.width || !dimensions.height) {
      return null
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
    } satisfies UploadImageDimensions
  } catch {
    return null
  }
}
