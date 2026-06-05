import { useState, useCallback } from "react";

export function useServiceExpand() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setExpandedIndex(prev => (prev === index ? null : index));
  }, []);

  const expand = useCallback((index: number) => {
    setExpandedIndex(index);
  }, []);

  const collapse = useCallback((index: number) => {
    setExpandedIndex(prev => (prev === index ? null : prev));
  }, []);

  const isExpanded = (index: number) => expandedIndex === index;

  return { isExpanded, toggle, expand, collapse };
}
