# Vazirmatn Variable Webfont Asset (VAZIRMATN-DETERMINISTIC-BUILD-04 / FONT-PERFORMANCE-05)

- **Family**: Vazirmatn
- **Designer**: Saber Rastikerdar
- **Version**: v33.003
- **Repository**: https://github.com/rastikerdar/vazirmatn
- **Upstream Commit**: `83629f877e8f084cc07b47030b5d3a0ff06c76ec`
- **Google Fonts Entry**: https://fonts.google.com/specimen/Vazirmatn
- **License**: SIL Open Font License 1.1 ([OFL.txt](./OFL.txt))
- **CSS Variable**: `--font-vazirmatn`
- **Display**: `swap`

## Source & Conversion Provenance

- **Input Source**: `fonts/variable/Vazirmatn[wght].ttf`
  - Size: 241,328 bytes
  - SHA256: `696249a2c74b39ffdef55de4df2809c5b639d3ff80d618d8160a095d2fd49dca`
- **Format-Only Conversion Command**:
  ```python
  from fontTools.ttLib import TTFont
  font = TTFont('Vazirmatn[wght].ttf', recalcTimestamp=False)
  font.flavor = 'woff2'
  font.save('Vazirmatn[wght].woff2')
  ```
- **Tool Versions**: `fontTools==4.57.0`, `Brotli==1.1.0`
- **Output Asset**: `Vazirmatn[wght].woff2`
  - Size: 111,152 bytes
  - SHA256: `4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92`

## Architecture & Preload Uniqueness
- Configured in `src/app/[lang]/layout.tsx` using `next/font/local`.
- Four explicit descriptors (`400`, `600`, `700`, `800`) all reference the shared `Vazirmatn[wght].woff2` file.
- Next.js Webpack asset pipeline emits a single hashed file and injects exactly **one unique `<link rel="preload">`** tag (111,152 bytes total) into the document `<head>`, eliminating redundant preload requests while preserving explicit font-matching behavior for intermediate weights.

## Exact Cmap Codepoint Coverage
- The `cmap` subtable (format 4) contains exactly **811 unique codepoints**:
  - Full Persian orthography support: گ (`U+06AF`), چ (`U+0686`), پ (`U+067E`), ژ (`U+0698`), ک (`U+06A9`), ی (`U+06CC`), Persian digits ۰-۹ (`U+06F0-U+06F9`), and ZWNJ / نیم‌فاصله (`U+200C`).
  - Standard Arabic letters (`U+0621-U+063A`, `U+0641-U+064A`), Arabic-Indic numerals (`U+0660-U+0669`), and common Arabic diacritics.
  - Basic Latin (`U+0020-U+007E`) and Latin-1 Supplement (`U+00A0-U+00FF`).
  - *Note:* Does not cover obsolete historical or non-standard extended Quranic blocks outside Vazirmatn's design scope; this 811-codepoint repertoire reflects the exact official upstream design.
