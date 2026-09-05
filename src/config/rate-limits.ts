/**
 * Centralized Rate Limiting Configuration for Public Lead Forms
 *
 * Contact: 5 requests per 15 minutes (900 seconds)
 * Pilot:   3 requests per 15 minutes (900 seconds)
 */

export const RATE_LIMIT_CONFIG = {
  contact: {
    maxRequests: 5,
    windowSeconds: 15 * 60, // 900 seconds
  },
  pilot: {
    maxRequests: 3,
    windowSeconds: 15 * 60, // 900 seconds
  },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMIT_CONFIG;
