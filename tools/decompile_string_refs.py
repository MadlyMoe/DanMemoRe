"""List readable client strings referenced by each targeted Ghidra decompile."""

from pathlib import Path
import argparse
import re


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    parser.add_argument("decompile", type=Path)
    parser.add_argument("--bias", type=lambda value: int(value, 0), default=0x100000)
    args = parser.parse_args()
    blob = args.binary.read_bytes()
    text = args.decompile.read_text(encoding="utf-8")
    headings = list(re.finditer(r"^===== (.+?) =====$", text, re.MULTILINE))
    for index, heading in enumerate(headings):
        section = text[heading.end() : headings[index + 1].start() if index + 1 < len(headings) else len(text)]
        strings = set()
        for match in re.finditer(r"\b(?:UNK|DAT)_([0-9a-fA-F]+)\b", section):
            offset = int(match.group(1), 16) - args.bias
            if not 0 <= offset < len(blob):
                continue
            end = blob.find(b"\0", offset, min(offset + 256, len(blob)))
            if end <= offset:
                continue
            try:
                value = blob[offset:end].decode("utf-8")
            except UnicodeDecodeError:
                continue
            if value.isprintable() and any(character.isalnum() for character in value):
                strings.add(value)
        print(f"{heading.group(1)}\n  " + "\n  ".join(sorted(strings)))


if __name__ == "__main__":
    main()
