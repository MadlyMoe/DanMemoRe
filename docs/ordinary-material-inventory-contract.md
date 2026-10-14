# Ordinary material inventory — source-only follow-up

PARTIAL / UNTESTED. This tightens existing shared reward/save branches; it is not completion of character enhancement, CP gifts, status boards, crafting or any route. No tests, syntax/static acceptance checks, generators, builds, listeners or emulator checks ran. No actual save or schema was changed.

## Original client evidence

The pristine ARM64 `libapp.so` readers consume exactly seven fields: `userId`, the native item ID below, `amount`, `reservedAmount`, `bookEntryState`, `signature`, and `cumulativeAmount`.

| Saved table | Native ID | JSON reader | Book setter | Signature setter | Original IDs |
| --- | --- | --- | --- | --- | --- |
| UserExpItem | expItemId | 26467e0..2646abc | 2645724 | 2645808 | 3 |
| UserCpItem | cpItemId | 2804d50..280502c | 283fea8 | 283ff8c | 57 |
| UserStatusBoardItem | statusBoardItemId | 26308a8..2630b84 | 262f70c | 262f8d0 | 19 |
| UserEquipmentMaterial | equipmentMaterialId | 2804110..28043ec | 283d524 | 283d608 | 140 |

All four book setters use the protected UInt8 helpers `28bd92c/28bda24/22e6718`, mask with `0xff`, and compare with `uxtb`. All four signature setters use protected UInt32 helpers `28bab7c/28bac48/1e99d08` and compare the full incoming `w21`; they do not narrow signatures to a byte. This establishes storage widths, not which book states gameplay naturally produces.

The domain vtable address points are EXP `42b4020`, CP `42b1040`, status board `42aa688`, and crafting material `42bd360`. Each has common gain `24d8844` at slot `0x50`, maximum `24d8d6c` at `0x88`, and lifetime gain `24d8d94` at `0xb0`. These are address points, not the ABI vtable starts sixteen bytes earlier. Existing original stock/lifetime cap handling is reused, not a new reward implementation or publisher cap policy.

All 219 original profiles are already exported in `data/danmemore-master.json`. No master table was regenerated. Its recorded original `1/master/divide_enc/` source hashes are:

- `expItem.enc`: `1f07e8ea3cea7e98203d1cf549d38014e083e9a66a0e442beb6018a0e05e59d3`
- `cpItem.enc`: `9a49d1b0b8c56ebbdf96f7fd4d0c7a54d8728f5c22ccf07c038902633e0a9d6f`
- `statusBoardItem.enc`: `fbc995fcf6de9a2cb3249ea5c9cf31b50c9990449e1decfafe39965c2aa706ab`
- `equipmentMaterial.enc`: `4e7cbcecdb229e755897f9619b930c0c88eaa104439567c38d370d17069bea98`

## Source changes and retained saves

`validItemInventory` reuses the existing seven-field native stock validator for all four families. Original positive ID and owner, nonnegative bounded reserved amount, UInt8 book and full UInt32 signature are required alongside existing stock/lifetime rules. Alias IDs, timestamps, reset dates and ticket date lists are not fields of these classes and are not synthesized.

The shared saved-table read rejects unreadable JSON and malformed/duplicate/unknown original rows with the existing structured unavailable recovery path (`503`); it retains the data. The shared `user_data/push` branch rejects malformed proposed rows (`400`) before the existing atomic save, and refuses a malformed retained baseline (`503`). No missing fields, stock or signatures are silently repaired; no new stock ledger, source issuer or precredit is added. Empty inventories remain valid. Existing reward captures, spending allowances, operation ACKs, retries and completed checkpoints remain in place. JSON parse errors for unrelated table classes retain their existing handling; this is not a global recovery-completion claim.

The stricter validator affects Present, mission, shop, stage, Element, PVE, friendship, dispatch and event-box synthetic fixtures. Their ordinary rows now retain the native reserved/book/signature fields; status-board fixtures no longer add a nonexistent reset timestamp. Malformed retained read expectations use unavailable instead of a new-request rejection. This is fixture maintenance, not execution or native acceptance.

## Deferred acceptance and remaining work

`tools/test_ordinary_material_inventory.cjs` is WRITTEN ONLY / NOT RUN. Four family fixtures cover all 219 original IDs, thirty-two first/last-ID book/signature boundary saves, malformed/missing/extra fields, foreign IDs, duplicate rows, full transaction snapshots, cold retention and rollback definitions. Existing generic cap scenarios now retain the native fields and exercise book255 for these families. All synthetic stock/funding/signing/order assumptions remain explicit; these do not prove naturally earned items or original constructor defaults.

Individual character/CP/board/crafting cost application, reserved-stock interpretation, other constructors/producers, coalesced/legacy save order and native signing/UI/clock/recovery/performance/no-crash/no-freeze acceptance remain unfinished or unverified. Inventory field validation is not implementation of those missing gameplay semantics. Current coverage stays 125 partial / 50 unsupported; all original 149 packets and their variants must be implemented before the consolidated server/emulator pass. Co-op remains last.
