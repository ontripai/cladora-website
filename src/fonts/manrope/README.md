# Manrope Variable Webfont Asset (ANTIGRAVITY-AUTHENTICATED-APP-07 / CONTEXT-R1-AND-MANROPE)

- **Family**: Manrope
- **Designer**: Mikhail Sharanda
- **Version**: Official Upstream Release (Commit `468c0dbe38efa331b80bfe9448256abe27be44c3`)
- **Repository**: https://github.com/googlefonts/manrope
- **Google Fonts Specimen**: https://fonts.google.com/specimen/Manrope
- **License**: SIL Open Font License 1.1 ([OFL.txt](./OFL.txt))
- **CSS Variable**: `--font-manrope`
- **Display**: `swap`
- **Weights Configured**: `700`, `800`

## Upstream Provenance & Weights Inventory

Official upstream releases downloaded directly from `googlefonts/manrope`:

| File | Weight | Style | Size (bytes) | SHA256 Hash |
| :--- | :--- | :--- | :--- | :--- |
| `Manrope[wght].woff2` | 700, 800 (200–800 variable) | normal | 53,892 | `30b83738add8c9edd9e3450b98036a9a8fb5668d0cbd4eb0ce5fe6761197f21f` |
| `Manrope-Bold.woff2` | 700 | normal | 48,364 | `f6c44e9b1db0e702913beecd3d36e5e68636d6a9f34bffd59d2abbcce832a052` |
| `Manrope-ExtraBold.woff2` | 800 | normal | 46,868 | `80c47242b52c5b22c13b0cde5bdc80a77b5e17e1942912a8980d3264f9dc5ff7` |
| `Manrope-Regular.woff2` | 400 | normal | 47,252 | `37c93c1ddb69907608c9b81d66e21596daeeb1c302abeba5e1e0759ec4042ab5` |
| `Manrope-SemiBold.woff2` | 600 | normal | 47,796 | `7b67d96162af1c7591274debb1627db854e6361b970450f6cf3aab22463c40c5` |
| `OFL.txt` | SIL Open Font License 1.1 | — | 4,387 | `58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b` |

## Architecture & Integration

- Configured in `src/app/[lang]/layout.tsx` using `next/font/local`.
- Two explicit weight descriptors (`700`, `800`) reference `Manrope[wght].woff2`.
- Next.js Webpack asset pipeline emits a single hashed file and injects exactly one preload tag into the document `<head>`, eliminating duplicate preload requests and external Google Fonts network dependencies (`NextFontError: Failed to fetch Manrope from Google Fonts`).
- Preserves the approved typography, `--font-manrope` CSS variable, and visual appearance across English and Romanian marketing headings.
