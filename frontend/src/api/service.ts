import type {
  AnalysisProgress,
  AnalysisRequest,
  AnalysisResult,
  CommentFilter,
  CommentPage,
  DataSource,
} from './types';

export interface RunAnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * The only boundary between the UI and wherever analysis data comes from.
 *
 * Phase 1 ships a deterministic mock (`src/mock/mockAnalysisService.ts`).
 * A FastAPI-backed implementation should:
 *   - `runAnalysis`: `POST /analyses`, then poll `GET /analyses/{key}` until
 *     `status` is `done` or `error`, reporting `progress`/`step` via onProgress.
 *   - `getComments`: `GET /analyses/{key}/comments` with the filter as query params.
 *   - Reject with `AnalysisError` (see ./errors.ts) for every failure.
 * See docs/api-contract.md for the proposed payloads and open questions.
 */
export interface AnalysisService {
  readonly source: DataSource;
  runAnalysis(request: AnalysisRequest, options?: RunAnalysisOptions): Promise<AnalysisResult>;
  getComments(key: string, filter: CommentFilter, options?: RequestOptions): Promise<CommentPage>;
}
