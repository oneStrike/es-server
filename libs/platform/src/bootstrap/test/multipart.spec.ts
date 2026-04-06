import { UploadConfig } from '@libs/platform/config/upload.config';
import {
  resolveStaticFileHeaders,
  SVG_CONTENT_SECURITY_POLICY,
} from '../multipart'

describe('multipart static header policy', () => {
  it('adds dedicated security headers for svg files', () => {
    expect(
      resolveStaticFileHeaders('/uploads/public/shared/icon.svg', UploadConfig),
    ).toEqual({
      'Content-Security-Policy': SVG_CONTENT_SECURITY_POLICY,
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  it('keeps attachment headers for document files', () => {
    expect(
      resolveStaticFileHeaders('/uploads/public/shared/manual.pdf', UploadConfig),
    ).toEqual({
      'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  it('does not add extra headers for regular raster images', () => {
    expect(
      resolveStaticFileHeaders('/uploads/public/shared/avatar.png', UploadConfig),
    ).toEqual({})
  })
})
