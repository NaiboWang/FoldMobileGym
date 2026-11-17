# Exact Map Roboto symbols snapshots

These two **unmodified** WOFF2 responses were retrieved on 2026-10-25 from
Google Fonts at the exact URLs in `manifest.json`. They are separately identified
resources, not aliases for the existing Latin subset or for one another.

Original consumers (not rewritten):
- Raster: `apps/Map/sw/files/87e857d8b02e10a1.css`
- Vector: `mobilegym-data/map/vector/files/d9154cd59f8b0884.css`

Both original CSS files label these faces `symbols`, weight 300/400/500/700.
FontTools independently decodes each as Roboto, variable wght 100–900, with 78
cmap entries and a https://openfontlicense.org license URL. The CSS unicode range
is not proof that every codepoint in that range exists in the font.

Copyright 2011 The Roboto Project Authors. Redistributed under SIL OFL 1.1;
complete copyright and permission notice are in `OFL.txt`. License source is
recorded in the manifest. No executable third-party code is added.

Vite's existing App asset plugin publishes this directory under
`@app-assets/Map/offline-fonts/`. The owned Map SW pins exact source URLs, sizes,
WOFF2 signatures and SHA256 values, validating both local fetches and cached
responses. Its tests compare those pins with this provenance manifest and bytes.
Unknown requests and failed validation retain the original miss/network behavior.
This does not bundle Google Sans, text-kit or certify all media/font coverage.
