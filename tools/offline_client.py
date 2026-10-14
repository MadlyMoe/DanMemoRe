"""Build, serve, and install the isolated DanMemoRe Android client."""

from __future__ import annotations

import argparse
import functools
import hashlib
import http.server
import io
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import shutil
import struct
import subprocess
import tempfile
import threading
import time
from urllib.parse import unquote, urlsplit
import zipfile
import zlib


ROOT = Path(__file__).resolve().parents[1]
CONTENTS = ROOT / "contents"
SOURCE_APK = CONTENTS / "com.eu.danmemo_2023-12-22.apk"
WORK = ROOT / ".work"
DIST = ROOT / "dist"
OUTPUT_APK = DIST / "danmemore-offline.apk"
ARM64_XAPK = WORK / "danmemo-15.1.0-arm64.xapk"
ARM64_XAPK_SHA256 = "f783eeca9db7e690f82f4995fd831d6b8f1066f7954efabce0fb379d95affe82"
ARM64_SOURCE = WORK / "xapk"
ARM64_OUTPUT = DIST / "danmemore-arm64"
ARM64_APKS = (
    "com.eu.danmemo.apk",
    "config.arm64_v8a.apk",
    "config.en.apk",
    "config.fr.apk",
    "config.mdpi.apk",
    "AssetPack1.apk",
)
IDENTITY = DIST / "danmemore-offline.json"
USER_DATA_STATE = WORK / "user-data.json"
SQLITE_STATE = WORK / "danmemore.sqlite"
ORIGINAL_PACKAGE = "com.eu.danmemo"
PRIVATE_PACKAGE = "com.eu.danmore"  # Same width keeps binary resource offsets stable.
DEVICE_CONTENTS = f"/data/data/{PRIVATE_PACKAGE}/files/contents"
CONTENT_ROOTS = (
    "1", "2", "3", "4", "5", "6", "7", "8",
    "area_atlas_root", "single_image_root", "voice_root", "cache",
)
PORT = 28766
ENDPOINT = f"http://127.0.0.1:{PORT}"
LOCAL_USER_ID = 1000000001
LOCAL_AES_IV = "DanMemoReLocalIV"
LOCAL_AES_KEY = b"JsfcytENstRNhJBfkNQCCKb62jbZYccX"
LOCAL_TOKEN = "00000000000000000000000000000001"
HOME_CHARACTER_TOKEN = "132d52133a41bfb630af4effa24aeb54"
STARTER_PC_ID = 1011001001
API_ACTIONS = (
    "matching_user/game_user_id",
    "user/login",
    "user_data/confirm",
    "user_data/push",
    "user_data/pull",
)
URL_PATCHES = {
    b"https://api-danmemo-eu.wrightflyer.net": f"{ENDPOINT}/danmemore-local".encode(),
    b"https://cdn-danmemo.akamaized.net/eu": f"{ENDPOINT}/content".encode(),
    b"https://tdsdk-danmemo-eu.wrightflyer.net": f"{ENDPOINT}/telemetry".encode(),
    b"https://bn-payment-us.wrightflyer.net": f"{ENDPOINT}/billing".encode(),
    b"https://storage.googleapis.com/argo-ap4zsi86n4q": f"{ENDPOINT}/storage".encode(),
}


def run(command: list[Path | str], *, env: dict[str, str] | None = None) -> str:
    process = subprocess.run(
        [str(value) for value in command], capture_output=True, timeout=180, env=env
    )
    output = (process.stdout + process.stderr).decode(errors="replace")
    if process.returncode:
        raise RuntimeError(output[-4000:])
    return output


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def xml_chunks(data: bytes) -> list[tuple[int, bytearray]]:
    if len(data) < 8 or struct.unpack_from("<HH", data) != (3, 8):
        raise ValueError("Expected a binary Android XML document")
    size, = struct.unpack_from("<I", data, 4)
    if size != len(data):
        raise ValueError("Binary XML size mismatch")
    result = []
    at = 8
    while at < len(data):
        if at + 8 > len(data):
            raise ValueError("Truncated XML chunk")
        kind, header, size = struct.unpack_from("<HHI", data, at)
        if header < 8 or size < header or at + size > len(data):
            raise ValueError("Invalid XML chunk bounds")
        result.append((kind, bytearray(data[at : at + size])))
        at += size
    return result


def patch_manifest(data: bytes) -> bytes:
    old = ORIGINAL_PACKAGE.encode("utf-16le")
    new = PRIVATE_PACKAGE.encode("utf-16le")
    if len(old) != len(new) or data.count(old) != 10:
        raise ValueError("Unexpected package references in AndroidManifest.xml")
    data = data.replace(old, new)
    parts = xml_chunks(data)
    pool, = [part for kind, part in parts if kind == 1]
    count, styles, flags, start, style_start = struct.unpack_from("<IIIII", pool, 8)
    if styles or style_start or flags & 0x100 or start != 28 + count * 4:
        raise ValueError("Expected an unstyled UTF-16 manifest string pool")
    offsets = list(struct.unpack_from(f"<{count}I", pool, 28))
    strings = []
    for offset in offsets:
        at = start + offset
        length, = struct.unpack_from("<H", pool, at)
        end = at + 2 + length * 2
        if length & 0x8000 or end + 2 > len(pool) or pool[end : end + 2] != b"\0\0":
            raise ValueError("Unexpected manifest string encoding")
        strings.append(pool[at + 2 : end].decode("utf-16le"))
    if "usesCleartextTraffic" in strings:
        raise ValueError("Review the existing cleartext policy before patching")
    text = bytearray(pool[start:])
    for value in ("usesCleartextTraffic", "DanMemoRe"):
        offsets.append(len(text))
        text += struct.pack("<H", len(value)) + value.encode("utf-16le") + b"\0\0"
    text += b"\0" * (-len(text) % 4)
    new_start = 28 + 4 * len(offsets)
    pool[:] = (
        struct.pack(
            "<HHIIIIII", 1, 28, new_start + len(text), len(offsets), 0, flags & ~1, new_start, 0
        )
        + struct.pack(f"<{len(offsets)}I", *offsets)
        + text
    )
    resource_map, = [part for kind, part in parts if kind == 0x180]
    ids = list(struct.unpack_from(f"<{(len(resource_map) - 8) // 4}I", resource_map, 8))
    if len(ids) > count:
        raise ValueError("Invalid binary XML resource map")
    ids += [0] * (count + 2 - len(ids))
    ids[count] = 0x010104EC
    resource_map[:] = (
        struct.pack("<HHI", 0x180, 8, 8 + len(ids) * 4)
        + struct.pack(f"<{len(ids)}I", *ids)
    )
    applications = 0
    for kind, part in parts:
        if kind != 0x102:
            continue
        name, = struct.unpack_from("<I", part, 20)
        if strings[name] != "application":
            continue
        applications += 1
        attr_start, width, number, id_index, class_index, style_index = struct.unpack_from(
            "<HHHHHH", part, 24
        )
        if (
            attr_start != 20
            or width != 20
            or id_index
            or class_index
            or style_index
            or len(part) != 36 + number * 20
        ):
            raise ValueError("Unexpected application attribute layout")
        attrs = [bytes(part[36 + i * 20 : 56 + i * 20]) for i in range(number)]
        labels = [
            i
            for i, attr in enumerate(attrs)
            if ids[struct.unpack_from("<I", attr, 4)[0]] == 0x01010001
        ]
        if len(labels) != 1:
            raise ValueError("Expected one application label")
        label_index = labels[0]
        namespace, label = struct.unpack_from("<II", attrs[label_index])
        attrs[label_index] = struct.pack(
            "<IIIHBBI", namespace, label, count + 1, 8, 0, 3, count + 1
        )
        attrs.append(
            struct.pack("<IIIHBBI", namespace, count, 0xFFFFFFFF, 8, 0, 0x12, 0xFFFFFFFF)
        )
        attrs.sort(key=lambda attr: ids[struct.unpack_from("<I", attr, 4)[0]])
        part[:] = part[:36] + b"".join(attrs)
        struct.pack_into("<I", part, 4, len(part))
        struct.pack_into("<H", part, 28, number + 1)
    if applications != 1:
        raise ValueError("Expected one application element")
    payload = b"".join(part for _, part in parts)
    return struct.pack("<HHI", 3, 8, len(payload) + 8) + payload


def patch_c_string(data: bytes, old: bytes, new: bytes) -> bytes:
    if not new or len(new) > len(old) or data.count(old) != 1:
        raise ValueError(f"Unexpected fixed-width URL patch: {old!r}")
    return data.replace(old, new + b"\0" * (len(old) - len(new)))


def patch_dex(data: bytes) -> bytes:
    old, new = ORIGINAL_PACKAGE.encode(), PRIVATE_PACKAGE.encode()
    if data.count(old) != 1 or len(old) != len(new):
        raise ValueError("Unexpected package identity in classes.dex")
    data = bytearray(data.replace(old, new))
    data[12:32] = hashlib.sha1(data[32:]).digest()
    struct.pack_into("<I", data, 8, zlib.adler32(data[12:]) & 0xFFFFFFFF)
    return bytes(data)


def patch_service_dependencies(data: bytes) -> bytes:
    patches = (
        (
            bytes.fromhex("1a019c097230710017000a076a072425"),
            bytes.fromhex("1a019c097230710017040a076a072425"),
            "Google Play auto-sign-in",
        ),
        (
            bytes.fromhex("0801100054129e07380273016e10b40b0200"),
            bytes.fromhex("0801100054129e07290073016e10b40b0200"),
            "GREE response signature",
        ),
    )
    for old, new, name in patches:
        if data.count(old) != 1:
            raise ValueError(f"Unexpected {name} bytecode")
        data = data.replace(old, new)
    data = bytearray(data)
    # The retired Google Play listing/purchase hop sits between the game and the
    # still-usable GREE shop API. Keep the server-backed product/order calls and
    # make the dead store hop a local success.
    fixed = (
        (0x0DF324, bytes.fromhex("5430b10d2201c4087030512a31041f007a08"),
         bytes.fromhex("2200740370109c0d00007220ba2304000e00")),
        (0x0D96C2, bytes.fromhex("39000a00"), bytes.fromhex("00000000")),
        (0x0DE980, bytes.fromhex("38011000"), bytes.fromhex("00000000")),
        (0x0DFEEC, bytes.fromhex("71007d2400000a0038003400"),
         bytes.fromhex("12007220ba2306000e00") + bytes(136)),
    )
    for offset, old, new in fixed:
        if data[offset : offset + len(old)] != old:
            raise ValueError(f"Unexpected offline billing bytecode at {offset:#x}")
        data[offset : offset + len(new)] = new
    data[12:32] = hashlib.sha1(data[32:]).digest()
    struct.pack_into("<I", data, 8, zlib.adler32(data[12:]) & 0xFFFFFFFF)
    return bytes(data)


def patch_native_client(data: bytes, abi: str) -> bytes:
    if abi != "arm64-v8a":
        return data
    # The retired backend created party IDs starting at 1, but this frozen build
    # initializes activePartyId to 0 and dereferences the missing party on startup.
    # ponytail: force the first party on ARM64; preserve arbitrary selections once
    # server-side profile persistence replaces the client-only bootstrap.
    # The native non-retrying 3xxxxxx parameter-error dialog normally displays
    # only a number. Use the transport's root message instead, without changing
    # its cancellation/dismissal logic. Our local unavailable code is 3000999;
    # network, login, save-integrity and payment checks are not patched here.
    error_offset = 0x2036AC4
    error_old = bytes.fromhex("810a40b9208c00b000ec2591e8830c910cabcd9721af00b021141991e0830c91e2030032958bce97")
    error_new = struct.pack("<4I", 0x910C83E0, 0x91004281,
        0x94000000 | (((0x13A1878 - (error_offset + 8)) // 4) & 0x03FFFFFF), 0x910C83E0)
    error_new += bytes.fromhex("1f2003d5") * 6
    # Common hot transport accepts one operation. Reuse original cold loader
    # for an optional signed prefix, then tail-call the unchanged singular parser.
    # This executable alignment gap has no original FDE or relocation. No
    # signature, save/ACK, purchase-auth or reward-handler checks are changed.
    prefix_offset = 0x153F030
    prefix_new = struct.pack("<6I", 0xA9BE7BFD, 0xA90107E0,
        0x94000000 | (((0x20BBCA4 - (prefix_offset + 8)) // 4) & 0x03FFFFFF),
        0xA94107E0, 0xA8C27BFD,
        0x14000000 | (((0x2069E14 - (prefix_offset + 20)) // 4) & 0x03FFFFFF))
    # Same original executable padding as the prefix loader; separate span,
    # no FDE/relocation or original address/control/literal reference. Only
    #2371f34's battle-party copy is redirected: JSON/MsgPack import setters
    #remain unchanged. Preserve the real encrypted setter and its input X0,
    #then mark that freshly copied slot dirty even when its number is unchanged.
    gve_copy_offset = 0x153F050
    gve_copy_new = struct.pack("<8I", 0xA9BE7BFD, 0xF9000BE0,
        0x94000000 | (((0x286ED04 - (gve_copy_offset + 8)) // 4) & 0x03FFFFFF),
        0xF9400BE0, 0x52800028, 0x39014008, 0xA8C27BFD, 0xD65F03C0)
    # SOURCE ONLY/UNTESTED: operation23100 keeps its root JSON pointer at
    # caller SP+48. An exact derived applied1 marks only result-object padding;
    # a scoped14514a4 gate then skips an already-saved best-party copy while
    # preserving the daily-high flag, record import, stage clear, callback and ACK.
    # shortcut: this marker handles only party-first; clear-first has separate scoped counter/date adapters and other ABIs remain guarded.
    gve_party_replay_offset = 0x153FF80
    gve_party_replay_new = struct.pack("<26I",
        0xA9B97BFD, 0xA90107E0, 0xA9020FE2, 0xA90317E4, 0xA90423E7, 0xAD0287E0,
        0xF9405FE0, 0xF9400000, 0x10000241,
        0x94000000 | (((0x13B1F5C - (gve_party_replay_offset + 36)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (gve_party_replay_offset + 44)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x5280002A, 0x1A9F014A, 0xF94013E9, 0x3901A92A,
        0xADC287E0, 0xA94423E7, 0xA94317E4, 0xA9420FE2, 0xA94107E0, 0xA8C77BFD,
        0x2A1703E6, 0xD65F03C0, 0xD503201F)
    gve_party_replay_new += b"offlineGvePartyApplied\x00".ljust(32, b"\x00")
    gve_party_gate_offset = 0x1540008
    gve_party_gate_new = struct.pack("<4I",
        0x34000000 | ((((0x1451590-gve_party_gate_offset)//4)&0x7FFFF)<<5) | 9,
        0x3941A909,
        0x35000000 | ((((0x1451590-(gve_party_gate_offset+8))//4)&0x7FFFF)<<5) | 9,
        0x14000000 | (((0x1451530-(gve_party_gate_offset+12))//4)&0x03FFFFFF))
    #18000 keeps its mandatory pickedItem/master UI identity during cold
    #recovery.22100 reuses this guard for an already-saved Valis charge.
    #Skip only zero slot50 quantity/signature effects; all nonzero quantities
    #tail-call original X8 with its row, quantity, signature and return link.
    scratch_gain_offset = 0x153F070
    scratch_gain_new = struct.pack("<3I", 0x34000041, 0xD61F0100, 0xD65F03C0)
    # SOURCE ONLY/UNTESTED: operation15000 uses consumedItem.amount for both
    # its additive ticket debit and UserEventBox.totalDrawCount increment. The
    # server-derived nonzero control encodes the independently remaining
    # counter quantity plus one; absence preserves the original W1. The shim
    # reads only the retained handler root at outer SP+8, restores X0/W1/LR,
    # and tail-calls the original2414578 counter helper. Zero cost quantities
    # reuse the scoped X8 guard above; chosen rows use the per-row wrapper
    # below. The implicit bonus uses a
    # separate root control so a saved acquisition is not restored after later
    # spending; untouched bonuses still tail-call their original X9 routine.
    # Each projected chosen row also carries an independent lifetime remainder:
    # -1 skips a fully saved row, while N+1 requests N lifetime acquisitions.
    # The scoped common-gain marker keeps stock in W19, lifetime in W23 and a
    # private frame flag; its later gate omits only the already-fired item
    # ChangeAmount event. Missing controls preserve every original caller.
    # shortcut: ARM64 operation15000 recovery only; other ABIs remain guarded.
    event_box_counter_offset = 0x16234D0
    event_box_counter_new = struct.pack("<14I", 0xA9BE7BFD, 0xA90107E0, 0xF94017E0, 0xF9400000,
        0x10000141,
        0x94000000 | (((0x13B1F5C - (event_box_counter_offset + 20)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (event_box_counter_offset + 28)) // 4) & 0x03FFFFFF),
        0x2A0003E9, 0xA94107E0, 0x34000049, 0x51000521, 0xA8C27BFD,
        0x14000000 | (((0x2414578 - (event_box_counter_offset + 52)) // 4) & 0x03FFFFFF))
    event_box_counter_new += b"offlineEventBoxCounterControl\x00".ljust(32, b"\x00")
    event_box_bonus_gain_offset = 0x1623560
    event_box_bonus_gain_new = struct.pack("<17I", 0xA9BD7BFD, 0xA90107E0, 0xA90227E2,
        0xF9401FE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (event_box_bonus_gain_offset + 24)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (event_box_bonus_gain_offset + 32)) // 4) & 0x03FFFFFF),
        0x2A0003EA, 0xA94227E2, 0xA94107E0, 0x3500006A, 0xA8C37BFD, 0xD61F0120,
        0xA8C37BFD, 0xD65F03C0)
    event_box_bonus_gain_new += b"offlineEventBoxBonusApplied\x00".ljust(32, b"\x00")
    event_box_item_gain_offset = 0x16235D0
    event_box_item_gain_new = struct.pack("<25I",
        0xA9BC7BFD, 0xA90107E0, 0xA90223E2, 0x910203E0, 0x100002A1,
        0x94000000 | (((0x13B1F5C - (event_box_item_gain_offset + 20)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (event_box_item_gain_offset + 28)) // 4) & 0x03FFFFFF),
        0x2A0003E9, 0xA94223E2, 0xA94107E0, 0x34000129, 0x3100053F,
        0x54000140, 0x51000524, 0x528A0003, 0x72A00023, 0x52800025,
        0xA8C47BFD, 0xD61F0100, 0x2A1F03E3, 0xA8C47BFD, 0xD61F0100,
        0xA8C47BFD, 0xD65F03C0)
    event_box_item_gain_new += b"offlineEventBoxLifetimeControl\x00".ljust(32, b"\x00")
    event_box_common_gain_offset = 0x1623660
    event_box_common_gain_new = struct.pack("<11I",
        0x2A0103F3, 0x2A0103F7, 0xB9009FFF, 0x528A0009, 0x72A00029, 0x6B09007F,
        0x54000040,
        0x14000000 | (((0x24D8874 - (event_box_common_gain_offset + 28)) // 4) & 0x03FFFFFF),
        0x2A0403F7, 0xB9009FE5,
        0x14000000 | (((0x24D8874 - (event_box_common_gain_offset + 40)) // 4) & 0x03FFFFFF))
    event_box_item_event_gate_offset = 0x1623690
    event_box_item_event_gate_new = struct.pack("<5I", 0xB9409FE8, 0x34000048,
        0x14000000 | (((0x24D89EC - (event_box_item_event_gate_offset + 8)) // 4) & 0x03FFFFFF),
        0x321C07E0,
        0x14000000 | (((0x24D891C - (event_box_item_event_gate_offset + 16)) // 4) & 0x03FFFFFF))
    #2000/6000 call the same casino helper even for zero, rewriting its
    #singleton signature. Skip only zero int64 medals; nonzero is original.
    casino_gain_offset = 0x153F07C
    casino_gain_new = struct.pack("<3I", 0xB4000041,
        0x14000000 | (((0x23FF788 - (casino_gain_offset + 4)) // 4) & 0x03FFFFFF), 0xD65F03C0)
    #SOURCE ONLY/UNTESTED: common stage X21 retains the original JSON pointer.
    #An exact server-derived applied1 overrides ONLY the XP call's W1 count,
    #keeping the original cache initializer and zero-change EXP/level setter.
    #All other common counts, grants, clear/unlock/event calls and ACKs remain.
    #shortcut: ARM64-only non-skip XP recovery; other ABIs and skip debit need their own native contract.
    stage_xp_offset = 0x153F090
    stage_xp_new = struct.pack("<12I", 0xA9BE7BFD, 0xA90107E0, 0xF94002A0, 0x10000121,
        0x94000000 | (((0x13B1F5C - (stage_xp_offset + 16)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_xp_offset + 24)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xA94107E0, 0x1A8103E1, 0xA8C27BFD,
        0x14000000 | (((0x246C428 - (stage_xp_offset + 44)) // 4) & 0x03FFFFFF))
    stage_xp_new += b"offlineStageXpApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: operation21000 retains its root JSON in X21.
    #Control1 substitutes zero for saved XP; a receipt-bound value above1
    #substitutes exact boosted XP after a proved party-first save.
    #The same guarded parser records observed party-deletion and complete stage-
    #broadcast markers in unused callback stack padding. Their caller-only gates
    #skip only23147dc or the completed23021b0+23034dc pair respectively.
    #The server projects each remaining boosted Valis row to its final amount;
    #the empty-party multiplier1 needs no separate client hook.
    #Items, friendship, expiry cleanup, signature and ACK remain original.
    #shortcut: ARM64 operation21000 controls only; other ABIs and partial stage broadcasts need their own native contract.
    expedition_xp_offset = 0x16231B0
    expedition_xp_new = struct.pack("<29I", 0xD10083FF, 0xA9017BFD, 0x910003FD, 0xF94002A0, 0x10000321,
        0x94000000 | (((0x13B1F5C - (expedition_xp_offset + 20)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (expedition_xp_offset + 28)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x1A9703F7, 0x1A97C017, 0xB90003F7, 0xF94002A0, 0x10000301,
        0x94000000 | (((0x13B1F5C - (expedition_xp_offset + 56)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (expedition_xp_offset + 64)) // 4) & 0x03FFFFFF),
        0xB90033E0, 0xF94002A0, 0x10000341,
        0x94000000 | (((0x13B1F5C - (expedition_xp_offset + 80)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (expedition_xp_offset + 88)) // 4) & 0x03FFFFFF),
        0xB90023E0, 0xB94003E0, 0xA9417BFD, 0x910083FF, 0x7100041F,
        0x14000000 | (((0x2308EE4 - (expedition_xp_offset + 112)) // 4) & 0x03FFFFFF))
    expedition_xp_new += b"offlineExpeditionXpApplied\x00".ljust(32, b"\x00")
    expedition_xp_new += b"offlineExpeditionPartyApplied\x00".ljust(32, b"\x00")
    expedition_xp_new += b"offlineExpeditionStageApplied\x00".ljust(32, b"\x00")
    expedition_party_gate_offset = expedition_xp_offset + 212
    expedition_xp_new += struct.pack("<6I", 0xB94013E8, 0x7100051F, 0x54000041, 0xD65F03C0,
        0x14000000 | (((0x23147DC - (expedition_party_gate_offset + 16)) // 4) & 0x03FFFFFF), 0xD503201F)
    expedition_stage_gate_offset = expedition_xp_offset + 236
    expedition_xp_new += struct.pack("<5I", 0xB94003E8, 0x7100051F, 0x54000041,
        0x14000000 | (((0x2309294 - (expedition_stage_gate_offset + 12)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x23021B0 - (expedition_stage_gate_offset + 16)) // 4) & 0x03FFFFFF))
    #SOURCE ONLY/UNTESTED: preserve the original changed-level branch. For an
    #equal level, only the original common callback's saved LR246ce78 permits
    #reading its still-live friendship JSON at callerSP+70 (CP frame+a0).
    #Exact derived pending1 re-enters the original fanout after the absolute
    #CP setter; absent/default0 and every other caller keep the equal epilogue.
    #No CP rollback/precredit/signature/auth/save/ACK bypass is introduced.
    #shortcut: ARM64-only stage CP-level recovery; other ABIs and coupled acquisition need their own native contract.
    stage_cp_offset = 0x153F0E0
    dispatch_cp_offset = 0x16232B0
    friendship_cp_offset = 0x1623310
    friendship_item_offset = 0x1623370
    caller_page = ((0x246C000 - ((stage_cp_offset + 12) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    stage_cp_new = struct.pack("<20I", 0x54000040,
        0x14000000 | (((0x23E6CBC - (stage_cp_offset + 4)) // 4) & 0x03FFFFFF),
        0xF9404FE9,
        0x9000000A | ((caller_page & 3) << 29) | ((caller_page >> 2) << 5),
        0x9139E14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((dispatch_cp_offset - (stage_cp_offset + 28)) // 4) & 0x03FFFFFF),
        0xA9BE7BFD, 0x9104C3E0, 0x10000141,
        0x94000000 | (((0x13B1F5C - (stage_cp_offset + 44)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_cp_offset + 52)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xA8C27BFD, 0x54000040,
        0x14000000 | (((0x23E7240 - (stage_cp_offset + 68)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x23E6CBC - (stage_cp_offset + 72)) // 4) & 0x03FFFFFF), 0xD503201F)
    stage_cp_new += b"offlineStageCpLevelPending\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: operation21000 keeps the current friendship row at
    #callerSP+18 and returns from23e6b08 at2309220. The shared equal-level gate
    #reaches this second adapter only after rejecting the common-stage caller.
    #Exact marker1 re-enters23e6cbc's original unlock/voice/refill fanout; every
    #other caller and absent/default0 retain the original equal-level epilogue.
    dispatch_caller_page = ((0x2309000 - (dispatch_cp_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    dispatch_cp_new = struct.pack("<16I",
        0x9000000A | ((dispatch_caller_page & 3) << 29) | ((dispatch_caller_page >> 2) << 5),
        0x9108814A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((friendship_cp_offset - (dispatch_cp_offset + 16)) // 4) & 0x03FFFFFF),
        0xA9BE7BFD, 0x910363E0, 0x10000121,
        0x94000000 | (((0x13B1F5C - (dispatch_cp_offset + 32)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (dispatch_cp_offset + 40)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xA8C27BFD, 0x54000040,
        0x14000000 | (((0x23E7240 - (dispatch_cp_offset + 56)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x23E6CBC - (dispatch_cp_offset + 60)) // 4) & 0x03FFFFFF))
    dispatch_cp_new += b"offlineExpeditionCpLevelPending\x00"
    #SOURCE ONLY/UNTESTED: operation11000 returns from the same setter at
    #23eb7d0 with its current row still at callerSP+10. Keep its marker and
    #caller identity independent from operation21000; exact1 re-enters only
    #the same original fanout and absent/non1 retains the equal epilogue.
    friendship_caller_page = ((0x23EB000 - (friendship_cp_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    friendship_cp_new = struct.pack("<16I",
        0x9000000A | ((friendship_caller_page & 3) << 29) | ((friendship_caller_page >> 2) << 5),
        0x911F414A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((0x23E7240 - (friendship_cp_offset + 16)) // 4) & 0x03FFFFFF),
        0xA9BE7BFD, 0x910343E0, 0x10000121,
        0x94000000 | (((0x13B1F5C - (friendship_cp_offset + 32)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (friendship_cp_offset + 40)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xA8C27BFD, 0x54000040,
        0x14000000 | (((0x23E7240 - (friendship_cp_offset + 56)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x23E6CBC - (friendship_cp_offset + 60)) // 4) & 0x03FFFFFF))
    friendship_cp_new += b"offlineFriendshipCpLevelPending\x00"
    #SOURCE ONLY/UNTESTED: operation11000 applies its optional CP-item debit
    #before Iris/items/friendship. Replace only the itemId-present branch with
    #a marker-aware shim. The original absent-item condition still jumps to
    #23eb56c; exact server-derived applied1 does the same, while every other
    #value returns to23eb2cc and performs the original full debit path.
    friendship_item_new = struct.pack("<12I",
        0x54000041,
        0x14000000 | (((0x23EB56C - (friendship_item_offset + 4)) // 4) & 0x03FFFFFF),
        0xF9400260, 0x10000121,
        0x94000000 | (((0x13B1F5C - (friendship_item_offset + 16)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (friendship_item_offset + 24)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x54000041,
        0x14000000 | (((0x23EB56C - (friendship_item_offset + 36)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x23EB2CC - (friendship_item_offset + 40)) // 4) & 0x03FFFFFF),
        0xD503201F)
    friendship_item_new += b"offlineFriendshipItemApplied\x00".ljust(48, b"\x00")
    #SOURCE ONLY/UNTESTED: X21 is reused at246d2c8/246d314 before clear.
    #Retain the original root JSON pointer in common-frame padding SP+168;
    #canary SP+160 and saved registers SP+170 onward remain untouched.
    #Only the top-level common caller LR246d4a0 reads that slot. Recursive
    #or other clear calls tail-call original24528e0 without any JSON access.
    #Exact derived counts1 skips that helper, preserving original count for
    #later dates/events/features/story and the actual full save/ACK.
    #shortcut: ARM64-only proven non-skip counter/full-date prefixes; daily-first, cross-day repeats and other ABIs remain unavailable.
    stage_counts_offset = 0x153F150
    pvb_counts_offset = 0x153F530
    gve_counts_offset = 0x1623030
    counts_caller_page = ((0x246D000 - ((stage_counts_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    pvb_caller_page = ((0x246F000 - ((pvb_counts_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    stage_counts_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((counts_caller_page & 3) << 29) | ((counts_caller_page >> 2) << 5),
        0x9112814A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((pvb_counts_offset - (stage_counts_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF9418FE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (stage_counts_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_counts_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x54000080, 0xAA1303E0, 0x2A1403E1,
        0x94000000 | (((0x24528E0 - (stage_counts_offset + 80)) // 4) & 0x03FFFFFF),
        0xA9427BFD, 0xA8C353F3, 0xD65F03C0)
    stage_counts_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    #Operation19000 uses its own fixed1f0 callback frame. Its live response
    #wrapper remains at callerSP+90, so clearSP+210/newSP+240 is safe only for
    #the exact saved return246f03c. Reuse the common call/restore tail so the
    #cumulative hook sees one proven helper return address for both callbacks.
    pvb_counts_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((pvb_caller_page & 3) << 29) | ((pvb_caller_page >> 2) << 5),
        0x9100F14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((gve_counts_offset - (pvb_counts_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF94123E0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (pvb_counts_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (pvb_counts_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F,
        0x54000000 | ((((stage_counts_offset + 84 - (pvb_counts_offset + 68)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_counts_offset + 72 - (pvb_counts_offset + 72)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    pvb_counts_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    #Operation23100 calls the same clear function at246fc74 and retains its
    #parameters wrapper at callerSP+48. Admit only that exact return address;
    #exact1 skips both counters and exact2 continues through the cumulative hook.
    gve_counts_caller_page = ((0x246F000 - ((gve_counts_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    gve_counts_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((gve_counts_caller_page & 3) << 29) | ((gve_counts_caller_page >> 2) << 5),
        0x9131E14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((0x24528E0 - (gve_counts_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF940FFE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (gve_counts_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (gve_counts_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F,
        0x54000000 | ((((stage_counts_offset + 84 - (gve_counts_offset + 68)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_counts_offset + 72 - (gve_counts_offset + 72)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    gve_counts_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    stage_json_offset = 0x153F1D0
    stage_json_new = struct.pack("<4I", 0xAA0003F5, 0xF900B7E0,
        0x14000000 | (((0x246C590 - (stage_json_offset + 8)) // 4) & 0x03FFFFFF), 0xD503201F)
    #SOURCE ONLY/UNTESTED: exact counts2 skips only the cumulative setter.
    #The original helper must have returned into the retained common shim;
    #recursive/foreign calls keep their original setter and never read JSON.
    #SP398 = thunk30 + helper50 + retained shim30 + clear180 + common168.
    stage_cumulative_offset = 0x153F1E0
    pvb_cumulative_offset = 0x153F630
    gve_cumulative_offset = 0x1623130
    cumulative_caller_page = ((0x153F000 - ((stage_cumulative_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    cumulative_common_page = ((0x246D000 - ((pvb_cumulative_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    cumulative_pvb_page = ((0x246F000 - ((pvb_cumulative_offset + 20) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    stage_cumulative_new = struct.pack("<24I", 0xF94027E9,
        0x9000000A | ((cumulative_caller_page & 3) << 29) | ((cumulative_caller_page >> 2) << 5),
        0x9106914A, 0xEB0A013F,
        0x54000000 | ((((pvb_cumulative_offset - (stage_cumulative_offset + 16)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((0x2666B1C - (stage_cumulative_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF941CFE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (stage_cumulative_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_cumulative_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100081F, 0x54000080, 0xAA1303E0, 0x2A1403E1,
        0x94000000 | (((0x2666B1C - (stage_cumulative_offset + 80)) // 4) & 0x03FFFFFF),
        0xA9427BFD, 0xA8C353F3, 0xD65F03C0)
    stage_cumulative_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    #The shared count shim gives all supported callbacks the same helper LR.
    #Inspect the outer clear frame before selecting common newSP+398, PvB
    #newSP+2c0, or the chained GVE adapter below.
    pvb_cumulative_new = struct.pack("<28I", 0xF940FFE9,
        0x9000000A | ((cumulative_common_page & 3) << 29) | ((cumulative_common_page >> 2) << 5),
        0x9112814A, 0xEB0A013F,
        0x54000000 | ((((stage_cumulative_offset + 24 - (pvb_cumulative_offset + 16)) // 4) & 0x7FFFF) << 5),
        0x9000000A | ((cumulative_pvb_page & 3) << 29) | ((cumulative_pvb_page >> 2) << 5),
        0x9100F14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((gve_cumulative_offset - (pvb_cumulative_offset + 36)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF94163E0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (pvb_cumulative_offset + 68)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (pvb_cumulative_offset + 76)) // 4) & 0x03FFFFFF),
        0x7100081F,
        0x54000000 | ((((stage_cumulative_offset + 84 - (pvb_cumulative_offset + 84)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_cumulative_offset + 72 - (pvb_cumulative_offset + 88)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    pvb_cumulative_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    #Operation23100 shares the count-helper return but its clear caller and root
    #differ. Exact caller246fc78 selects wrapper SP+278; exact2 skips only the
    #already-saved cumulative setter and rejoins the original daily/date path.
    gve_cumulative_caller_page = ((0x246F000 - ((gve_cumulative_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    gve_cumulative_new = struct.pack("<24I", 0xF940FFE9,
        0x9000000A | ((gve_cumulative_caller_page & 3) << 29) | ((gve_cumulative_caller_page >> 2) << 5),
        0x9131E14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((0x2666B1C - (gve_cumulative_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0xF9413FE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (gve_cumulative_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (gve_cumulative_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100081F,
        0x54000000 | ((((stage_cumulative_offset + 84 - (gve_cumulative_offset + 68)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_cumulative_offset + 72 - (gve_cumulative_offset + 72)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    gve_cumulative_new += b"offlineStageClearCountsApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: retain a saved LAST date; FIRST reads it at24519b4.
    #Only the proven common, operation19000 or operation23100 clear callers may
    #read their respective roots. Other callers keep the original setter; its
    #int64 date argument is never narrowed.
    #shortcut: proven non-skip saved LAST/full-first recovery; cross-day/partial FIRST/history and other ABIs need their own contract.
    #SOURCE ONLY/UNTESTED: separate saved item debit from saved additive count/time without changing the original queued price.
    #Only caller2572320 may read its live consumedItem wrapper at originalSP78; foreign callers keep original helper/no JSON access.
    familia_item_callback_offset = 0x153F2E0
    familia_caller_page = ((0x2572000 - (familia_item_callback_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    familia_item_callback_new = struct.pack("<36I",
        0x90000009 | ((familia_caller_page & 3) << 29) | ((familia_caller_page >> 2) << 5),
        0x910C8129, 0xEB0903DF, 0x54000040,
        0x14000000 | (((0x2570F30 - (familia_item_callback_offset + 16)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0xAA0203F4, 0xB90013E1, 0x9102A3E0,
        0x34000061, 0x10000301, 0x14000002, 0x100003C1,
        0x94000000 | (((0x13B1F5C - (familia_item_callback_offset + 60)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (familia_item_callback_offset + 68)) // 4) & 0x03FFFFFF),
        0xB94013E9, 0x340000A9, 0x7100041F, 0x540000C1, 0x2A1F03E9, 0x14000004,
        0x7100001F, 0x5400004D, 0x2A0003E9, 0xAA1303E0, 0xAA1403E2,
        0xA9427BFD, 0xA8C353F3, 0x34000069, 0x2A0903E1,
        0x14000000 | (((0x2570F30 - (familia_item_callback_offset + 132)) // 4) & 0x03FFFFFF),
        0xD65F03C0, 0xD503201F)
    familia_item_callback_new += b"offlineDonationCounterApplied\x00".ljust(32, b"\x00")
    familia_item_callback_new += b"offlineDonationCounterQuantity\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: a saved additive count still needs the original date setter.
    #Check both the helper call and its retained outer caller before reading outer consumedItem at newSP108.
    familia_count_offset = 0x153F3B0
    count_caller_page = ((0x2570F000 - (familia_count_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    count_outer_page = ((0x2572000 - ((familia_count_offset + 20) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    familia_count_new = struct.pack("<28I",
        0x90000009 | ((count_caller_page & 3) << 29) | ((count_caller_page >> 2) << 5),
        0x913E0129, 0xEB0903DF, 0x540002A1, 0xF9402FEA,
        0x90000009 | ((count_outer_page & 3) << 29) | ((count_outer_page >> 2) << 5),
        0x910C8129, 0xEB09015F, 0x54000201,
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0x2A0103F4,
        0x910423E0, 0x100001C1,
        0x94000000 | (((0x13B1F5C - (familia_count_offset + 60)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (familia_count_offset + 68)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xAA1303E0, 0x2A1403E1, 0xA9427BFD, 0xA8C353F3,
        0x54000040,
        0x14000000 | (((0x2871E48 - (familia_count_offset + 96)) // 4) & 0x03FFFFFF),
        0xD65F03C0, 0xD503201F, 0xD503201F)
    familia_count_new += b"offlineDonationCountApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: a saved same-day timestamp still needs the original count setter.
    #Preserve the int64 date argument; only this helper's two proven return addresses may read outer JSON.
    familia_date_offset = 0x153F440
    date_caller_page = ((0x2570F000 - (familia_date_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    date_outer_page = ((0x2572000 - ((familia_date_offset + 20) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    familia_date_new = struct.pack("<28I",
        0x90000009 | ((date_caller_page & 3) << 29) | ((date_caller_page >> 2) << 5),
        0x913E3129, 0xEB0903DF, 0x540002A1, 0xF9402FEA,
        0x90000009 | ((date_outer_page & 3) << 29) | ((date_outer_page >> 2) << 5),
        0x910C8129, 0xEB09015F, 0x54000201,
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0xAA0103F4,
        0x910423E0, 0x100001C1,
        0x94000000 | (((0x13B1F5C - (familia_date_offset + 60)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (familia_date_offset + 68)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xAA1303E0, 0xAA1403E1, 0xA9427BFD, 0xA8C353F3,
        0x54000040,
        0x14000000 | (((0x2871F50 - (familia_date_offset + 96)) // 4) & 0x03FFFFFF),
        0xD65F03C0, 0xD503201F, 0xD503201F)
    familia_date_new += b"offlineDonationDateApplied\x00".ljust(32, b"\x00")
    stage_last_date_offset = 0x153F260
    pvb_last_date_offset = 0x153F5B0
    gve_last_date_offset = 0x16230B0
    last_date_caller_page = ((0x246D000 - ((stage_last_date_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    pvb_date_caller_page = ((0x246F000 - ((pvb_last_date_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    stage_last_date_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((last_date_caller_page & 3) << 29) | ((last_date_caller_page >> 2) << 5),
        0x9112814A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((pvb_last_date_offset - (stage_last_date_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0xAA0103F4,
        0xF9418FE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (stage_last_date_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_last_date_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x54000080, 0xAA1303E0, 0xAA1403E1,
        0x94000000 | (((0x26667CC - (stage_last_date_offset + 80)) // 4) & 0x03FFFFFF),
        0xA9427BFD, 0xA8C353F3, 0xD65F03C0)
    stage_last_date_new += b"offlineStageLastDateApplied\x00".ljust(32, b"\x00")
    pvb_last_date_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((pvb_date_caller_page & 3) << 29) | ((pvb_date_caller_page >> 2) << 5),
        0x9100F14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((gve_last_date_offset - (pvb_last_date_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0xAA0103F4,
        0xF94123E0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (pvb_last_date_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (pvb_last_date_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F,
        0x54000000 | ((((stage_last_date_offset + 84 - (pvb_last_date_offset + 68)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_last_date_offset + 72 - (pvb_last_date_offset + 72)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    pvb_last_date_new += b"offlineStageLastDateApplied\x00".ljust(32, b"\x00")
    gve_date_caller_page = ((0x246F000 - ((gve_last_date_offset + 4) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    gve_last_date_new = struct.pack("<24I", 0xF940BFE9,
        0x9000000A | ((gve_date_caller_page & 3) << 29) | ((gve_date_caller_page >> 2) << 5),
        0x9131E14A, 0xEB0A013F, 0x54000040,
        0x14000000 | (((0x26667CC - (gve_last_date_offset + 20)) // 4) & 0x03FFFFFF),
        0xA9BD53F3, 0xA9027BFD, 0xAA0003F3, 0xAA0103F4,
        0xF940FFE0, 0xF9400000, 0x10000181,
        0x94000000 | (((0x13B1F5C - (gve_last_date_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (gve_last_date_offset + 60)) // 4) & 0x03FFFFFF),
        0x7100041F,
        0x54000000 | ((((stage_last_date_offset + 84 - (gve_last_date_offset + 68)) // 4) & 0x7FFFF) << 5),
        0x14000000 | (((stage_last_date_offset + 72 - (gve_last_date_offset + 72)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    gve_last_date_new += b"offlineStageLastDateApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: operation19000 emits PvbScoreEvent before its clear.
    #The exact callback keeps the response wrapper at callerSP+90. Suppress
    #only an already-saved event; construction, cleanup, clear, record and ACK
    #continue through the original callback.
    #shortcut: ARM64-only exact PvbScoreEvent replay guard; other event listeners and ABIs remain unavailable.
    pvb_score_event_offset = 0x153F6C0
    pvb_score_event_new = struct.pack("<14I",
        0xA9BE7BFD, 0xF9000BE0, 0xF9405BE0, 0xF9400000, 0x10000141,
        0x94000000 | (((0x13B1F5C - (pvb_score_event_offset + 20)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (pvb_score_event_offset + 28)) // 4) & 0x03FFFFFF),
        0x7100041F, 0xF9400BE0, 0xA8C27BFD, 0x54000040,
        0x14000000 | (((0x246F4C8 - (pvb_score_event_offset + 48)) // 4) & 0x03FFFFFF),
        0xD65F03C0)
    pvb_score_event_new += b"offlinePvbScoreEventApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: the server emits exact full, ticket-side or SP-side
    #markers only after the corresponding original effects are durably observed.
    #The wrapper retains W22 as two private guard bits while the original helper
    #runs. The helper's combined ticket call and separate SP tail call are the
    #only selective exits; XP, clear, grants and ACK remain original.
    #shortcut: ARM64-only exact skip recovery; one-ticket partials and other ABIs remain unavailable.
    stage_skip_guard_offset = 0x153F4D0
    stage_skip_ticket_guard = stage_skip_guard_offset
    stage_skip_sp_guard = stage_skip_guard_offset + 12
    stage_skip_guards_new = struct.pack("<6I",
        0x36000056, 0xD65F03C0,
        0x14000000 | (((0x234AFC8 - (stage_skip_guard_offset + 8)) // 4) & 0x03FFFFFF),
        0x36080056, 0xD65F03C0,
        0x14000000 | (((0x2541098 - (stage_skip_guard_offset + 20)) // 4) & 0x03FFFFFF))
    stage_skip_offset = 0x16233D0
    stage_skip_full_string = stage_skip_offset + 144
    stage_skip_ticket_string = stage_skip_offset + 176
    stage_skip_sp_string = stage_skip_offset + 208
    stage_skip_new = struct.pack("<36I",
        0xA9BC7BFD, 0xA90107E0, 0xA9020FE2, 0xF9001BF6, 0x2A1F03F6,
        0xF94002A0,
        0x10000001 | (((stage_skip_full_string - (stage_skip_offset + 24)) & 3) << 29) |
            ((((stage_skip_full_string - (stage_skip_offset + 24)) >> 2) & 0x7FFFF) << 5),
        0x94000000 | (((0x13B1F5C - (stage_skip_offset + 28)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_skip_offset + 36)) // 4) & 0x03FFFFFF),
        0x7100041F,
        0x54000000 | ((((stage_skip_offset + 124 - (stage_skip_offset + 44)) // 4) & 0x7FFFF) << 5),
        0xF94002A0,
        0x10000001 | (((stage_skip_ticket_string - (stage_skip_offset + 52)) & 3) << 29) |
            ((((stage_skip_ticket_string - (stage_skip_offset + 52)) >> 2) & 0x7FFFF) << 5),
        0x94000000 | (((0x13B1F5C - (stage_skip_offset + 56)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_skip_offset + 64)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x1A9F17F6,
        0xF94002A0,
        0x10000001 | (((stage_skip_sp_string - (stage_skip_offset + 80)) & 3) << 29) |
            ((((stage_skip_sp_string - (stage_skip_offset + 80)) >> 2) & 0x7FFFF) << 5),
        0x94000000 | (((0x13B1F5C - (stage_skip_offset + 84)) // 4) & 0x03FFFFFF),
        0xAA1F03E1,
        0x94000000 | (((0x13B28D0 - (stage_skip_offset + 92)) // 4) & 0x03FFFFFF),
        0x7100041F, 0x1A9F17E0, 0x2A0006D6,
        0xA9420FE2, 0xA94107E0,
        0x94000000 | (((0x246C4A0 - (stage_skip_offset + 116)) // 4) & 0x03FFFFFF),
        0x14000003,
        0xA9420FE2, 0xA94107E0, 0xF9401BF6, 0xA8C47BFD, 0xD65F03C0)
    stage_skip_new += b"offlineStageSkipApplied\x00".ljust(32, b"\x00")
    stage_skip_new += b"offlineStageSkipTicketsApplied\x00".ljust(32, b"\x00")
    stage_skip_new += b"offlineStageSkipSpApplied\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: imports clear dirty bytes even for an interrupted
    #ticket use. An int1 marker records only the imported row's dirty pointer
    #in unused pull-frame SP200/208; no row changes until the pull succeeds.
    #Match both original importer and pull return addresses before any access.
    #Original canonical writers omit this delivery-only key. The accepted
    #pull queues the unchanged ItemUsed save, never a grant, debit or ACK.
    #shortcut: ARM64 original clean-pull recovery only; other ABIs and native lifecycle acceptance remain outstanding.
    union_pull_init_offset = 0x153F720
    union_info_import_offset = 0x153F730
    union_boss_import_offset = 0x153F750
    union_normal_import_offset = 0x153F770
    union_import_marker_offset = 0x153F790
    union_pull_flush_offset = 0x153F860
    union_info_page = ((0x25FA000 - (union_info_import_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    union_item_page = ((0x2811000 - (union_boss_import_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    union_info_return_page = ((0x27F2000 - (union_info_import_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    union_item_return_page = ((0x27FE000 - (union_boss_import_offset & ~0xFFF)) // 0x1000) & 0x1FFFFF
    union_pull_return_page = ((0x20BC000 - ((union_import_marker_offset + 20) & ~0xFFF)) // 0x1000) & 0x1FFFFF
    union_pull_init_new = struct.pack("<4I", 0xF9007FFF, 0xF90103FF, 0xF90107FF,
        0x14000000 | (((0x20BCB78 - (union_pull_init_offset + 12)) // 4) & 0x03FFFFFF))
    union_info_import_new = struct.pack("<8I", 0x3922827F,
        0x9000000B | ((union_info_page & 3) << 29) | ((union_info_page >> 2) << 5),
        0x9130A16B, 0x9122826C,
        0x9000000D | ((union_info_return_page & 3) << 29) | ((union_info_return_page >> 2) << 5),
        0x912631AD,
        0x14000000 | (((union_import_marker_offset - (union_info_import_offset + 24)) // 4) & 0x03FFFFFF), 0xD503201F)
    union_boss_import_new = struct.pack("<8I", 0x3905627F,
        0x9000000B | ((union_item_page & 3) << 29) | ((union_item_page >> 2) << 5),
        0x9114716B, 0x9105626C,
        0x9000000D | ((union_item_return_page & 3) << 29) | ((union_item_return_page >> 2) << 5),
        0x911BF1AD,
        0x14000000 | (((union_import_marker_offset - (union_boss_import_offset + 24)) // 4) & 0x03FFFFFF), 0xD503201F)
    union_normal_import_new = struct.pack("<8I", 0x3905627F,
        0x9000000B | ((union_item_page & 3) << 29) | ((union_item_page >> 2) << 5),
        0x9124916B, 0x9105626C,
        0x9000000D | ((union_item_return_page & 3) << 29) | ((union_item_return_page >> 2) << 5),
        0x912151AD,
        0x14000000 | (((union_import_marker_offset - (union_normal_import_offset + 24)) // 4) & 0x03FFFFFF), 0xD503201F)
    union_import_marker_new = struct.pack("<44I",
        0xF94007A9, 0xEB0D013F, 0x54000521, 0xF94003AA, 0xF9400549,
        0x9000000D | ((union_pull_return_page & 3) << 29) | ((union_pull_return_page >> 2) << 5),
        0x913491AD, 0xEB0D013F, 0x54000461, 0xF940014A, 0xD102814A,
        0xA9BA7BE0, 0xA90133EB, 0xF90013EA, 0x9100C3E0, 0x100003A1,
        0x94000000 | (((0x139BA20 - (union_import_marker_offset + 64)) // 4) & 0x03FFFFFF),
        0xF94003E0, 0x9100C3E1,
        0x94000000 | (((0x28B7C0C - (union_import_marker_offset + 76)) // 4) & 0x03FFFFFF),
        0xB40002A0, 0xB9402808, 0x7100091F, 0x54000060, 0x71000D1F, 0x54000201,
        0xF9401808, 0xF100051F, 0x540001A1, 0xF94013EA, 0xF9400FEC, 0xB9400148,
        0x35000088, 0xF900054C, 0x52800028, 0x14000005,
        0xF9400549, 0xEB0C013F, 0x54000060, 0x52800048, 0xB9000148,
        0xA94133EB, 0xA8C67BE0, 0xD61F0160)
    union_import_marker_new += b"offlineUnionTicketUse\x00".ljust(32, b"\x00")
    union_pull_flush_new = struct.pack("<32I", 0xA9B87BFD, 0xA90153F3,
        0x94000000 | (((0x20C839C - (union_pull_flush_offset + 8)) // 4) & 0x03FFFFFF),
        0x34000354, 0xB94283E8, 0x7100051F, 0x540002E1, 0xF94147E9, 0xB40002A9,
        0x52800028, 0x39000128, 0xF90143FF, 0xF90147FF,
        0x94000000 | (((0x20BAD74 - (union_pull_flush_offset + 52)) // 4) & 0x03FFFFFF),
        0xAA0003F3, 0x910083E0, 0x10000201,
        0x94000000 | (((0x139BA20 - (union_pull_flush_offset + 68)) // 4) & 0x03FFFFFF),
        0xA9047FFF, 0xF9002BFF, 0xAA1303E0, 0x910083E1, 0x2A1F03E2, 0x2A1F03E3, 0x2A1F03E4, 0x910103E5,
        0x94000000 | (((0x20C0D88 - (union_pull_flush_offset + 104)) // 4) & 0x03FFFFFF), 0x910103E0,
        0x94000000 | (((0x13A39C4 - (union_pull_flush_offset + 112)) // 4) & 0x03FFFFFF),
        0xA94153F3, 0xA8C87BFD, 0xD65F03C0)
    union_pull_flush_new += b"ItemUsed\x00".ljust(16, b"\x00")
    #SOURCE ONLY/UNTESTED:22f0170 skips construction for an existing PC. A
    #server-derived int1 on this original per-PC map invokes only the owned
    #current-job getter22ded68, which lazily creates missing original boards.
    #Preserve the lookup, absent-PC constructor, character refresh and real
    #save/ACK path; release the temporary shared job using the original ABI.
    #shortcut: ARM64 gacha missing-board recovery only; other ABIs and native lifecycle acceptance remain outstanding.
    lottery_board_offset = 0x153F900
    lottery_board_new = struct.pack("<48I",
        0xB4000568, 0xA9BB7BFD, 0xA90153F3, 0xF90013E8, 0xA90407E0, 0x910003FD,
        0x9101E3E0, 0x10000521,
        0x94000000 | (((0x13B1F5C - (lottery_board_offset + 32)) // 4) & 0x03FFFFFF),
        0x79400009, 0x12000D29, 0x51001529, 0x7100053F, 0x54000328,
        0xF9400409, 0xF100053F, 0x540002C1, 0xF94013E0, 0x3940C009,
        0x7100053F, 0x54000241, 0x9100C3E8, 0xA9037FFF,
        0x94000000 | (((0x22DED68 - (lottery_board_offset + 92)) // 4) & 0x03FFFFFF),
        0xF9401FF4, 0xB40001B4, 0x91002293, 0xC85FFE69, 0xD100052A,
        0xC80BFE6A, 0x35FFFFAB, 0xB50000E9, 0xF9400288, 0xAA1403E0,
        0xF9400908, 0xD63F0100, 0xAA1403E0,
        0x94000000 | (((0xD68330 - (lottery_board_offset + 148)) // 4) & 0x03FFFFFF),
        0xF94013E8, 0xA94407E0, 0xA94153F3, 0xA8C57BFD,
        0x14000000 | (((0x22F02F0 - (lottery_board_offset + 168)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x22F0250 - (lottery_board_offset + 172)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    lottery_board_new += b"offlinePcBoardRecovery\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED: for an existing owned PC, replay only the original
    #conditional outfit/story helpers when the server identifies unfinished
    #constructor unlocks. Read original PC.slot76 and retain original X23's
    #PC-key vtable; neither helper recreates the PC or rewrites its progress.
    #Then enter the separate board guard, with all original live state restored.
    #shortcut: ARM64 initial outfit/story recovery only; skipped linked-voice and other ABI paths remain unfinished.
    lottery_constructor_offset = 0x153FA00
    lottery_constructor_new = struct.pack("<48I",
        0xB4000528, 0xA9BB7BFD, 0xA90153F3, 0xF90013E8, 0xA90407E0, 0x910003FD,
        0x9101E3E0, 0x10000521,
        0x94000000 | (((0x13B1F5C - (lottery_constructor_offset + 32)) // 4) & 0x03FFFFFF),
        0x79400009, 0x12000D29, 0x51001529, 0x7100053F, 0x54000308,
        0xF9400409, 0xF100053F, 0x540002A1, 0xF94013E0, 0x3940C009,
        0x7100053F, 0x54000221, 0xF9400400, 0x52801381, 0x2A1F03E2,
        0x94000000 | (((0x139C3AC - (lottery_constructor_offset + 96)) // 4) & 0x03FFFFFF),
        0x34000180, 0xB9002BE0,
        0x94000000 | (((0x2504C48 - (lottery_constructor_offset + 108)) // 4) & 0x03FFFFFF), 0x9100A3E1,
        0x94000000 | (((0x2505FC4 - (lottery_constructor_offset + 116)) // 4) & 0x03FFFFFF),
        0x94000000 | (((0x2469080 - (lottery_constructor_offset + 120)) // 4) & 0x03FFFFFF),
        0xF94013E9, 0xB9402929, 0xF9001BF7, 0xB9003BE9, 0x9100C3E1,
        0x94000000 | (((0x2473D9C - (lottery_constructor_offset + 144)) // 4) & 0x03FFFFFF),
        0xF94013E8, 0xA94407E0, 0xA94153F3, 0xA8C57BFD,
        0x14000000 | (((lottery_board_offset - (lottery_constructor_offset + 164)) // 4) & 0x03FFFFFF),
        0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F, 0xD503201F)
    lottery_constructor_new += b"offlinePcConstructorRecovery\x00".ljust(32, b"\x00")
    #SOURCE ONLY/UNTESTED:206a0c4 records a successfully invoked callback in
    #its ID-keyed local receipt map, but does not consult it before invocation.
    #For regular1000/tutorial1001/ordinary5000, suppress a repeat with the same positive ID/type,
    #signature/token and freshly computed original verifier. Different delivery
    #projections are still the same immutable operation, not a second award.
    #The original verifier generation, done callback and actual save/ACK stay;
    #missing/mismatched local proof and every other type call original X8.
    #1000/1001 finish22f0170 and tutorial210c270 before the processor records them.
    #shortcut: ARM64 live gacha/stage receipt dedupe only; lost journals, save flush/cache rebinding, other types and ABIs remain unfinished.
    receipt_replay_offset = 0x153FB00
    receipt_string_offset = 0x153FD00
    receipt_string_new = struct.pack("<28I",
        0x39400008, 0x360002C8, 0x39400029, 0x36000289, 0xF9400408, 0xF9400429,
        0xEB09011F, 0x54000201, 0xB40001E8, 0xF104011F, 0x540001A8,
        0xF940080A, 0xF940082B, 0xB400014A, 0xB400012B,
        0x3840154C, 0x3840156D, 0x6B0D019F, 0x540000A1, 0xF1000508,
        0x54FFFF61, 0x52800020, 0xD65F03C0, 0x2A1F03E0, 0xD65F03C0,
        0xD503201F, 0xD503201F, 0xD503201F)
    receipt_replay_new = struct.pack("<60I",
        0xB9400B09, 0x510FA12A, 0x7100055F, 0x540000A9,
        0x5282710A, 0x6B0A013F, 0x54000681, 0xD503201F,
        0xA9BB7BFD, 0xA90153F3, 0xA90207E0, 0xA9030FE2, 0xA90423E4,
        0x910003FD, 0xAA1803F4, 0xF940028A, 0xF100015F, 0x5400044D,
        0xF94033E9, 0xF9401133, 0xB40003F3, 0xF9401269, 0xEB09015F,
        0x5400006B, 0x5400008C, 0x14000005, 0xF9400273, 0x17FFFFF9,
        0xF9400673, 0x17FFFFF7, 0xF9401669, 0xEB0A013F, 0x54000261,
        0xB9403269, 0xB9400A8A, 0x6B0A013F, 0x540001E1,
        0xB9406269, 0xB9403A8A, 0x6B0A013F, 0x54000161,
        0x91012260, 0x91008281,
        0x94000000 | (((receipt_string_offset - (receipt_replay_offset + 172)) // 4) & 0x03FFFFFF),
        0x340000E0, 0x9101A260, 0x91010281,
        0x94000000 | (((receipt_string_offset - (receipt_replay_offset + 188)) // 4) & 0x03FFFFFF),
        0x34000060, 0x52800029, 0x14000002, 0x2A1F03E9,
        0xA94423E4, 0xA9430FE2, 0xA94207E0, 0xA94153F3, 0xA8C57BFD,
        0x35000049, 0xD61F0100, 0xD65F03C0)
    #SOURCE ONLY/UNTESTED: common gainedPCs iteration keeps array element at SPc0.
    #A derived per-occurrence int1..4 resumes a proved first acquisition through
    #the original lookup and character/communication path. Control5 skips one
    #proved saved duplicate bond and joins the original iterator cleanup.
    #Exact array lengths/index/type guards preserve every unmarked real grant;
    #a missing local PC still uses the unchanged original constructor. The
    #remaining-effect bits select original normal-board/outfit/story helpers.
    #shortcut: ARM64 saved ordinary units/bonds only; missing linked voices/character/guests, other ABIs and native lifecycle remain unfinished.
    stage_pc_resume_offset = 0x153FD80
    stage_pc_effects_offset = 0x153FEC0
    stage_pc_resume_new = struct.pack("<68I",
        0x360007C0, 0xA9BD7BFD, 0xA90153F3, 0xF94002A0, 0x10000801,
        0x94000000 | (((0x13B1F5C - (stage_pc_resume_offset + 20)) // 4) & 0x03FFFFFF),
        0x79400008, 0x12000D08, 0x7100091F, 0x54000641, 0xF9400413, 0xB4000613,
        0xF94073E8, 0xB40005C8, 0x79400109, 0x12000D29, 0x7100093F, 0x54000541,
        0xF9400508, 0xB4000508, 0xA9402909, 0xF9407BEB, 0xEB09017F, 0x54000483,
        0xEB0A017F, 0x54000442, 0xCB090174, 0xF2400E9F, 0x540003E1,
        0xCB09014A, 0xA9402668, 0xCB080129, 0xEB0A013F, 0x54000341, 0xB4000328,
        0x8B140108, 0x79400109, 0x12000D29, 0x51001529, 0x7100053F, 0x54000268,
        0xF9400509, 0xD1000534, 0xF100129F, 0x54000262,
        0x94000000 | (((0x22EB268 - (stage_pc_resume_offset + 180)) // 4) & 0x03FFFFFF),
        0x9102E3E8, 0xD102C3A1, 0x2A1F03E2,
        0x94000000 | (((0x22EBA54 - (stage_pc_resume_offset + 196)) // 4) & 0x03FFFFFF),
        0xF9405FE8, 0xB40000A8,
        0x94000000 | (((stage_pc_effects_offset - (stage_pc_resume_offset + 208)) // 4) & 0x03FFFFFF),
        0xA94153F3, 0xA8C37BFD,
        0x14000000 | (((0x246C8D0 - (stage_pc_resume_offset + 220)) // 4) & 0x03FFFFFF),
        0xA94153F3, 0xA8C37BFD,
        0x14000000 | (((0x246C8B8 - (stage_pc_resume_offset + 232)) // 4) & 0x03FFFFFF),
        0xA94153F3, 0xA8C37BFD,
        0x14000000 | (((0x246C884 - (stage_pc_resume_offset + 244)) // 4) & 0x03FFFFFF),
        0x14000000 | (((0x246C8B8 - (stage_pc_resume_offset + 248)) // 4) & 0x03FFFFFF),
        0x54FFFF81, 0xA94153F3, 0xA8C37BFD,
        0x14000000 | (((0x246CC2C - (stage_pc_resume_offset + 264)) // 4) & 0x03FFFFFF),
        0xD503201F)
    stage_pc_resume_new += b"offlineStagePcResumes\x00".ljust(32, b"\x00")
    #W20=control-1: bit0 selects current normal job; bit1 selects original conditional slot76 outfit/story.
    #Keep the actual PC alive in the caller's shared pair; preserve its pointer across the temporary job cleanup.
    stage_pc_effects_new = struct.pack("<48I",
        0x340005B4, 0x3940C109, 0x7100053F, 0x54000541, 0xA9BC7BFD, 0xA90153F3,
        0xF9001BE8, 0x36000274, 0xAA0803E0, 0x910083E8, 0xA9027FFF,
        0x94000000 | (((0x22DED68 - (stage_pc_effects_offset + 44)) // 4) & 0x03FFFFFF),
        0xF94017F3, 0xB40001B3, 0x9100226A, 0xC85FFD49, 0xD100052B, 0xC80CFD4B,
        0x35FFFFAC, 0xB50000E9, 0xF9400268, 0xAA1303E0, 0xF9400908, 0xD63F0100, 0xAA1303E0,
        0x94000000 | (((0xD68330 - (stage_pc_effects_offset + 100)) // 4) & 0x03FFFFFF),
        0x36080234, 0xF9401BF3, 0xF9400660, 0x52801381, 0x2A1F03E2,
        0x94000000 | (((0x139C3AC - (stage_pc_effects_offset + 124)) // 4) & 0x03FFFFFF),
        0x34000160, 0xB9003BE0,
        0x94000000 | (((0x2504C48 - (stage_pc_effects_offset + 136)) // 4) & 0x03FFFFFF), 0x9100E3E1,
        0x94000000 | (((0x2505FC4 - (stage_pc_effects_offset + 144)) // 4) & 0x03FFFFFF),
        0x94000000 | (((0x2469080 - (stage_pc_effects_offset + 148)) // 4) & 0x03FFFFFF),
        0xF90013FA, 0xB9402A69, 0xB9002BE9, 0x910083E1,
        0x94000000 | (((0x2473D9C - (stage_pc_effects_offset + 168)) // 4) & 0x03FFFFFF),
        0xA94153F3, 0xA8C47BFD, 0xD65F03C0, 0xD503201F, 0xD503201F)
    patched = bytearray(data)
    for offset, old, new in (
        (prefix_offset, bytes(24), prefix_new),
        (stage_cp_offset, bytes(112), stage_cp_new),
        (dispatch_cp_offset, bytes(96), dispatch_cp_new),
        (friendship_cp_offset, bytes(96), friendship_cp_new),
        (friendship_item_offset, bytes(96), friendship_item_new),
        (stage_counts_offset, bytes(128), stage_counts_new),
        (pvb_counts_offset, bytes(128), pvb_counts_new),
        (gve_counts_offset, bytes(128), gve_counts_new),
        (stage_json_offset, bytes(16), stage_json_new),
        (stage_cumulative_offset, bytes(128), stage_cumulative_new),
        (pvb_cumulative_offset, bytes(144), pvb_cumulative_new),
        (gve_cumulative_offset, bytes(128), gve_cumulative_new),
        (stage_last_date_offset, bytes(128), stage_last_date_new),
        (pvb_last_date_offset, bytes(128), pvb_last_date_new),
        (gve_last_date_offset, bytes(128), gve_last_date_new),
        (expedition_xp_offset, bytes(256), expedition_xp_new),
        (pvb_score_event_offset, bytes(88), pvb_score_event_new),
        (stage_skip_guard_offset, bytes(24), stage_skip_guards_new),
        (stage_skip_offset, bytes(240), stage_skip_new),
        (union_pull_init_offset, bytes(16), union_pull_init_new),
        (union_info_import_offset, bytes(32), union_info_import_new),
        (union_boss_import_offset, bytes(32), union_boss_import_new),
        (union_normal_import_offset, bytes(32), union_normal_import_new),
        (union_import_marker_offset, bytes(208), union_import_marker_new),
        (union_pull_flush_offset, bytes(144), union_pull_flush_new),
        (lottery_board_offset, bytes(224), lottery_board_new),
        (lottery_constructor_offset, bytes(224), lottery_constructor_new),
        (receipt_replay_offset, bytes(240), receipt_replay_new),
        (receipt_string_offset, bytes(112), receipt_string_new),
        (stage_pc_resume_offset, bytes(304), stage_pc_resume_new),
        (stage_pc_effects_offset, bytes(192), stage_pc_effects_new),
        (0x246C880, bytes.fromhex("c0010036"), struct.pack("<I",
            0x14000000 | (((stage_pc_resume_offset - 0x246C880) // 4) & 0x03FFFFFF))),
        (0x206A360, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((receipt_replay_offset - 0x206A360) // 4) & 0x03FFFFFF))),
        (0x22F024C, bytes.fromhex("280500b5"), struct.pack("<I",
            0x14000000 | (((lottery_constructor_offset - 0x22F024C) // 4) & 0x03FFFFFF))),
        (0x23EB2C8, bytes.fromhex("20150054"), struct.pack("<I",
            0x14000000 | (((friendship_item_offset - 0x23EB2C8) // 4) & 0x03FFFFFF))),
        (0x20BCB74, bytes.fromhex("ff7f00f9"), struct.pack("<I",
            0x14000000 | (((union_pull_init_offset - 0x20BCB74) // 4) & 0x03FFFFFF))),
        (0x25FAC24, bytes.fromhex("7f822239"), struct.pack("<I",
            0x14000000 | (((union_info_import_offset - 0x25FAC24) // 4) & 0x03FFFFFF))),
        (0x2811518, bytes.fromhex("7f620539"), struct.pack("<I",
            0x14000000 | (((union_boss_import_offset - 0x2811518) // 4) & 0x03FFFFFF))),
        (0x2811920, bytes.fromhex("7f620539"), struct.pack("<I",
            0x14000000 | (((union_normal_import_offset - 0x2811920) // 4) & 0x03FFFFFF))),
        (0x20BD150, bytes.fromhex("932c0094"), struct.pack("<I",
            0x94000000 | (((union_pull_flush_offset - 0x20BD150) // 4) & 0x03FFFFFF))),
        (0x246F008, bytes.fromhex("30010094"), struct.pack("<I",
            0x94000000 | (((pvb_score_event_offset - 0x246F008) // 4) & 0x03FFFFFF))),
        (0x2451998, bytes.fromhex("8d530894"), struct.pack("<I",
            0x94000000 | (((stage_last_date_offset - 0x2451998) // 4) & 0x03FFFFFF))),
        (0x245293C, bytes.fromhex("78500894"), struct.pack("<I",
            0x94000000 | (((stage_cumulative_offset - 0x245293C) // 4) & 0x03FFFFFF))),
        (0x246C58C, bytes.fromhex("f50300aa"), struct.pack("<I",
            0x14000000 | (((stage_json_offset - 0x246C58C) // 4) & 0x03FFFFFF))),
        (0x245197C, bytes.fromhex("d9030094"), struct.pack("<I",
            0x94000000 | (((stage_counts_offset - 0x245197C) // 4) & 0x03FFFFFF))),
        (0x23E6CB8, bytes.fromhex("402c0054"), struct.pack("<I",
            0x14000000 | (((stage_cp_offset - 0x23E6CB8) // 4) & 0x03FFFFFF))),
        (0x209C038, bytes.fromhex("7737ff97"), struct.pack("<I",
            0x94000000 | (((prefix_offset - 0x209C038) // 4) & 0x03FFFFFF))),
        (0x24ABD70, bytes.fromhex("e103152a"), bytes.fromhex("21008052")),
        (error_offset, error_old, error_new),
        # DomainElementEventStage::setScore keeps incoming int64 in X22, but
        # the new-record path SXTW narrows it before the nonnegative int64
        # UserElementEventRecord::setScore (0x288555c). Existing-row updates
        # already preserve int64. Keep the full score on first creation too.
        (0x25D0300, bytes.fromhex("c17e4093"), bytes.fromhex("e10316aa")),
        #286e578/286e8b8 emit complete normal/assist snapshots for a dirty
        #slot;274f0dc emits the complete party. No qualification/score/signature
        #or ACK check is skipped, and no server-side stats are fabricated.
        (gve_copy_offset, bytes(32), gve_copy_new),
        (0x2371F70, bytes.fromhex("65f31394"), struct.pack("<I",
            0x94000000 | (((gve_copy_offset - 0x2371F70) // 4) & 0x03FFFFFF))),
        (gve_party_replay_offset, bytes(136), gve_party_replay_new),
        (gve_party_gate_offset, bytes(16), gve_party_gate_new),
        (0x246FB70, bytes.fromhex("e603172a"), struct.pack("<I",
            0x94000000 | (((gve_party_replay_offset - 0x246FB70) // 4) & 0x03FFFFFF))),
        (0x145152C, bytes.fromhex("29030034"), struct.pack("<I",
            0x14000000 | (((gve_party_gate_offset - 0x145152C) // 4) & 0x03FFFFFF))),
        (scratch_gain_offset, bytes(12), scratch_gain_new),
        (event_box_counter_offset, bytes(88), event_box_counter_new),
        (event_box_bonus_gain_offset, bytes(100), event_box_bonus_gain_new),
        (event_box_item_gain_offset, bytes(132), event_box_item_gain_new),
        (event_box_common_gain_offset, bytes(44), event_box_common_gain_new),
        (event_box_item_event_gate_offset, bytes(20), event_box_item_event_gate_new),
        (0x240CD18, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((scratch_gain_offset - 0x240CD18) // 4) & 0x03FFFFFF))),
        (0x240CFCC, bytes.fromhex("6b1d0094"), struct.pack("<I",
            0x94000000 | (((event_box_counter_offset - 0x240CFCC) // 4) & 0x03FFFFFF))),
        (0x240D0DC, bytes.fromhex("20013fd6"), struct.pack("<I",
            0x94000000 | (((event_box_bonus_gain_offset - 0x240D0DC) // 4) & 0x03FFFFFF))),
        (0x240D260, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((event_box_item_gain_offset - 0x240D260) // 4) & 0x03FFFFFF))),
        (0x24D8870, bytes.fromhex("f303012a"), struct.pack("<I",
            0x14000000 | (((event_box_common_gain_offset - 0x24D8870) // 4) & 0x03FFFFFF))),
        (0x24D88FC, bytes.fromhex("7f060071"), bytes.fromhex("ff060071")),
        (0x24D890C, bytes.fromhex("e103132a"), bytes.fromhex("e103172a")),
        (0x24D8918, bytes.fromhex("e0071c32"), struct.pack("<I",
            0x14000000 | (((event_box_item_event_gate_offset - 0x24D8918) // 4) & 0x03FFFFFF))),
        (0x24BE31C, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((scratch_gain_offset - 0x24BE31C) // 4) & 0x03FFFFFF))),
        #SOURCE ONLY/UNTESTED: derived consumedValis0 passes the original
        #affordability check, but must not dirty/rewind the currency signature.
        (0x243AEAC, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((scratch_gain_offset - 0x243AEAC) // 4) & 0x03FFFFFF))),
        (0x25722C4, bytes.fromhex("00013fd6"), struct.pack("<I",
            0x94000000 | (((scratch_gain_offset - 0x25722C4) // 4) & 0x03FFFFFF))),
        (familia_item_callback_offset, bytes(208), familia_item_callback_new),
        (familia_count_offset, bytes(144), familia_count_new),
        (familia_date_offset, bytes(144), familia_date_new),
        (0x2570F7C, bytes.fromhex("b3030c94"), struct.pack("<I",
            0x94000000 | (((familia_count_offset - 0x2570F7C) // 4) & 0x03FFFFFF))),
        (0x2570F88, bytes.fromhex("f2030c94"), struct.pack("<I",
            0x94000000 | (((familia_date_offset - 0x2570F88) // 4) & 0x03FFFFFF))),
        (0x257231C, bytes.fromhex("05fbff97"), struct.pack("<I",
            0x94000000 | (((familia_item_callback_offset - 0x257231C) // 4) & 0x03FFFFFF))),
        (casino_gain_offset, bytes(12), casino_gain_new),
        (0x236271C, bytes.fromhex("1b740294"), struct.pack("<I",
            0x94000000 | (((casino_gain_offset - 0x236271C) // 4) & 0x03FFFFFF))),
        (0x248D5EC, bytes.fromhex("67c8fd97"), struct.pack("<I",
            0x94000000 | (((casino_gain_offset - 0x248D5EC) // 4) & 0x03FFFFFF))),
        (stage_xp_offset, bytes(80), stage_xp_new),
        (0x2308EE0, bytes.fromhex("1f040071"), struct.pack("<I",
            0x14000000 | (((expedition_xp_offset - 0x2308EE0) // 4) & 0x03FFFFFF))),
        (0x2309274, bytes.fromhex("5a2d0094"), struct.pack("<I",
            0x94000000 | (((expedition_party_gate_offset - 0x2309274) // 4) & 0x03FFFFFF))),
        (0x2309284, bytes.fromhex("cbe3ff97"), struct.pack("<I",
            0x94000000 | (((expedition_stage_gate_offset - 0x2309284) // 4) & 0x03FFFFFF))),
        (0x246C4C8, bytes.fromhex("c07afb97"), struct.pack("<I",
            0x94000000 | (((stage_skip_ticket_guard - 0x246C4C8) // 4) & 0x03FFFFFF))),
        (0x246C4FC, bytes.fromhex("e7520314"), struct.pack("<I",
            0x14000000 | (((stage_skip_sp_guard - 0x246C4FC) // 4) & 0x03FFFFFF))),
        (0x246C6BC, bytes.fromhex("79ffff97"), struct.pack("<I",
            0x94000000 | (((stage_skip_offset - 0x246C6BC) // 4) & 0x03FFFFFF))),
        (0x246C6D0, bytes.fromhex("56ffff97"), struct.pack("<I",
            0x94000000 | (((stage_xp_offset - 0x246C6D0) // 4) & 0x03FFFFFF))),
    ):
        if len(old) != len(new) or data[offset:offset + len(old)] != old:
            raise ValueError(f"Unexpected ARM64 offline-client code at {offset:#x}")
        patched[offset:offset + len(old)] = new
    return bytes(patched)


def find_android_tools() -> tuple[Path, Path, Path, Path, Path, Path]:
    candidates = [
        Path(value)
        for value in (os.environ.get("ANDROID_SDK_ROOT"), os.environ.get("ANDROID_HOME"))
        if value
    ]
    candidates += [
        Path.home() / "AppData/Local/Android/Sdk",
        Path("C:/Main/Productivity/Coding/Android/Sdk"),
    ]
    sdk = next((path for path in candidates if path.is_dir()), None)
    if not sdk:
        raise FileNotFoundError("Android SDK not found; set ANDROID_SDK_ROOT")
    versions = sorted(
        (path for path in (sdk / "build-tools").iterdir() if (path / "zipalign.exe").exists()),
        reverse=True,
    )
    if not versions:
        raise FileNotFoundError("Android SDK build tools not found")
    tools = versions[0]
    java_home = Path(os.environ.get("JAVA_HOME", "C:/Program Files/Android/Android Studio/jbr"))
    java, keytool = java_home / "bin/java.exe", java_home / "bin/keytool.exe"
    adb = sdk / "platform-tools/adb.exe"
    required = (tools / "zipalign.exe", tools / "aapt.exe", tools / "lib/apksigner.jar", java, keytool, adb)
    if missing := [str(path) for path in required if not path.exists()]:
        raise FileNotFoundError("Missing Android tools: " + ", ".join(missing))
    return (
        tools / "zipalign.exe",
        tools / "aapt.exe",
        tools / "lib/apksigner.jar",
        java,
        keytool,
        adb,
    )


def patch_and_sign_apk(
    source_apk: Path,
    output_apk: Path,
    primary: bool,
    tools: tuple[Path, Path, Path, Path, Path],
    keystore: Path,
    password: str,
) -> tuple[list[dict[str, str]], str]:
    zipalign, aapt, signer, java, _keytool = tools
    with tempfile.TemporaryDirectory(prefix="apk-", dir=WORK) as temp_name:
        temp = Path(temp_name)
        unsigned, aligned, signed = temp / "unsigned.apk", temp / "aligned.apk", temp / "signed.apk"
        changes = []
        with zipfile.ZipFile(source_apk) as source, zipfile.ZipFile(unsigned, "w") as target:
            for entry in source.infolist():
                name = entry.filename
                if name == "stamp-cert-sha256" or (
                    name.startswith("META-INF/")
                    and (name == "META-INF/MANIFEST.MF" or name.endswith((".RSA", ".DSA", ".EC", ".SF")))
                ):
                    continue
                data = source.read(entry)
                before = hashlib.sha256(data).hexdigest()
                if name == "AndroidManifest.xml":
                    if primary:
                        data = patch_manifest(data)
                    else:
                        old, new = ORIGINAL_PACKAGE.encode("utf-16le"), PRIVATE_PACKAGE.encode("utf-16le")
                        if data.count(old) != 1:
                            raise ValueError(f"Unexpected split package identity in {source_apk.name}")
                        data = data.replace(old, new)
                elif name == "resources.arsc":
                    old, new = ORIGINAL_PACKAGE.encode("utf-16le"), PRIVATE_PACKAGE.encode("utf-16le")
                    if data.count(old) not in (0, 1):
                        raise ValueError("Unexpected package identity in resources.arsc")
                    data = data.replace(old, new)
                elif name == "classes.dex":
                    data = patch_dex(data)
                elif name == "classes3.dex":
                    data = patch_service_dependencies(data)
                elif name.endswith("/libapp.so"):
                    for old, new in URL_PATCHES.items():
                        data = patch_c_string(data, old, new)
                    data = patch_native_client(data, Path(name).parent.name)
                after = hashlib.sha256(data).hexdigest()
                if before != after:
                    changes.append({"member": name, "before_sha256": before, "after_sha256": after})
                target.writestr(entry, data)
        run([zipalign, "-P", "16", "4", unsigned, aligned])
        env = os.environ | {"DANMEMORE_KEY_PASSWORD": password}
        run(
            [
                java,
                "-jar",
                signer,
                "sign",
                "--min-sdk-version",
                "19",
                "--ks",
                keystore,
                "--ks-pass",
                "env:DANMEMORE_KEY_PASSWORD",
                "--v1-signing-enabled",
                "true",
                "--v2-signing-enabled",
                "true",
                "--v3-signing-enabled",
                "true",
                "--v4-signing-enabled",
                "false",
                "--out",
                signed,
                aligned,
            ],
            env=env,
        )
        verification = run(
            [
                java,
                "-jar",
                signer,
                "verify",
                "--min-sdk-version",
                "19",
                "--verbose",
                "--print-certs",
                signed,
            ]
        )
        tree = run([aapt, "dump", "xmltree", signed, "AndroidManifest.xml"])
        required = (
            f'package="{PRIVATE_PACKAGE}"',
            "usesCleartextTraffic(0x010104ec)=(type 0x12)0xffffffff",
            '="DanMemoRe"',
        )
        if any(value not in tree for value in required):
            if primary or f'package="{PRIVATE_PACKAGE}"' not in tree:
                raise ValueError(f"Patched manifest did not validate: {source_apk.name}")
        output_apk.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(signed, output_apk)
    signer_digest = next(
        line.rsplit(":", 1)[1].strip()
        for line in verification.splitlines()
        if "certificate SHA-256 digest:" in line
    )
    return changes, signer_digest


def build() -> None:
    if not SOURCE_APK.is_file():
        raise FileNotFoundError(f"Original APK not found: {SOURCE_APK}")
    WORK.mkdir(exist_ok=True)
    DIST.mkdir(exist_ok=True)
    zipalign, aapt, signer, java, keytool, _adb = find_android_tools()
    password_path, keystore = WORK / "local-key.password", WORK / "local-key.p12"
    if password_path.exists() != keystore.exists():
        raise ValueError("Incomplete local signing identity in .work")
    if not keystore.exists():
        password_path.write_text(secrets.token_hex(24) + "\n", encoding="ascii")
        env = os.environ | {"DANMEMORE_KEY_PASSWORD": password_path.read_text().strip()}
        run(
            [
                keytool,
                "-genkeypair",
                "-keystore",
                keystore,
                "-storetype",
                "PKCS12",
                "-alias",
                "danmemore-local",
                "-storepass:env",
                "DANMEMORE_KEY_PASSWORD",
                "-keyalg",
                "RSA",
                "-keysize",
                "2048",
                "-validity",
                "3650",
                "-dname",
                "CN=DanMemoRe Local Client",
            ],
            env=env,
        )
    password = password_path.read_text(encoding="ascii").strip()
    tools = zipalign, aapt, signer, java, keytool
    changes, signer_digest = patch_and_sign_apk(
        SOURCE_APK, OUTPUT_APK, True, tools, keystore, password
    )
    arm64_outputs = []
    if ARM64_XAPK.is_file():
        if sha256(ARM64_XAPK) != ARM64_XAPK_SHA256:
            raise ValueError("Unexpected APKPure arm64 XAPK hash")
        ARM64_SOURCE.mkdir(exist_ok=True)
        with zipfile.ZipFile(ARM64_XAPK) as bundle:
            for name in ARM64_APKS:
                (ARM64_SOURCE / name).write_bytes(bundle.read(name))
        for name in ARM64_APKS:
            source = ARM64_SOURCE / name
            output = ARM64_OUTPUT / name
            split_changes, split_signer = patch_and_sign_apk(
                source, output, name == "com.eu.danmemo.apk", tools, keystore, password
            )
            if split_signer != signer_digest:
                raise ValueError("Split APK signer mismatch")
            arm64_outputs.append(
                {
                    "file": str(output.relative_to(ROOT)),
                    "bytes": output.stat().st_size,
                    "sha256": sha256(output),
                    "changed_members": split_changes,
                }
            )
    identity = {
        "project": "DanMemoRe",
        "purpose": "isolated local routing client; unknown game routes fail closed",
        "source_apk": {"bytes": SOURCE_APK.stat().st_size, "sha256": sha256(SOURCE_APK)},
        "output_apk": {"bytes": OUTPUT_APK.stat().st_size, "sha256": sha256(OUTPUT_APK)},
        "package": PRIVATE_PACKAGE,
        "endpoint": ENDPOINT,
        "signer_sha256": signer_digest,
        "patched_urls": {old.decode(): new.decode() for old, new in URL_PATCHES.items()},
        "changed_members": changes,
        "arm64_outputs": arm64_outputs,
    }
    IDENTITY.write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(identity, indent=2))


def content_path(request_path: str) -> Path | None:
    path = unquote(urlsplit(request_path).path)
    name = PurePosixPath(path).name
    if path.startswith(("/api/asset/manifest/", "/content/asset/manifest/")) and name.startswith("version.manifest."):
        phase = name.rpartition(".")[2]
        candidate = CONTENTS / phase / "version.manifest"
        return candidate if phase in tuple("12345678") and candidate.is_file() else None
    parts = PurePosixPath(path).parts
    if path.startswith(("/api/manifests/us/pkm/", "/content/manifests/us/pkm/")) and len(parts) >= 2:
        name = parts[-2]
        if name.startswith("project.manifest."):
            phase = name.rpartition(".")[2]
            return local_project_manifest(phase) if phase in tuple("12345678") else None
        candidate = CONTENTS / "1" / "manifests" / name
        return candidate if candidate.is_file() else None
    if path.startswith(("/api/contents/", "/content/contents/")):
        return asset_paths().get(path)
    prefix = next((value for value in ("/content/", "/storage/") if path.startswith(value)), None)
    if not prefix:
        return None
    parts = PurePosixPath(path[len(prefix) :]).parts
    if not parts or any(part in ("", ".", "..") for part in parts):
        return None
    candidate = (CONTENTS / Path(*parts)).resolve()
    root = CONTENTS.resolve()
    return candidate if candidate == root or root in candidate.parents else None


@functools.lru_cache(maxsize=8)
def local_project_manifest(phase: str) -> Path:
    WORK.mkdir(exist_ok=True)
    source_root = CONTENTS / phase
    manifest = json.loads((source_root / "project.manifest").read_text(encoding="utf-8"))
    for relative, metadata in list(manifest["assets"].items()):
        path = source_root / relative
        if not path.is_file():
            del manifest["assets"][relative]
            continue
        with path.open("rb") as file:
            metadata["md5"] = hashlib.file_digest(file, "md5").hexdigest()
        metadata["size"] = path.stat().st_size
    output = WORK / f"project.manifest.{phase}.local"
    output.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    return output


@functools.lru_cache(maxsize=1)
def asset_paths() -> dict[str, Path]:
    result = {}
    for phase in "12345678":
        manifest = json.loads((CONTENTS / phase / "project.manifest").read_text(encoding="utf-8"))
        for relative, metadata in manifest["assets"].items():
            result["/api/" + metadata["path"]] = CONTENTS / phase / Path(relative)
            result["/content/" + metadata["path"]] = CONTENTS / phase / Path(relative)
    return result


def byte_range(value: str | None, size: int) -> tuple[int, int, bool]:
    if not value:
        return 0, size - 1, False
    unit, separator, spec = value.partition("=")
    start_text, dash, end_text = spec.partition("-")
    if unit != "bytes" or separator != "=" or dash != "-" or not start_text:
        raise ValueError("Unsupported Range header")
    start = int(start_text)
    end = min(int(end_text), size - 1) if end_text else size - 1
    if start < 0 or start > end or start >= size:
        raise ValueError("Range outside file")
    return start, end, True


def api_action(request_path: str) -> str | None:
    path = urlsplit(request_path).path.rstrip("/")
    return next((action for action in API_ACTIONS if path.endswith("/" + action)), None)


def decode_request(body: bytes) -> dict:
    process = subprocess.run(
        [
            "openssl",
            "enc",
            "-d",
            "-aes-256-cbc",
            "-nopad",
            "-K",
            LOCAL_AES_KEY.hex(),
            "-iv",
            LOCAL_AES_IV.encode().hex(),
        ],
        input=body,
        capture_output=True,
    )
    if process.returncode:
        raise ValueError("Could not decrypt the local client request")
    value = json.loads(zlib.decompress(process.stdout))
    if not isinstance(value, dict):
        raise ValueError("Expected a request object")
    return value


def identity_field(table: str, existing: list[dict], rows: list[dict]) -> str | None:
    inferred = table.removeprefix("User")
    inferred = inferred[:1].lower() + inferred[1:] + "Id"
    for field in ("id", inferred):
        if rows and all(field in row for row in rows):
            return field
    if len(existing) <= 1 and len(rows) <= 1:
        return None
    candidates = {
        field
        for row in rows
        for field, item in row.items()
        if field != "userId" and field.endswith("Id") and not isinstance(item, (dict, list))
    }
    for field in sorted(candidates, key=len):
        values = [row.get(field) for row in rows]
        if (
            None not in values
            and all(not isinstance(value, (dict, list)) for value in values)
            and len(values) == len(set(values))
        ):
            return field
    return None


def merge_rows(state: dict, table: str, rows: list[dict], *, delete: bool) -> None:
    if not rows:
        return
    existing = state["data"].setdefault(table, [])
    field = identity_field(table, existing, rows)
    if field:
        changed = {row[field] for row in rows}
        existing[:] = [row for row in existing if row.get(field) not in changed]
    elif delete:
        existing[:] = [row for row in existing if row not in rows]
        return
    else:
        existing.clear()
    if not delete:
        existing.extend(rows)


def apply_user_data_push(state: dict, value: dict) -> None:
    for delta in value["deltas"]:
        for table, rows in delta["putItems"].items():
            merge_rows(state, table, rows, delete=False)
        for table, rows in delta["deleteItems"].items():
            merge_rows(state, table, rows, delete=True)
    state["dataTokens"].update(value["checksums"]["after"])


def save_user_data_state(state: dict) -> None:
    USER_DATA_STATE.parent.mkdir(exist_ok=True)
    temporary = USER_DATA_STATE.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, separators=(",", ":")), encoding="utf-8")
    temporary.replace(USER_DATA_STATE)


def ensure_starter_pc(state: dict) -> bool:
    if state["data"].get("UserPC"):
        return False
    pc = {
        "abilityPoint": 0,
        "attackPattern": 2,
        "battlePlayCount": 0,
        "bookEntryState": 1,
        "currentDP": 0,
        "currentJobIndex": 1,
        "destinyPoint": 0,
        "entryState": 0,
        "equippedArmorIndex": 0,
        "equippedWeaponIndex": 0,
        "heroSublimateLevel": 0,
        "hp": 0,
        "isUnlockedHeroSublimate": False,
        "jobSlots": [],
        "jobs": [],
        "joiningState": 0,
        "limitbreakCount": 0,
        "mp": 0,
        "ownerType": 1,
        "pcId": STARTER_PC_ID,
        "signature": 0,
        "skillSlots": [],
        "totalExp": 0,
        "userId": LOCAL_USER_ID,
        "variableChantLevel": 1,
    }
    state["data"]["UserPC"] = [pc]
    state["dataTokens"]["UserPC"] = hashlib.md5(msgpack([pc])).hexdigest()
    return True


def ensure_starting_area(state: dict) -> bool:
    if state["data"].get("UserArea"):
        return False
    info = next(iter(state["data"].get("UserInfo", [])), {})
    area_id = info.get("position", {}).get("areaId", 0)
    if not area_id:
        return False
    area = {
        "areaId": area_id,
        "encountCount": 0,
        "lineBlockDwords": [0] * 8,
        "userId": LOCAL_USER_ID,
    }
    state["data"]["UserArea"] = [area]
    state["dataTokens"]["UserArea"] = "996813f3763ee6af88afd3de32bf2768"
    return True


def load_user_data_state() -> dict:
    if USER_DATA_STATE.is_file():
        state = json.loads(USER_DATA_STATE.read_text(encoding="utf-8"))
        if not isinstance(state.get("data"), dict) or not isinstance(state.get("dataTokens"), dict):
            raise ValueError("Invalid local user-data state")
        if ensure_starter_pc(state) | ensure_starting_area(state):
            save_user_data_state(state)
        return state
    state = {"data": {}, "dataTokens": {}}
    request_log = WORK / "requests.jsonl"
    if request_log.is_file():
        for line in request_log.read_text(encoding="utf-8").splitlines():
            try:
                value = json.loads(line).get("decoded_body", {})
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and isinstance(value.get("deltas"), list):
                apply_user_data_push(state, value)
    ensure_starter_pc(state)
    ensure_starting_area(state)
    if state["data"]:
        save_user_data_state(state)
    return state


def push_response(value: dict, state: dict | None = None) -> dict:
    deltas = value.get("deltas")
    checksums = value.get("checksums")
    if not isinstance(deltas, list) or not isinstance(checksums, dict):
        raise ValueError("Unsupported user-data push")
    after = checksums.get("after")
    if not isinstance(after, dict):
        raise ValueError("Unsupported user-data checksums")
    puts: dict[str, int] = {}
    deletes: dict[str, int] = {}
    triggers = []
    for delta in deltas:
        if not isinstance(delta, dict) or not isinstance(delta.get("trigger"), str):
            raise ValueError("Unsupported user-data delta")
        triggers.append(delta["trigger"])
        for result, name in ((puts, "putItems"), (deletes, "deleteItems")):
            items = delta.get(name)
            if not isinstance(items, dict):
                raise ValueError("Unsupported user-data items")
            for table, rows in items.items():
                if (
                    not isinstance(table, str)
                    or not isinstance(rows, list)
                    or not all(isinstance(row, dict) for row in rows)
                ):
                    raise ValueError("Unsupported user-data table")
                result[table] = result.get(table, 0) + len(rows)
    if state is not None:
        apply_user_data_push(state, value)
    return {
        "code": 0,
        "triggers": triggers,
        "putItems": puts,
        "deleteItems": deletes or [],
        "data": {},
        "operations": [],
        "dones": [],
        "dataTokens": after,
    }


def msgpack(value: object) -> bytes:
    if value is None:
        return b"\xc0"
    if value is False:
        return b"\xc2"
    if value is True:
        return b"\xc3"
    if isinstance(value, int):
        if 0 <= value <= 0x7F:
            return bytes((value,))
        if -32 <= value < 0:
            return bytes((value & 0xFF,))
        for limit, marker, code in (
            (0xFF, 0xCC, ">B"),
            (0xFFFF, 0xCD, ">H"),
            (0xFFFFFFFF, 0xCE, ">I"),
            (0xFFFFFFFFFFFFFFFF, 0xCF, ">Q"),
        ):
            if 0 <= value <= limit:
                return bytes((marker,)) + struct.pack(code, value)
        for minimum, marker, code in (
            (-0x80, 0xD0, ">b"),
            (-0x8000, 0xD1, ">h"),
            (-0x80000000, 0xD2, ">i"),
            (-0x8000000000000000, 0xD3, ">q"),
        ):
            if value >= minimum:
                return bytes((marker,)) + struct.pack(code, value)
        raise ValueError("MessagePack integer is outside 64-bit range")
    if isinstance(value, float):
        return b"\xcb" + struct.pack(">d", value)
    if isinstance(value, str):
        encoded = value.encode()
        size = len(encoded)
        if size <= 31:
            return bytes((0xA0 | size,)) + encoded
        if size <= 0xFF:
            return b"\xd9" + struct.pack(">B", size) + encoded
        if size <= 0xFFFF:
            return b"\xda" + struct.pack(">H", size) + encoded
        return b"\xdb" + struct.pack(">I", size) + encoded
    if isinstance(value, list):
        size = len(value)
        if size <= 15:
            prefix = bytes((0x90 | size,))
        elif size <= 0xFFFF:
            prefix = b"\xdc" + struct.pack(">H", size)
        else:
            prefix = b"\xdd" + struct.pack(">I", size)
        return prefix + b"".join(msgpack(item) for item in value)
    if isinstance(value, dict):
        size = len(value)
        if size <= 15:
            prefix = bytes((0x80 | size,))
        elif size <= 0xFFFF:
            prefix = b"\xde" + struct.pack(">H", size)
        else:
            prefix = b"\xdf" + struct.pack(">I", size)
        return prefix + b"".join(msgpack(key) + msgpack(item) for key, item in value.items())
    raise ValueError(f"Unsupported MessagePack value: {type(value).__name__}")


def pull_response(value: dict, state: dict | None = None) -> bytes:
    tables = value.get("tables")
    if not isinstance(tables, list) or not tables or not all(isinstance(table, str) for table in tables):
        raise ValueError("Unsupported user-data pull")
    if tables == ["UserCommunicationCharacter"]:
        # Client validation requires one unlocked home character on a fresh account.
        return bytes.fromhex(
            "83a46461746181ba55736572436f6d6d756e69636174696f6e436861726163746572"
            "9188a6757365724964ce3b9aca01ab6368617261637465724964ce05f5e105a97369676e6174"
            "75726500a9636f7374756d654964ce3ceae4f8ae636861"
            "726163746572537461746502ac6a6f696e4461746554696d6500ae746f756368436f"
            "756e744275737400af746f756368436f756e744f7468657200aa64617461546f6b65"
            "6e7381ba55736572436f6d6d756e69636174696f6e436861726163746572d9203133"
            "326435323133336134316266623633306166346566666132346165623534a8726563"
            "6f76657279c2"
        )
    if len(tables) > 15:
        raise ValueError("Too many user-data tables in one pull")
    state = state or {"data": {}, "dataTokens": {}}
    return msgpack(
        {
            "data": {table: state["data"].get(table, []) for table in tables},
            "dataTokens": {table: state["dataTokens"].get(table, "") for table in tables},
            "recovery": False,
        }
    )


def api_response(action: str, request_body: bytes = b"", state: dict | None = None) -> tuple[str, bytes]:
    if action == "matching_user/game_user_id":
        value = {"code": 0, "game_user_id": LOCAL_USER_ID, "aesIv": LOCAL_AES_IV}
    elif action == "user/login":
        value = {
            "code": 0,
            "apiUrl": f"{ENDPOINT}/api",
            "cdnUrl": f"{ENDPOINT}/content",
            "game_user_id": LOCAL_USER_ID,
            "aesIv": LOCAL_AES_IV,
            "userDataPullMultiRequestEnabled": False,
            "warningId": 0,
            "warningTitle": "",
            "warningMessage": "",
            "agreePolicyVersionUpdate": False,
            "data": {},
            "dataTokens": {},
        }
    elif action == "user_data/confirm":
        tokens = dict(state["dataTokens"]) if state else {}
        tokens.setdefault("UserCommunicationCharacter", HOME_CHARACTER_TOKEN)
        value = {
            "code": 0,
            "dataTokens": tokens,
            "migrators": [],
            "operations": [],
        }
    elif action == "user_data/push":
        value = push_response(decode_request(request_body), state)
    elif action == "user_data/pull":
        return "application/x-msgpack", pull_response(decode_request(request_body), state)
    else:
        raise ValueError(f"Unsupported API action: {action}")
    return "application/json", json.dumps(value, separators=(",", ":")).encode()


class LocalHandler(http.server.BaseHTTPRequestHandler):
    server_version = "DanMemoRe/0"

    def log_message(self, _format: str, *_args: object) -> None:
        pass

    def record(self, body: bytes) -> None:
        WORK.mkdir(exist_ok=True)
        row = {
            "time": int(time.time()),
            "method": self.command,
            "path": urlsplit(self.path).path,
            "header_names": sorted(name.lower() for name in self.headers),
            "body_bytes": len(body),
            "body_sha256": hashlib.sha256(body).hexdigest(),
        }
        if body:
            try:
                row["decoded_body"] = decode_request(body)
            except (ValueError, zlib.error, json.JSONDecodeError):
                pass
        with self.server.log_lock:
            with (WORK / "requests.jsonl").open("a", encoding="utf-8") as log:
                log.write(json.dumps(row, separators=(",", ":")) + "\n")
        print(json.dumps({key: value for key, value in row.items() if key != "decoded_body"}), flush=True)

    def do_HEAD(self) -> None:
        self.serve_file(head_only=True)

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path in ("/health", "/storage/eu/status.json"):
            body = b'{"status":"ok"}\n' if path == "/health" else b'{"code":0}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/auth/x_uid":
            self.record(b"")
            body = b'{"result":"OK","x_uid":"danmemore-local","x_app_id":"danmemore"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/moderate/keywordlist":
            self.record(b"")
            body = (
                b'{"result":"OK","entry":{"timestamp":"0","keywords":['
                b'{"id":0,"type":0,"rank":0,"keyword":"__danmemore_never_match__"}]}}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/payment/balance":
            self.record(b"")
            body = b'{"result":"OK","entry":{"balance_charge_gem":0,"balance_free_gem":0,"balance_total_gem":0}}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.serve_file(head_only=False)

    def serve_file(self, *, head_only: bool) -> None:
        path = content_path(self.path)
        if path and path.is_file():
            size = path.stat().st_size
            try:
                start, end, partial = byte_range(self.headers.get("Range"), size)
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            if not head_only:
                with path.open("rb") as source:
                    source.seek(start)
                    remaining = end - start + 1
                    while remaining:
                        chunk = source.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            return
        self.record(b"")
        self.unknown()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > 64 * 1024 * 1024:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        path = urlsplit(self.path).path
        if path.startswith("/telemetry/"):
            body = b"{}\n"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.record(body)
        if path == "/billing/v1.0/auth/authorize":
            body = b'{"result":"OK"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/billing/v1.0/auth/initialize":
            body = b'{"result":"OK","uuid":"00000000-0000-0000-0000-000000000001"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if action := api_action(self.path):
            self.serve_api(action, body)
            return
        self.unknown()

    def serve_api(self, action: str, request_body: bytes) -> None:
        with self.server.state_lock:
            content_type, body = api_response(action, request_body, self.server.user_data)
            if action == "user_data/push":
                save_user_data_state(self.server.user_data)
        now = str(int(time.time()))
        request_id = self.headers.get("X-ARGO-REQUEST-ID", "0")
        sequence = self.headers.get("X-ARGO-REQUEST-SEQUENCE", "0")
        body_hash = self.headers.get(
            "X-ARGO-REQUEST-BODY-HASH", hashlib.md5(request_body).hexdigest()
        )
        self.send_response(200)
        for name, value in {
            "Content-Type": content_type,
            "Content-Length": str(len(body)),
            "Cache-Control": "no-store",
            "X-ARGO-ENCRYPTION": "0",
            "X-ARGO-REQUEST-ID": request_id,
            "X-ARGO-REQUEST-SEQUENCE": sequence,
            "X-ARGO-REQUEST-BODY-HASH": body_hash,
            "X-ARGO-ONE-TIME-TOKEN": LOCAL_TOKEN,
            "X-ARGO-USER": str(LOCAL_USER_ID),
            "X-ARGO-SERVER-RESPONSE-CODE": "0",
            "X-ARGO-SERVER-TIMESTAMP": now,
            "X-ARGO-ACCEPT-TIMESTAMP": now,
            "X-ARGO-SERVER-VERSION": "DanMemoRe/1",
        }.items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def unknown(self) -> None:
        body = b'{"error":"unimplemented local route"}\n'
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("SERVER-TIMESTAMP", str(int(time.time())))
        self.send_header("SERVER-VERSION", "0")
        self.send_header("SERVER-RESPONSE-CODE", "503")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def serve() -> None:
    if not CONTENTS.is_dir():
        raise FileNotFoundError(f"Extracted contents not found: {CONTENTS}")
    subprocess.run(
        ["node", str(ROOT / "tools/danmemore_server.cjs"), str(SQLITE_STATE), str(CONTENTS)],
        check=True,
    )


def install() -> None:
    if not OUTPUT_APK.is_file():
        raise FileNotFoundError("Build the offline APK first")
    *_, adb = find_android_tools()
    lines = run([adb, "devices"]).splitlines()[1:]
    devices = [line.split()[0] for line in lines if line.strip().endswith("\tdevice")]
    if len(devices) != 1:
        raise RuntimeError(f"Expected one running Android device, found {devices or 'none'}")
    serial = devices[0]
    run([adb, "-s", serial, "reverse", f"tcp:{PORT}", f"tcp:{PORT}"])
    abis = run([adb, "-s", serial, "shell", "getprop", "ro.product.cpu.abilist"])
    arm64_apks = [ARM64_OUTPUT / name for name in ARM64_APKS]
    if "arm64-v8a" in abis and all(path.is_file() for path in arm64_apks):
        command = [adb, "-s", serial, "install-multiple", "-r", *arm64_apks]
    else:
        command = [adb, "-s", serial, "install", "-r", OUTPUT_APK]
    print(run(command).strip())
    run([adb, "-s", serial, "shell", "am", "force-stop", PRIVATE_PACKAGE])
    print(
        run(
            [
                adb,
                "-s",
                serial,
                "shell",
                "am",
                "start",
                "-n",
                f"{PRIVATE_PACKAGE}/net.wrightflyer.toybox.AppActivity",
            ]
        ).strip()
    )


def stream_tar(adb: Path, serial: str, tar: str, source: Path,
               remote: str, members: list[str]) -> None:
    producer = subprocess.Popen(
            [tar, "-cf", "-", "-C", str(source), *members],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    assert producer.stdout is not None
    consumer = subprocess.run(
            [adb, "-s", serial, "exec-in", "tar", "-xf", "-", "-C", remote],
            stdin=producer.stdout,
            capture_output=True,
        )
    producer.stdout.close()
    tar_error = producer.stderr.read().decode(errors="replace") if producer.stderr else ""
    tar_status = producer.wait()
    if tar_status or consumer.returncode:
        adb_error = (consumer.stdout + consumer.stderr).decode(errors="replace")
        raise RuntimeError((tar_error + adb_error)[-4000:])


def preseed() -> None:
    missing = [name for name in CONTENT_ROOTS if not (CONTENTS / name).is_dir()]
    missing += [f"{phase}/project.manifest" for phase in "12345678"
                if not (CONTENTS / phase / "project.manifest").is_file()]
    if missing:
        raise FileNotFoundError("Archive is incomplete: " + ", ".join(missing))
    tar = shutil.which("tar")
    if not tar:
        raise FileNotFoundError("tar is required to stream the archive to Android")
    *_, adb = find_android_tools()
    lines = run([adb, "devices"]).splitlines()[1:]
    devices = [line.split()[0] for line in lines if line.strip().endswith("\tdevice")]
    if len(devices) != 1:
        raise RuntimeError(f"Expected one running Android device, found {devices or 'none'}")
    serial = devices[0]
    if run([adb, "-s", serial, "shell", "id", "-u"]).strip() != "0":
        raise RuntimeError("Preseeding private app data requires a rooted emulator")
    owner = run(
        [adb, "-s", serial, "shell", "stat", "-c", "%u:%g", f"/data/data/{PRIVATE_PACKAGE}"]
    ).strip()
    run([adb, "-s", serial, "shell", "am", "force-stop", PRIVATE_PACKAGE])
    run([adb, "-s", serial, "shell", "mkdir", "-p", DEVICE_CONTENTS])
    for name in CONTENT_ROOTS:
        print(f"Preseeding {name}...", flush=True)
        if name == "voice_root":
            source = CONTENTS / name
            remote = f"{DEVICE_CONTENTS}/{name}"
            run([adb, "-s", serial, "shell", "mkdir", "-p", remote])
            stream_tar(adb, serial, tar, source, remote, ["cache"])
            episodes = sorted((source / "files/sound/voice_episode").iterdir())
            for at in range(0, len(episodes), 8):
                batch = episodes[at : at + 8]
                print(f"  voice episodes {at + 1}-{at + len(batch)} of {len(episodes)}", flush=True)
                members = [path.relative_to(source).as_posix() for path in batch]
                stream_tar(adb, serial, tar, source, remote, members)
        else:
            stream_tar(adb, serial, tar, CONTENTS, DEVICE_CONTENTS, [name])
        run([adb, "-s", serial, "shell", "chown", "-R", owner, f"{DEVICE_CONTENTS}/{name}"])
        run([adb, "-s", serial, "shell", "restorecon", "-RF", f"{DEVICE_CONTENTS}/{name}"])
    for source, name in (
        (ROOT / "data/manifests/resources/gacha/lottery.enc", "lottery.enc"),
        (ROOT / "data/manifests/resources/gacha/lotteryPickup.enc", "lotteryPickup.enc"),
        (ROOT / "data/manifests/resources/shop/shopProduct.enc", "shopProduct.enc"),
    ):
        target = f"{DEVICE_CONTENTS}/1/master/divide_enc/{name}"
        run([adb, "-s", serial, "push", source, target])
        run([adb, "-s", serial, "shell", "chown", owner, target])
        run([adb, "-s", serial, "shell", "restorecon", "-F", target])
    banner_source = ROOT / "data/manifests/resources/gacha/background"
    banner_target = f"{DEVICE_CONTENTS}/3/files/lottery/background"
    stream_tar(adb, serial, tar, banner_source, banner_target, ["."])
    run([adb, "-s", serial, "shell", "chown", "-R", owner, banner_target])
    run([adb, "-s", serial, "shell", "restorecon", "-RF", banner_target])
    for phase in ("1", "3"):
        restored_manifest = ROOT / f"data/manifests/project.manifest.{phase}"
        target = f"{DEVICE_CONTENTS}/{phase}/project.manifest"
        run([adb, "-s", serial, "push", restored_manifest, target])
        run([adb, "-s", serial, "shell", "chown", owner, target])
        run([adb, "-s", serial, "shell", "restorecon", "-F", target])
    stale = [f"{DEVICE_CONTENTS}/{phase}/project.manifest.temp" for phase in "12345678"]
    run([adb, "-s", serial, "shell", "rm", "-f", *stale])
    for phase in "12345678":
        local = sha256(ROOT / f"data/manifests/project.manifest.{phase}" if phase in ("1", "3") else CONTENTS / phase / "project.manifest")
        remote = run(
            [adb, "-s", serial, "shell", "sha256sum", f"{DEVICE_CONTENTS}/{phase}/project.manifest"]
        ).split()[0]
        if local != remote:
            raise RuntimeError(f"Phase {phase} manifest did not copy correctly")
    repair_voice_cache()
    print("PASS: complete archive preseeded and all phase manifests verified")


def repair_voice_cache() -> None:
    from repair_voice_cache import repair
    *_, adb = find_android_tools()
    devices = [line.split()[0] for line in run([adb, "devices"]).splitlines()[1:]
               if line.strip().endswith("\tdevice")]
    if len(devices) != 1:
        raise RuntimeError(f"Expected one running Android device, found {devices or 'none'}")
    repair(ROOT, adb, devices[0], run)


def self_test() -> None:
    run(["node", ROOT / "tools/test_danmemore_server.cjs"])
    assert decode_request(bytes.fromhex("038fa77da124ee456d20737612890393")) == {}
    assert patch_c_string(b"before-old-after", b"old", b"x") == b"before-x\0\0-after"
    assert patch_c_string(b"before-old-after", b"old", b"new") == b"before-new-after"
    assert content_path("/content/1/version.manifest") == (CONTENTS / "1/version.manifest").resolve()
    assert content_path("/api/asset/manifest/old/us/pkm/version.manifest.1") == CONTENTS / "1/version.manifest"
    assert content_path("/content/manifests/us/pkm/project.manifest.1/old").is_file()
    assert byte_range("bytes=3-5", 10) == (3, 5, True)
    assert byte_range("bytes=3-", 10) == (3, 9, True)
    assert content_path("/content/../README.md") is None
    assert api_action("/api/game_client/user/login") == "user/login"
    assert api_action("/api/not-implemented") is None
    content_type, body = api_response("user/login")
    assert content_type == "application/json"
    assert json.loads(body)["game_user_id"] == LOCAL_USER_ID
    body = pull_response({"tables": ["UserCommunicationCharacter"]})
    assert b"UserCommunicationCharacter" in body
    assert bytes.fromhex("a6757365724964ce3b9aca01") in body
    assert bytes.fromhex("a9636f7374756d654964ce3ceae4f8") in body
    body = pull_response({"tables": ["UserGift", "UserNotice"]})
    assert b"UserGift\x90" in body and b"UserNotice\x90" in body
    assert b"UserCommunicationCharacter" not in body
    push = push_response(
        {
            "checksums": {"after": {"UserProfile": "new-token"}},
            "deltas": [
                {
                    "trigger": "UserRegistration",
                    "putItems": {"UserProfile": [{"name": "Player"}]},
                    "deleteItems": {},
                }
            ],
        }
    )
    assert push["dataTokens"] == {"UserProfile": "new-token"}
    assert push["putItems"] == {"UserProfile": 1}
    assert push["data"] == {}
    state = {"data": {}, "dataTokens": {}}
    party = {
        "id": 1,
        "userId": LOCAL_USER_ID,
        "slots": [{"slotNumber": 1, "pcId": 1011001001}],
    }
    push_response(
        {
            "checksums": {"after": {"UserParty": "party-token"}},
            "deltas": [
                {
                    "trigger": "AdventureEnter",
                    "putItems": {"UserParty": [party]},
                    "deleteItems": {},
                }
            ],
        },
        state,
    )
    assert state == {
        "data": {"UserParty": [party]},
        "dataTokens": {"UserParty": "party-token"},
    }
    assert ensure_starter_pc(state)
    assert not ensure_starter_pc(state)
    assert state["data"]["UserPC"][0]["pcId"] == STARTER_PC_ID
    state["data"]["UserInfo"] = [{"position": {"areaId": 511011004}}]
    assert ensure_starting_area(state)
    assert not ensure_starting_area(state)
    assert state["data"]["UserArea"] == [
        {
            "areaId": 511011004,
            "encountCount": 0,
            "lineBlockDwords": [0] * 8,
            "userId": LOCAL_USER_ID,
        }
    ]
    body = pull_response({"tables": ["UserParty"]}, state)
    assert b"UserParty" in body and b"pcId" in body and msgpack(1011001001) in body
    with zipfile.ZipFile(SOURCE_APK) as archive:
        manifest = patch_manifest(archive.read("AndroidManifest.xml"))
        services = patch_service_dependencies(archive.read("classes3.dex"))
    assert PRIVATE_PACKAGE.encode("utf-16le") in manifest
    assert ORIGINAL_PACKAGE.encode("utf-16le") not in manifest
    assert bytes.fromhex("290073016e10b40b0200") in services
    assert services[0x0DF324 : 0x0DF336] == bytes.fromhex("2200740370109c0d00007220ba2304000e00")
    assert services[0x0D96C2 : 0x0D96C6] == bytes(4)
    assert services[0x0DE980 : 0x0DE984] == bytes(4)
    assert services[0x0DFEEC : 0x0DFEF6] == bytes.fromhex("12007220ba2306000e00")
    if ARM64_XAPK.is_file():
        with zipfile.ZipFile(ARM64_XAPK) as bundle:
            split = bundle.read("config.arm64_v8a.apk")
        with zipfile.ZipFile(io.BytesIO(split)) as archive:
            native = patch_native_client(archive.read("lib/arm64-v8a/libapp.so"), "arm64-v8a")
        assert native[0x24ABD70 : 0x24ABD74] == bytes.fromhex("21008052")
        assert native[0x2036AC4 : 0x2036ACC] == struct.pack("<2I", 0x910C83E0, 0x91004281)
        assert native[0x2036AD4 : 0x2036AEC] == bytes.fromhex("1f2003d5") * 6
        assert native[0x25D0300 : 0x25D0304] == bytes.fromhex("e10316aa")
        assert native[0x286ED64 : 0x286ED68] == bytes.fromhex("60010054")
    xml_chunks(manifest)
    print("PASS: APK isolation, safe paths, and static-derived plaintext bootstrap")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "serve", "install", "preseed", "repair-voice-cache", "self-test"))
    command = parser.parse_args().command
    {"build": build, "serve": serve, "install": install, "preseed": preseed,
     "repair-voice-cache": repair_voice_cache, "self-test": self_test}[command]()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        raise SystemExit(f"error: {error}") from None
