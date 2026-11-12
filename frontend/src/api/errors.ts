/**
 * Error codes the UI knows how to explain. A real backend should send one of
 * these as `error.code` (see docs/api-contract.md); anything else maps to
 * `UNKNOWN`.
 */
export const ANALYSIS_ERROR_CODES = [
  'INVALID_CHANNEL',
  'COMMENTS_UNAVAILABLE',
  'QUOTA_EXHAUSTED',
  'NETWORK',
  'UNKNOWN',
] as const;

export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  /** ISO timestamp after which retrying is expected to work (quota reset). */
  readonly retryAt: string | null;

  constructor(code: AnalysisErrorCode, message: string, options: { retryAt?: string | null; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'AnalysisError';
    this.code = code;
    this.retryAt = options.retryAt ?? null;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof TypeError) {
    // fetch() rejects with TypeError when the network is unreachable.
    return new AnalysisError('NETWORK', 'The analysis service could not be reached.', { cause: error });
  }
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  return new AnalysisError('UNKNOWN', message, { cause: error });
}
