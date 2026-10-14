"""Check direct and indirect gameplay-route inventory against the local frozen client."""
from pathlib import Path
import hashlib
import json
import struct

from inventory_client_routes import contracts, inventory, route_addresses, sections, stage_dispatch_routes

root = Path(__file__).resolve().parents[1]
pooled = route_addresses(b"ad/scratch/draw\0", 100, ["ad/scratch/draw"])
assert pooled[100] == "ad/scratch/draw" and pooled[103] == "scratch/draw"
assert "draw" not in pooled.values(), "A bare word is not a route"
pooled = route_addresses(b"under_pvp/player_info/get\0", 100, ["under_pvp/player_info/get"])
assert pooled[100] == "under_pvp/player_info/get" and pooled[106] == "pvp/player_info/get"
binary = root / ".work/arm64-original/lib/arm64-v8a/libapp.so"
blob = binary.read_bytes()
table = sections(blob)
dispatch = {row["route"]: row for row in stage_dispatch_routes(blob, table)}
expected = {
    "pve/stage/complete": [12], "pvb/stage/complete": [15], "gve/stage/complete": [19],
    "guild_event/stage/complete": [20], "guild_raid/stage/complete": [22],
    "element_event/stage/complete": [26, 27], "union_raid/stage/complete": [28],
    "adventure/stage/complete": [13, 14, 16, 17, 18, 21, 23, 24, 25],
}
assert {name: row["adventureTypes"] for name, row in dispatch.items()} == expected
references = inventory(binary, root / ".work/api-route-candidates.txt")
merged = contracts(references)
for route, adventure_types in expected.items():
    assert "json" in merged[route]["modes"]
    assert (0x2472BEC, 0x2473704) in merged[route]["wrappers"]
    assert merged[route]["stageDispatch"] == {"table": 0x42B5558, "xref": 0x24731B4, "adventureTypes": adventure_types}
assert "stageDispatch" not in merged["tutorial/draw"]
assert len(merged["adventure/stage/complete"]["wrappers"]) == 2, "Direct/table references share one wrapper"
assert (0x24BE47C, 0x24BE8BC) in merged["scratch/draw"]["wrappers"]
assert "json" in merged["scratch/draw"]["modes"]
assert {"scratchId", "position"} <= set(merged["scratch/draw"]["strings"])
assert any(row["route"] == "scratch/draw" and row["string"] == 0x352BC48 for row in references)
assert "json" in merged["familia/get"]["modes"]
assert (0x1B3AADC, 0x1B3AD7C) in merged["familia/get"]["wrappers"]
assert "familiaId" in merged["familia/get"]["strings"]
war_game = {
    "pvp/battle/start": (0x19342CC, 0x193451C),
    "pvp/battle/restart": (0x2140D68, 0x2141210),
    "pvp/battle/end": (0x2214DF4, 0x22156B4),
    "pvp/summary/get": (0x259DC04, 0x259DF90),
    "pvp/player_info/get": (0x25657F4, 0x2565E24),
    "pvp/character/ranking/get": (0x1C5E498, 0x1C5E7F4),
}
for route, wrapper in war_game.items():
    assert wrapper in merged[route]["wrappers"], route
    assert "json" in merged[route]["modes"], route
    assert "pvpId" in merged[route]["strings"], route
assert "targetUserId" in merged["pvp/player_info/get"]["strings"]
assert len(merged) == 171
artifact = json.loads((root / "data/danmemore-client-contracts.json").read_text())
assert artifact["clientVersion"] == "15.1.0"
assert artifact["nativeSha256"] == hashlib.sha256(blob).hexdigest()
assert json.loads(json.dumps(merged)) == artifact["routes"]

# Fail closed on a changed switch or missing relocation, rather than silently
# shrinking coverage or assigning another build's adventure types to these routes.
changed = bytearray(blob)
raw = table[".text"]["offset"] + 0x24731A0 - table[".text"]["address"]
struct.pack_into("<I", changed, raw, 0)
for candidate, candidate_table in [(changed, table), (blob, {**table, ".rela.dyn": {"offset": 0, "size": 0}})]:
    try:
        stage_dispatch_routes(candidate, candidate_table)
    except ValueError:
        pass
    else:
        raise AssertionError("Invalid stage dispatch was accepted")
print("Native stage dispatch, pooled route suffixes, merged contracts, and changed-client rejection: OK")
