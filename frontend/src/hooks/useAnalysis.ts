import { useCallback, useEffect, useRef, useState } from 'react';
import { type AnalysisError, isAbortError, toAnalysisError } from '../api/errors';
import type { AnalysisService } from '../api/service';
import type { AnalysisProgress, AnalysisRequest, AnalysisResult } from '../api/types';

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; request: AnalysisRequest; progress: AnalysisProgress }
  | { status: 'success'; request: AnalysisRequest; result: AnalysisResult }
  | { status: 'error'; request: AnalysisRequest; error: AnalysisError };

const INITIAL_PROGRESS: AnalysisProgress = { status: 'queued', progress: 0, step: 'Queued' };

/**
 * Runs one analysis at a time. Starting a new run aborts the previous one, so
 * a slow earlier response can never overwrite a newer result.
 */
export function useAnalysis(service: AnalysisService) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (request: AnalysisRequest) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'loading', request, progress: INITIAL_PROGRESS });

      try {
        const result = await service.runAnalysis(request, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (!controller.signal.aborted) setState({ status: 'loading', request, progress });
          },
        });
        if (!controller.signal.aborted) setState({ status: 'success', request, result });
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) return;
        setState({ status: 'error', request, error: toAnalysisError(error) });
      }
    },
    [service],
  );

  return { state, run };
}
