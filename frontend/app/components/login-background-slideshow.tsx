"use client";

import { useEffect, useMemo, useState } from "react";

type LoginBackgroundSlideshowProps = {
  slides: string[];
};

export default function LoginBackgroundSlideshow({ slides }: LoginBackgroundSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeSlides = useMemo(() => Array.from(new Set(slides)).filter(Boolean), [slides]);

  useEffect(() => {
    if (safeSlides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % safeSlides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [safeSlides]);

  if (!safeSlides.length) {
    return <div className="login-bg login-bg-fallback" aria-hidden="true" />;
  }

  return (
    <div className="login-bg" aria-hidden="true">
      {safeSlides.map((slide, index) => (
        <div
          key={`${slide}-${index}`}
          className={`login-bg-slide${index === activeIndex ? " is-active" : ""}`}
          style={{ backgroundImage: `url(${slide})` }}
        />
      ))}
    </div>
  );
}
