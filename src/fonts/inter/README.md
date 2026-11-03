# Inter Variable Webfont Asset (ANTIGRAVITY-AUTHENTICATED-APP-07 / INTER-STABILIZATION)

- **Family**: Inter
- **Designer**: Rasmus Andersson
- **Version**: v4.1
- **Repository**: https://github.com/rsms/inter
- **Upstream Commit**: `e3a3d4c57d5ecc01453a575621882a384c1995a3`
- **Google Fonts Specimen**: https://fonts.google.com/specimen/Inter
- **License**: SIL Open Font License 1.1 ([OFL.txt](./OFL.txt))
- **CSS Variable**: `--font-inter`
- **Display**: `swap`

## Upstream Provenance & Weights Inventory

Official upstream releases downloaded directly from `rsms/inter` tagged release `v4.1`:

| File | Weight | Style | Size (bytes) | SHA256 Hash |
| :--- | :--- | :--- | :--- | :--- |
| `InterVariable.woff2` | 400–800 (100–900 variable) | normal | 352,240 | `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3` |
| `Inter-Regular.woff2` | 400 | normal | 111,268 | `e06f6b1bc553aaea4e4668023ed0ab0a147129c3107f511bc7d03d361b0ae085` |
| `Inter-SemiBold.woff2` | 600 | normal | 114,812 | `5cb7103e4e605989afebc03d989c79201e54b21b5183db33981f70db9178a301` |
| `Inter-Bold.woff2` | 700 | normal | 114,840 | `fa888127b6da015b65569f0351f3b5c391ad928904951f1c20e9f8462a8d95ea` |
| `Inter-ExtraBold.woff2` | 800 | normal | 114,856 | `6f75025856f8db1b2186e9cb89be9de9894932c8b7b20f4df5e65916ff714e34` |
| `OFL.txt` | — | — | 4,380 | `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a` |

## Architecture & Preload Uniqueness

- Configured in `src/app/[lang]/layout.tsx` using `next/font/local`.
- Four explicit descriptors (`400`, `600`, `700`, `800`) reference `InterVariable.woff2`.
- Next.js Webpack asset pipeline emits a single hashed file and injects exactly **one unique `<link rel="preload">`** tag into the document `<head>`, eliminating duplicate preload requests and external Google Fonts network dependencies (`loader.js:122` null extension failures).
- Provides complete coverage for approved weights `400`, `600`, `700`, and `800` without synthetic browser font stretching.

## Unicode Codepoint Coverage
- Complete coverage for Basic Latin (`U+0020-U+007E`), Latin-1 Supplement (`U+00A0-U+00FF`), Latin Extended-A (`U+0100-U+017F`), Latin Extended-B (`U+0180-U+024F`).
- Comprehensive Romanian diacritics support: `ș` (`U+0219`), `Ș` (`U+0218`), `ț` (`U+021B`), `Ț` (`U+021A`), `ă` (`U+0103`), `Ă` (`U+0102`), `î` (`U+00EE`), `Î` (`U+00CE`), `â` (`U+00E2`), `Â` (`U+00C2`).
- OpenType layout feature tables: `GPOS`, `GSUB`, `GDEF`, `OS/2`, `cmap`, `head`, `hhea`, `hmtx`.
