# OCR Lens

Lightweight local document lens for reducing Codex token use before reading
PDFs or screenshots.

This is not DeepSeek-OCR. It is the cheap first stage:

```text
PDF/image/text sidecar -> local extraction -> compact markdown/json -> Codex reads the lens
```

DeepSeek-OCR, PaddleOCR, or another OCR/VLM backend can be plugged in later for
scanned pages. The current backend deliberately avoids heavy GPU dependencies.

## Invariant

The useful invariant from DeepSeek-OCR is not the exact model. It is the route:

```text
expensive linear text stream
  -> cheaper intermediate representation
  -> stable pointers back to source coordinates
```

For Theseus, the isomorphic local form is:

```text
page / region / URL / checksum
  -> page card / heading / link / warning
  -> selective deep read only where needed
```

That keeps the compression useful without pretending a lightweight extractor has
the same visual reasoning ability as DeepSeek-OCR.

## Commands

```text
node tools/ocr_lens/ocr_lens.mjs doctor
node tools/ocr_lens/ocr_lens.mjs "C:\path\document.pdf" --write
node tools/ocr_lens/ocr_lens.mjs "C:\path\document.md" --write
node tools/ocr_lens/ocr_lens.mjs "C:\path\document.pdf" --write --json
```

Outputs are ignored by Git:

```text
outputs/ocr_lens/latest.md
outputs/ocr_lens/latest.json
outputs/ocr_lens/<document>-<hash>.lens.md
outputs/ocr_lens/<document>-<hash>.lens.json
```

## Statuses

- `text_ready`: embedded PDF text or a text sidecar was extracted with good coverage.
- `partial_text`: some pages have text and some probably need OCR.
- `needs_ocr_backend`: no useful embedded text was found.

## Why This Exists

Reading whole PDFs directly through Codex burns weekly usage. This tool creates
a compact, cited-by-page layer first, so the agent can decide which parts need
deeper reading or external OCR.
