import {
  normalizeUnknownWorkflowError,
  sanitizeErrorDiagnostic,
  WorkflowErrorCodeEnum,
  WORKFLOW_ERROR_DIAGNOSTIC_LIMITS,
} from './workflow-error-facts'

describe('workflow error facts', () => {
  it('normalizes unexpected exceptions to the stable unknown workflow code', () => {
    const error = new Error('provider exploded')
    error.name = 'ProviderExplodedError'

    expect(normalizeUnknownWorkflowError(error, { jobId: 'job-1' })).toEqual(
      expect.objectContaining({
        code: WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR,
        context: {
          errorName: 'ProviderExplodedError',
          jobId: 'job-1',
        },
      }),
    )
  })

  it('bounds long nested diagnostics and redacts secret keys', () => {
    const longText = 'x'.repeat(
      WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticStringLength + 50,
    )
    const diagnostic = sanitizeErrorDiagnostic({
      diagnostic: {
        authorization: 'Bearer secret',
        child: {
          child: {
            child: {
              child: 'too deep',
            },
          },
        },
        list: Array.from({ length: 25 }, (_, index) => index),
        text: longText,
      },
      source: 'unit-test',
    })

    expect(diagnostic).toEqual(
      expect.objectContaining({
        diagnostic: expect.objectContaining({
          authorization: '[REDACTED]',
          list: expect.objectContaining({
            totalItems: 25,
            truncated: true,
          }),
          text: expect.stringContaining('[truncated:50]'),
        }),
        source: 'unit-test',
      }),
    )
  })

  it('summarizes diagnostics that exceed the total byte limit', () => {
    const diagnostic = sanitizeErrorDiagnostic({
      diagnostic: Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [
          `payload${index}`,
          'x'.repeat(WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticStringLength),
        ]),
      ),
    })

    expect(diagnostic).toEqual(
      expect.objectContaining({
        originalBytes: expect.any(Number),
        truncated: true,
        truncationReason: 'max-diagnostic-bytes',
      }),
    )
  })
})
