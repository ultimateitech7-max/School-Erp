'use client';

import { useEffect, useMemo, useState } from 'react';

const brandLetters = ['S', 'O', 'F', 'R', 'A'] as const;

export function InitialLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [minimumDelayPassed, setMinimumDelayPassed] = useState(false);

  useEffect(() => {
    const minDelayTimer = window.setTimeout(() => {
      setMinimumDelayPassed(true);
    }, 450);

    return () => {
      window.clearTimeout(minDelayTimer);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !minimumDelayPassed) {
      return;
    }

    let exitTimer = 0;

    const startExit = () => {
      setIsExiting(true);
      exitTimer = window.setTimeout(() => {
        setIsVisible(false);
      }, 680);
    };

    if (document.readyState === 'complete') {
      startExit();
    } else {
      window.addEventListener('load', startExit, { once: true });
    }

    return () => {
      window.removeEventListener('load', startExit);
      if (exitTimer) {
        window.clearTimeout(exitTimer);
      }
    };
  }, [isVisible, minimumDelayPassed]);

  const letterMarkup = useMemo(
    () =>
      brandLetters.map((letter, index) => (
        <span
          aria-hidden="true"
          className="sofra-loader-letter"
          key={`${letter}-${index}`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {letter}
        </span>
      )),
    [],
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`sofra-loader-overlay${isExiting ? ' sofra-loader-overlay-exit' : ''}`}
    >
      <div className="sofra-loader-mesh" />
      <div className="sofra-loader-shell">
        <div className="sofra-loader-wordmark">{letterMarkup}</div>
        <p className="sofra-loader-subtitle">SCHOOL ERP</p>
      </div>
    </div>
  );
}
