# OpenAnalytics

Browser tracker: v0.8.0, pinned upstream commit `a07da7020810d3a975524daad2a544c9205ea65e`. The vendored asset includes its MIT license.

Rebuild: `bun scripts/build-openanalytics.mjs web/public/openanalytics-v0.8.0.js`. The small bootstrap patch applies query redaction, domain validation and disabled heatmap collection before the first request. Remote site settings still refresh normally.

Pageviews, realtime, engagement/scroll and Web Vitals are enabled. Custom events are available through `window.oa.track`, but no custom events or identity calls are installed. Normal browser storage is used. DNT/GPC and consent waiting are disabled in the snippet. Public dashboard and revenue attribution are disabled in the control plane. Timezone: Europe/Istanbul.

Query values are redacted; route paths are preserved. The tracker key is public, not an administration credential.
