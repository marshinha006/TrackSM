"use client";

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8080`;
  }

  return "http://localhost:8080";
}
