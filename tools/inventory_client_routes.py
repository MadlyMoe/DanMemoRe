"""Map native API route strings to their AArch64 wrapper functions."""

from bisect import bisect_right
from pathlib import Path
import argparse
import hashlib
import json
import struct

def sections(blob):
    shoff = struct.unpack_from("<Q", blob, 0x28)[0]
    shentsize, shnum, shstrndx = struct.unpack_from("<HHH", blob, 0x3A)
    headers = [struct.unpack_from("<IIQQQQIIQQ", blob, shoff + i * shentsize) for i in range(shnum)]
    strings = headers[shstrndx]
    names = blob[strings[4] : strings[4] + strings[5]]
    result = {}
    for header in headers:
        end = names.find(b"\0", header[0])
        result[names[header[0] : end].decode()] = {"address": header[3], "offset": header[4], "size": header[5]}
    return result


def unwind_starts(blob, section):
    offset, address = section["offset"], section["address"]
    version, frame_encoding, count_encoding, table_encoding = struct.unpack_from("4B", blob, offset)
    if (version, frame_encoding, count_encoding, table_encoding) != (1, 0x1B, 0x03, 0x3B):
        raise ValueError("Unsupported .eh_frame_hdr encoding")
    count = struct.unpack_from("<I", blob, offset + 8)[0]
    return [address + struct.unpack_from("<i", blob, offset + 12 + i * 8)[0] for i in range(count)]


def route_addresses(rodata, rodata_address, candidates):
    result = {}
    # Pooling is byte-level, not component-level: pvp/player_info/get lives
    # inside under_pvp/player_info/get. Keep every path-shaped suffix;
    # contracts() still requires an actual reference from a network wrapper.
    routes = {candidate[index:] for candidate in candidates
              for index, character in enumerate(candidate)
              if "a" <= character <= "z" and "/" in candidate[index:]}
    for route in sorted(routes):
        needle = route.encode() + b"\0"
        start = 0
        while (found := rodata.find(needle, start)) >= 0:
            result[rodata_address + found] = route
            start = found + 1
    return result


def signed(value, bits):
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


def function_metadata(blob, text, rodata, start, end):
    offset = text["offset"] + start - text["address"]
    code = blob[offset : offset + end - start]
    words = struct.unpack(f"<{len(code) // 4}I", code[: len(code) & ~3])
    modes, strings = set(), set()
    for index, instruction in enumerate(words):
        address = start + index * 4
        if instruction & 0xFC000000 == 0x94000000:
            target = address + (signed(instruction & 0x03FFFFFF, 26) << 2)
            if target == 0x209AEEC:
                modes.add("empty")
            elif target == 0x209B70C:
                modes.add("json")
        if instruction & 0x9F000000 != 0x90000000:
            continue
        register = instruction & 31
        immediate = signed(((instruction >> 29) & 3) | (((instruction >> 5) & 0x7FFFF) << 2), 21)
        page = (address & ~0xFFF) + (immediate << 12)
        for add in words[index + 1 : index + 9]:
            if add & 0xFF000000 != 0x91000000 or (add >> 5) & 31 != register:
                continue
            target = page + (((add >> 10) & 0xFFF) << (12 if add & 0x400000 else 0))
            if not rodata["address"] <= target < rodata["address"] + rodata["size"]:
                continue
            raw = rodata["offset"] + target - rodata["address"]
            zero = blob.find(b"\0", raw, min(raw + 256, len(blob)))
            if zero <= raw:
                continue
            try:
                value = blob[raw:zero].decode("utf-8")
            except UnicodeDecodeError:
                continue
            if value.isprintable() and any(character.isalnum() for character in value):
                strings.add(value)
    return {"modes": sorted(modes), "strings": sorted(strings)}


def stage_dispatch_routes(blob, table):
    """15.1.0's shared completion wrapper selects routes through relocated pointers.

    ADRP/ADD string scanning cannot see these seven mode-specific handoffs.
    Check the actual index/bounds/load instructions before using this mapping;
    a different client must be investigated, not silently mapped as 15.1.0.
    """
    text = table[".text"]
    raw = text["offset"] + 0x24731A0 - text["address"]
    expected = (0x51003008, 0x7100451F, 0x540000A2, 0xD000F209, 0x91156129, 0xF868D938)
    if raw < 0 or raw + 24 > len(blob) or struct.unpack_from("<6I", blob, raw) != expected:
        raise ValueError("Unsupported stage-route dispatch; expected verified 15.1.0 instructions")
    rela = table[".rela.dyn"]
    pointers = {address: target for address, info, target in struct.iter_unpack(
        "<QQq", blob[rela["offset"]:rela["offset"] + rela["size"]]) if info == 1027}
    rodata = table[".rodata"]
    result = {}
    for adventure_type in range(12, 29):
        slot = 0x42B5558 + (adventure_type - 12) * 8
        target = pointers.get(slot)
        if target is None or not rodata["address"] <= target < rodata["address"] + rodata["size"]:
            raise ValueError(f"Missing stage-route relocation for adventure type {adventure_type}")
        raw = rodata["offset"] + target - rodata["address"]
        zero = blob.find(b"\0", raw, min(raw + 80, rodata["offset"] + rodata["size"]))
        if zero < 0:
            raise ValueError("Unterminated stage route")
        route = blob[raw:zero].decode("ascii")
        if not route.endswith("/stage/complete"):
            raise ValueError(f"Unexpected stage route {route}")
        item = result.setdefault(route, {"route": route, "string": target, "xref": 0x24731B4,
            "start": 0x2472BEC, "end": 0x2473704, "dispatchTable": 0x42B5558, "adventureTypes": []})
        item["adventureTypes"].append(adventure_type)
    return list(result.values())


def contracts(references):
    result = {}
    for item in references:
        if not item["modes"]:
            continue
        row = result.setdefault(item["route"], {"modes": [], "strings": [], "wrappers": []})
        for key, values in (("modes", item["modes"]), ("strings", item["strings"]),
                            ("wrappers", [[item["start"], item["end"]]])):
            row[key] = sorted({tuple(value) if isinstance(value, list) else value for value in row[key] + values})
        if "adventureTypes" in item:
            row["stageDispatch"] = {"table": item["dispatchTable"], "xref": item["xref"],
                                    "adventureTypes": item["adventureTypes"]}
    return dict(sorted(result.items()))


def inventory(binary, routes):
    blob = binary.read_bytes()
    table = sections(blob)
    text, rodata, unwind = table[".text"], table[".rodata"], table[".eh_frame_hdr"]
    targets = route_addresses(
        blob[rodata["offset"] : rodata["offset"] + rodata["size"]],
        rodata["address"],
        [line.strip() for line in routes.read_text(encoding="utf-8").splitlines() if line.strip()],
    )
    starts = unwind_starts(blob, unwind)
    found = stage_dispatch_routes(blob, table)
    code = blob[text["offset"] : text["offset"] + text["size"]]
    words = struct.unpack(f"<{len(code) // 4}I", code[: len(code) & ~3])
    for word_index, instruction in enumerate(words):
        if instruction & 0x9F000000 != 0x90000000:
            continue
        address = text["address"] + word_index * 4
        register = instruction & 31
        immediate = signed(((instruction >> 29) & 3) | (((instruction >> 5) & 0x7FFFF) << 2), 21)
        page = (address & ~0xFFF) + (immediate << 12)
        for add_index in range(word_index + 1, min(word_index + 9, len(words))):
            add = words[add_index]
            if add & 0xFF000000 != 0x91000000 or (add >> 5) & 31 != register:
                continue
            target = page + (((add >> 10) & 0xFFF) << (12 if add & 0x400000 else 0))
            if target not in targets:
                continue
            xref = text["address"] + add_index * 4
            index = bisect_right(starts, xref) - 1
            if index >= 0:
                found.append({"route": targets[target], "string": target, "xref": xref,
                    "start": starts[index], "end": starts[index + 1] if index + 1 < len(starts) else text["address"] + text["size"]})
    result = sorted({(item["route"], item["start"], item["end"], item["xref"]): item for item in found}.values(),
        key=lambda item: (item["route"], item["start"], item["xref"]))
    for item in result:
        item.update(function_metadata(blob, text, rodata, item["start"], item["end"]))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    parser.add_argument("routes", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--contracts", type=Path, help="Also write the merged API contracts used by the audit")
    args = parser.parse_args()
    result = inventory(args.binary, args.routes)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.contracts:
        artifact = {"clientVersion": "15.1.0", "nativeSha256": hashlib.sha256(args.binary.read_bytes()).hexdigest(),
                    "routes": contracts(result)}
        args.contracts.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"Mapped {len({item['route'] for item in result})} routes to {len(result)} wrapper references")


if __name__ == "__main__":
    main()
