# foldmobilegym browser extension

This local Chrome/Edge Manifest V3 extension controls folded/unfolded posture and existing multi-window tasks. No build step is required.

1. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
2. Select **Load unpacked** and choose this directory (`tools/browser-extension/`).
3. Open the local simulator, for example `http://127.0.0.1:3100/`, then click the extension toolbar icon.
4. Select Fold or Unfold. For split screen, first open distinct applications in the simulator, refresh the extension task list, select tasks and apply the layout.

There is no half-folded mode. The extension does not open applications, send messages, make purchases or upload data. It uses only `activeTab` and `scripting`, with no background service or automatic injection. Only HTTP loopback pages without embedded credentials are accepted. Benchmark pages allow reading state but reject layout writes.

Run `node --test tools/browser-extension/test_bridge.mjs` from the repository root.
With the local preview running, `tools/reviews/review_extension_popup.mjs` also
installs the extension in an isolated Edge/Chrome session and automatically
triggers the browser action to check temporary tab permission, popup controls,
split/fold and benchmark read-only behavior. Set `FOLDAGENT_REVIEW_URL` to the
loopback preview address. This automated check is not a substitute for a user
installing and clicking the extension in their own browser. No extension is
installed into a user's personal browser profile by the check.
