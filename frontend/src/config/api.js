/**
 * CodeSync AI — Centralized Frontend API & Socket Configuration
 *
 * Automatically falls back to http://localhost:5000 in local dev mode,
 * or resolves import.meta.env.VITE_API_URL / VITE_SOCKET_URL in production builds.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
