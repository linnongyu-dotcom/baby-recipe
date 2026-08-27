import posthog from 'posthog-js';

type AnalyticsEvent = 'app_open';
type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

let analyticsEnabled = false;
let appOpenTracked = false;

/** Initialize analytics once. Missing configuration leaves analytics disabled. */
export function initializeAnalytics(): void {
  if (analyticsEnabled) return;

  const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
  const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim();

  if (!projectToken || !apiHost) {
    if (import.meta.env.DEV) {
      console.info('[饭小宝] PostHog 未配置，分析事件不会上报。');
    }
    return;
  }

  try {
    posthog.init(projectToken, {
      api_host: apiHost,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });
    analyticsEnabled = true;
  } catch {
    // Analytics must never prevent the application from starting.
    analyticsEnabled = false;
  }
}

/** Send an approved product event without exposing the SDK to business code. */
export function track(eventName: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (!analyticsEnabled) return;

  try {
    posthog.capture(eventName, properties);
  } catch {
    // Analytics failures must not affect product behavior.
  }
}

/** Report one app_open per document load, including under React StrictMode. */
export function trackAppOpen(): void {
  if (appOpenTracked) return;

  appOpenTracked = true;
  track('app_open');
}
