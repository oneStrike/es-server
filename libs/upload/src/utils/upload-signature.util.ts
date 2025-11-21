import { Buffer } from 'node:buffer'
import { Transform } from 'node:stream'
import { BadRequestException } from '@nestjs/common'

const requiredBytes = 16

function match(buf: Buffer, sig: number[] | Buffer, offset = 0): boolean {
  const signature = Buffer.isBuffer(sig) ? sig : Buffer.from(sig)
  if (buf.length < offset + signature.length) {
    return false
  }
  return buf.slice(offset, offset + signature.length).equals(signature)
}

function validateByMagic(buf: Buffer, mimetype: string, ext: string): boolean {
  if (mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext)) {
    return match(buf, [0xff, 0xd8, 0xff], 0)
  }
  if (mimetype === 'image/png' && ext === '.png') {
    return match(
      buf,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      0,
    )
  }
  if (mimetype === 'image/gif' && ['.gif'].includes(ext)) {
    return (
      match(buf, Buffer.from('GIF87a')) || match(buf, Buffer.from('GIF89a'))
    )
  }
  if (mimetype === 'image/webp' && ext === '.webp') {
    return (
      match(buf, Buffer.from('RIFF'), 0) && match(buf, Buffer.from('WEBP'), 8)
    )
  }
  if (mimetype === 'application/pdf' && ext === '.pdf') {
    return match(buf, Buffer.from('%PDF-'), 0)
  }
  if (
    (mimetype === 'application/zip' && ext === '.zip') ||
    mimetype.includes('openxmlformats')
  ) {
    return match(buf, Buffer.from('PK\x03\x04'), 0)
  }
  if (mimetype === 'application/gzip' && ext === '.gz') {
    return match(buf, Buffer.from([0x1f, 0x8b]), 0)
  }
  if (mimetype === 'video/mp4' && ext === '.mp4') {
    return buf.includes(Buffer.from('ftyp'))
  }
  if (mimetype === 'audio/ogg' && ext === '.ogg') {
    return match(buf, Buffer.from('OggS'), 0)
  }
  if (mimetype === 'video/webm' && ext === '.webm') {
    return match(buf, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 0)
  }
  return true
}

export function createSignatureCheckStream(
  mimetype: string,
  ext: string,
  filename: string,
): Transform {
  let head = Buffer.alloc(0)
  let validated = false

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
          this.push(head)
          return callback()
        }
        return callback()
      }
      callback(null, chunk)
    },
    flush(callback: any) {
      if (!validated) {
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
