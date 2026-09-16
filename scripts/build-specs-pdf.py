#!/usr/bin/env python3
"""Build a single styled PDF from the Ultreia specs."""

from __future__ import annotations

import argparse
import re
from datetime import datetime
from pathlib import Path


PDF_ACCENT = "#0078d4"
PDF_ACCENT2 = "#106ebe"


def repository_root() -> Path:
    return Path(__file__).resolve().parents[1]


def ordered_spec_files(specs_dir: Path) -> list[Path]:
    section_pattern = re.compile(r"^(\d{2})-")
    section_dirs = []
    for path in specs_dir.iterdir():
        match = section_pattern.match(path.name)
        if path.is_dir() and match and 0 <= int(match.group(1)) <= 8:
            section_dirs.append(path)

    files: list[Path] = []
    for section_dir in sorted(section_dirs, key=lambda item: item.name):
        markdown_files = sorted(section_dir.glob("*.md"), key=lambda item: item.name)
        readme = section_dir / "README.md"
        if readme in markdown_files:
            files.append(readme)
            markdown_files = [item for item in markdown_files if item != readme]
        files.extend(markdown_files)
    return files


def build_combined_markdown(spec_files: list[Path], specs_dir: Path) -> str:
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Ultreia - Especificación del Prototipo",
        "",
        f"**Generado:** {generated_at}",
        "",
        "**Contenido:** secciones `00` a `08` de `docs/specs`.",
        "",
        "## Índice",
        "",
        "[TOC]",
        "",
    ]

    for index, spec_file in enumerate(spec_files):
        relative_path = spec_file.relative_to(specs_dir.parent)
        if index > 0:
            lines.extend(["", '<div class="page-break"></div>', ""])
        else:
            lines.extend(["", '<div class="page-break"></div>', ""])

        lines.extend([
            f'<p class="source-path">{relative_path.as_posix()}</p>',
            "",
            spec_file.read_text(encoding="utf-8").strip(),
            "",
        ])

    return "\n".join(lines).rstrip() + "\n"


def markdown_pdf_html(markdown_text: str) -> str:
    try:
        import markdown
    except ImportError as error:
        raise RuntimeError("markdown is required. Run: pip install markdown weasyprint") from error

    html_body = markdown.markdown(markdown_text, extensions=["tables", "fenced_code", "toc"])
    return f"""<!DOCTYPE html>
<html><head><meta charset=\"utf-8\">
<style>
  @page {{
    size: A4;
    margin: 1.5cm;
    @bottom-right {{ content: counter(page); color: #777; font-size: 8pt; }}
  }}
  body {{ font-family: Segoe UI, Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1a1a1a; }}
  h1 {{ color: {PDF_ACCENT}; font-size: 20pt; border-bottom: 2px solid {PDF_ACCENT}; padding-bottom: 6px; page-break-after: avoid; }}
  h2 {{ color: {PDF_ACCENT2}; font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }}
  h3 {{ color: #333; font-size: 12pt; margin-top: 16px; page-break-after: avoid; }}
  h4 {{ color: #333; font-size: 10.5pt; margin-top: 12px; page-break-after: avoid; }}
  h5 {{ color: #333; font-size: 10pt; margin-top: 10px; page-break-after: avoid; }}
  table {{ border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt; }}
  th {{ background-color: {PDF_ACCENT}; color: white; padding: 6px 8px; text-align: left; }}
  td {{ padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; word-break: break-word; }}
  tr:nth-child(even) {{ background-color: #f5f5f5; }}
  a {{ color: {PDF_ACCENT2}; text-decoration: none; }}
  .toc {{ border: 1px solid #ddd; padding: 10px 14px; margin: 12px 0; background: #fafafa; }}
  .toc ul {{ margin: 4px 0 4px 18px; padding: 0; }}
  .toc a {{ color: {PDF_ACCENT2}; text-decoration: none; }}
  .page-break {{ break-before: page; page-break-before: always; height: 0; }}
  .source-path {{ color: #666; font-size: 8.5pt; margin: 0 0 10px 0; }}
  code {{ background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 9pt; font-family: Consolas, monospace; }}
  pre {{ background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; font-size: 8.5pt; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }}
  pre code {{ background: none; color: inherit; padding: 0; }}
  strong {{ color: {PDF_ACCENT}; }}
  hr {{ border: none; border-top: 1px solid #ccc; margin: 16px 0; }}
  p {{ margin: 6px 0; }}
</style>
</head><body>{html_body}</body></html>"""


def render_pdf(markdown_text: str, output_path: Path) -> None:
    try:
        from weasyprint import HTML
    except ImportError as error:
        raise RuntimeError("weasyprint is required. Run: pip install markdown weasyprint") from error

    output_path.parent.mkdir(parents=True, exist_ok=True)
    html = markdown_pdf_html(markdown_text)
    HTML(string=html, base_url=str(output_path.parent)).write_pdf(str(output_path))


def main() -> int:
    root = repository_root()
    parser = argparse.ArgumentParser(description="Build the Ultreia specs PDF.")
    parser.add_argument("--specs-dir", type=Path, default=root / "docs" / "specs")
    parser.add_argument("--output", type=Path, default=root / "docs" / "ultreia-specs.pdf")
    parser.add_argument("--markdown-output", type=Path, default=None)
    args = parser.parse_args()

    specs_dir = args.specs_dir.resolve()
    output_path = args.output.resolve()
    spec_files = ordered_spec_files(specs_dir)
    if not spec_files:
        raise RuntimeError(f"No spec Markdown files found under {specs_dir}")

    combined_markdown = build_combined_markdown(spec_files, specs_dir)
    if args.markdown_output:
        markdown_output = args.markdown_output.resolve()
        markdown_output.parent.mkdir(parents=True, exist_ok=True)
        markdown_output.write_text(combined_markdown, encoding="utf-8")
        print(f"Wrote combined Markdown: {markdown_output}")

    render_pdf(combined_markdown, output_path)
    print(f"Rendered {len(spec_files)} spec files to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())