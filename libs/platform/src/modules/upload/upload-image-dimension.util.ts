import { imageSizeFromFile } from 'image-size/fromFile'

/** 稳定内部类型 `UploadImageDimensions`。仅供上传模块命名链路复用，避免重复定义。 */
export interface UploadImageDimensions {
  width: number
  height: number
}

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
