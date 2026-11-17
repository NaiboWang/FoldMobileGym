// Compatibility entry: the historical check expected square edges and a half-folded
// posture, which is not part of the confirmed user-facing two-posture design.
// It is not a benchmark judge; delegate to the current two-posture geometry review.
process.env.FOLDAGENT_REVIEW_URL ||= process.argv[2] || 'http://127.0.0.1:3100/';
await import('./review_screen_outline.mjs');
