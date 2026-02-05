import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "phc_placeholder_key";
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";

export const Fishbird = {
  init: () => {
    if (import.meta.env.DEV && POSTHOG_KEY === "phc_placeholder_key") {
      
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true, // Auto-capture button clicks
      capture_pageview: false,
    });
  },

  identify: (userId: string, traits?: Record<string, any>) => {
    posthog.identify(userId, traits);
  },

  track: (eventName: string, properties?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      
    }
    posthog.capture(eventName, properties);
  },

  pageView: () => {
    posthog.capture("$pageview");
  },
};
