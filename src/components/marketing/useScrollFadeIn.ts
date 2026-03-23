'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hook that returns a ref and a boolean indicating whether the element
 * has entered the viewport. Uses IntersectionObserver with a 10% threshold.
 * Once visible, it stays visible (no re-hiding on scroll out).
 */
export function useScrollFadeIn<T extends HTMLElement = HTMLElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { ref, isVisible };
}
