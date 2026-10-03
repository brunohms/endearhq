import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { PAGE_SIZE } from "./api.js";

export function usePaging() {
  const [params, setParams] = useSearchParams();

  const requested = Number(params.get("page"));
  const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;

  const setPage = useCallback(
    (next: number) => {
      setParams(next <= 1 ? {} : { page: String(next) });
    },
    [setParams],
  );

  return { page, offset: (page - 1) * PAGE_SIZE, setPage };
}
