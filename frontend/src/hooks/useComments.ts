import { useCallback, useEffect, useRef, useState } from 'react';
import { type AnalysisError, isAbortError, toAnalysisError } from '../api/errors';
import type { AnalysisService } from '../api/service';
import type { CommentEvidence, CommentFilter } from '../api/types';

interface LoadedPages {
  /** The filter + reload token these pages belong to. */
  filter: CommentFilter;
  token: number;
  items: CommentEvidence[];
  total: number;
  nextCursor: string | null;
  error: AnalysisError | null;
  loadingMore: boolean;
  loadMoreError: AnalysisError | null;
}

export type CommentsStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Loads the first page of comments whenever `filter` changes (pass `null` for
 * none), and appends further pages on `loadMore()`. Responses for an outdated
 * filter are aborted and ignored. `filter` must be memoized by the caller.
 */
export function useComments(service: AnalysisService, analysisKey: string, filter: CommentFilter | null) {
  const [pages, setPages] = useState<LoadedPages | null>(null);
  const [token, setToken] = useState(0);
  const moreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!filter) return;
    const controller = new AbortController();
    moreControllerRef.current?.abort();

    service
      .getComments(analysisKey, filter, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setPages({ filter, token, ...page, error: null, loadingMore: false, loadMoreError: null });
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        setPages({
          filter,
          token,
          items: [],
          total: 0,
          nextCursor: null,
          error: toAnalysisError(error),
          loadingMore: false,
          loadMoreError: null,
        });
      });

    return () => controller.abort();
  }, [service, analysisKey, filter, token]);

  const current = pages && filter && pages.filter === filter && pages.token === token ? pages : null;
  const status: CommentsStatus = !filter ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'success';

  const loadMore = useCallback(() => {
    if (!current?.nextCursor || current.loadingMore) return;
    const controller = new AbortController();
    moreControllerRef.current?.abort();
    moreControllerRef.current = controller;
    const owner = current;
    setPages((p) => (p === owner ? { ...p, loadingMore: true, loadMoreError: null } : p));

    service
      .getComments(analysisKey, { ...owner.filter, cursor: owner.nextCursor }, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setPages((p) =>
          p && p.filter === owner.filter && p.token === owner.token
            ? { ...p, items: [...p.items, ...page.items], total: page.total, nextCursor: page.nextCursor, loadingMore: false }
            : p,
        );
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        setPages((p) =>
          p && p.filter === owner.filter ? { ...p, loadingMore: false, loadMoreError: toAnalysisError(error) } : p,
        );
      });
  }, [service, analysisKey, current]);

  const retry = useCallback(() => setToken((n) => n + 1), []);

  return {
    status,
    items: current?.items ?? [],
    total: current?.total ?? 0,
    nextCursor: current?.nextCursor ?? null,
    error: current?.error ?? null,
    loadingMore: current?.loadingMore ?? false,
    loadMoreError: current?.loadMoreError ?? null,
    loadMore,
    retry,
  };
}
