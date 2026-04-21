import { extractPlainTextFromRichTextContent } from './richText'

describe('extractPlainTextFromRichTextContent', () => {
  it('extracts readable text from html rich text content', () => {
    const content =
      '  <p>欢迎来到<strong>论坛</strong></p><p>&nbsp;一起交流 TypeScript 经验</p>  '

    expect(extractPlainTextFromRichTextContent(content)).toBe(
      '欢迎来到论坛 一起交流 TypeScript 经验',
    )
  })

  it('extracts readable text from json rich text content', () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '富文本标题回退',
            },
            {
              type: 'text',
              text: '需要提纯正文',
            },
          ],
        },
      ],
    })

    expect(extractPlainTextFromRichTextContent(content)).toBe(
      '富文本标题回退需要提纯正文',
    )
  })

  it('falls back to normalized plain text when content is not rich text', () => {
    const content =
      '  这是一个没有单独标题时用于自动生成标题的正文内容示例，用来验证只截取前三十个字符  '

    expect(extractPlainTextFromRichTextContent(content)).toBe(content.trim())
  })
})
