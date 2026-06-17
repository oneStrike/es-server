import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { normalizeNullableReferenceSchemas } from './swagger'

describe('normalizeNullableReferenceSchemas', () => {
  it('rewrites nullable single-ref allOf properties to direct nullable refs', () => {
    const document = {
      openapi: '3.0.1',
      info: {
        title: 'test',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          ChildDto: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
              },
            },
          },
          ParentDto: {
            type: 'object',
            properties: {
              child: {
                type: 'object',
                nullable: true,
                description: 'Child detail',
                allOf: [
                  {
                    $ref: '#/components/schemas/ChildDto',
                  },
                ],
              },
            },
          },
        },
      },
    } as OpenAPIObject

    normalizeNullableReferenceSchemas(document)

    expect(document.components?.schemas?.ParentDto).toMatchObject({
      properties: {
        child: {
          $ref: '#/components/schemas/ChildDto',
          nullable: true,
          description: 'Child detail',
        },
      },
    })
    expect(
      (document.components?.schemas?.ParentDto as any).properties.child,
    ).not.toHaveProperty('allOf')
    expect(
      (document.components?.schemas?.ParentDto as any).properties.child,
    ).not.toHaveProperty('type')
  })

  it('keeps required refs and real compositions unchanged', () => {
    const document = {
      openapi: '3.0.1',
      info: {
        title: 'test',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          ChildDto: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
              },
            },
          },
          ParentDto: {
            type: 'object',
            properties: {
              requiredChild: {
                allOf: [
                  {
                    $ref: '#/components/schemas/ChildDto',
                  },
                ],
              },
              composedChild: {
                nullable: true,
                allOf: [
                  {
                    $ref: '#/components/schemas/ChildDto',
                  },
                  {
                    type: 'object',
                    properties: {
                      extra: {
                        type: 'string',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    } as OpenAPIObject

    const before = JSON.parse(JSON.stringify(document.components?.schemas))

    normalizeNullableReferenceSchemas(document)

    expect(document.components?.schemas).toEqual(before)
  })
})
