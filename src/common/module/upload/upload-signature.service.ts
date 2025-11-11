import { Buffer } from 'node:buffer'
import { Transform } from 'node:stream'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 文件签名验证服务
 * 负责验证文件签名（魔数）以防止伪造Content-Type等安全验证
 */
@Injectable()
export class UploadSignatureService {
  private readonly requiredBytes = 16 // 足够用于常见类型的魔数检测

  /**
   * 匹配字节序列
   * @param buf 缓冲区
   * @param sig 签名（数字数组或Buffer）
   * @param offset 偏移量
   * @returns 是否匹配
   */
  private match(buf: Buffer, sig: number[] | Buffer, offset = 0): boolean {
    const signature = Buffer.isBuffer(sig) ? sig : Buffer.from(sig)
    if (buf.length < offset + signature.length) {
      return false
    }
    return buf.slice(offset, offset + signature.length).equals(signature)
  }

  /**
   * 根据魔数验证文件类型
   * @param buf 文件头部缓冲区
   * @param mimetype 声明的MIME类型
   * @param ext 文件扩展名
   * @returns 验证结果
   */
  private validateByMagic(buf: Buffer, mimetype: string, ext: string): boolean {
    // 图片类型验证
    if (mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext)) {
      return this.match(buf, [0xFF, 0xD8, 0xFF], 0)
    }

    if (mimetype === 'image/png' && ext === '.png') {
      return this.match(
        buf,
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        0,
      )
    }

    if (mimetype === 'image/gif' && ['.gif'].includes(ext)) {
      return (
        this.match(buf, Buffer.from('GIF87a')) ||
        this.match(buf, Buffer.from('GIF89a'))
      )
    }

    if (mimetype === 'image/webp' && ext === '.webp') {
      // RIFF....WEBP
      return (
        this.match(buf, Buffer.from('RIFF'), 0) &&
        this.match(buf, Buffer.from('WEBP'), 8)
      )
    }

    // 文档/归档类型验证
    if (mimetype === 'application/pdf' && ext === '.pdf') {
      return this.match(buf, Buffer.from('%PDF-'), 0)
    }

    if (
      (mimetype === 'application/zip' && ext === '.zip') ||
      mimetype.includes('openxmlformats') // docx/xlsx/pptx 等OOXML
    ) {
      return this.match(buf, Buffer.from('PK\x03\x04'), 0)
    }

    if (mimetype === 'application/gzip' && ext === '.gz') {
      return this.match(buf, Buffer.from([0x1F, 0x8B]), 0)
    }

    // 音视频类型验证（部分弱校验）
    if (mimetype === 'video/mp4' && ext === '.mp4') {
      // 粗略：前12字节中存在 ftyp 标记
      return buf.includes(Buffer.from('ftyp'))
    }

    if (mimetype === 'audio/ogg' && ext === '.ogg') {
      return this.match(buf, Buffer.from('OggS'), 0)
    }

    if (mimetype === 'video/webm' && ext === '.webm') {
      // EBML 头部
      return this.match(buf, Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), 0)
    }

    // 其他类型不强制魔数校验
    return true
  }

  /**
   * 创建文件签名检测流：对常见类型做魔数校验，防止伪造Content-Type
   * @param mimetype MIME类型
   * @param ext 文件扩展名
   * @param filename 文件名
   * @returns 转换流
   */
  createSignatureCheckStream(
    mimetype: string,
    ext: string,
    filename: string,
  ): Transform {
    let head = Buffer.alloc(0)
    let validated = false
    const requiredBytes = this.requiredBytes
    const validateByMagic = this.validateByMagic.bind(this)

    return new Transform({
      transform(chunk: any, _encoding: any, callback: any) {
        if (!validated) {
          head = Buffer.concat([head, Buffer.from(chunk)])
          if (head.length >= requiredBytes) {
            if (!validateByMagic(head, mimetype, ext)) {
              const error = new BadRequestException(
                `文件签名与声明类型不匹配: ${filename}`,
              )
              return callback(error)
            }
            validated = true
            // 将累计的头部一次性写出
            this.push(head)
            return callback()
          }
          // 先不写出，等足够字节后统一校验与写出
          return callback()
        }
        // 已验证，直接透传
        callback(null, chunk)
      },
      flush(callback: any) {
        if (!validated) {
          // 文件过小但仍需校验
          if (!validateByMagic(head, mimetype, ext)) {
            const error = new BadRequestException(
              `文件签名与声明类型不匹配: ${filename}`,
            )
            return callback(error)
          }
          this.push(head)
        }
        callback()
      },
    })
  }
}
