"use client";

import { useEffect } from "react";

export default function DetailScrollLock() {
  useEffect(() => {
    document.body.classList.add("detail-scroll-lock");
    return () => {
      document.body.classList.remove("detail-scroll-lock");
    };
  }, []);

  return null;
}
