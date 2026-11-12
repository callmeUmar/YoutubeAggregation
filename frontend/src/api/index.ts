import { createMockAnalysisService } from '../mock/mockAnalysisService';
import type { AnalysisService } from './service';

export type { AnalysisService } from './service';
export { AnalysisError, type AnalysisErrorCode } from './errors';

/**
 * Picks the data source for the app.
 *
 * Phase 1: there is no backend integration yet, so this always returns the
 * deterministic DEMO DATA service. When the FastAPI contract is agreed, add an
 * HTTP implementation of `AnalysisService` and select it here (for example via
 * a `VITE_API_BASE_URL` env variable). Nothing else in the UI should change.
 */
export function createAnalysisService(): AnalysisService {
  return createMockAnalysisService();
}
