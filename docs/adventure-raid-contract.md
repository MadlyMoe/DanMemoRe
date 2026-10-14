# Adventure raid status contract

Status: **SOURCE ONLY / PARTIAL / UNTESTED**. Nothing in this document is native acceptance.

The two final-client wrappers at raw `0x19bb424` and `0x2175c28` send exactly
`{raidGroupId}`. Their response callbacks at raw `0x19c3474` and `0x218ff74`
share one parser: root `raidGroupId`, then `parts[]` rows containing `id`,
`lastUpdatedAt`, `hp`, `damage`, and `completedAt`. The client calculates
remaining HP from authored HP and cumulative damage; those fields are not an
ordinary stage-clear count.

The final archive contains one Adventure raid, five phase groups, seven parts,
and 45 part/stage links. The decoder and consolidated master export all four
original tables and check every group, part, and type-17 stage join. The server
retains the same hash-labelled fallback for older generated masters; it does not
read the protected asset config. A partially regenerated four-table catalog is
rejected instead of being mixed with fallback rows. Every one of the 45 link
IDs, its part, its type-17 stage, and its preserved numeric fields is validated.

`raid/status` accepts only the exact group request during that group's original
window. On first read it writes one SQLite row per original part with authored
HP, zero cumulative damage, the group start as `lastUpdatedAt`, and no fabricated
completion timestamp. Later reads and cached replies must match the same source
hash and durable rows. Corrupt, changed, missing, or expired status returns the
offline recovery error without repairing or deleting history. Native profile,
inventory, currency, operation queues, and save tables are not changed.

The status source hash now binds the exact linked stage rows as well as the raid,
group, and full part rows. A pristine zero-damage snapshot written by the earlier
source-only handler is migrated in place on a fresh request; an exact cached read
may still return that identical pristine representation before migration. Any
legacy-hash row with damage, a completion time, or a changed timestamp is retained
and rejected rather than being relabelled. Deferred cases cover both migration
paths, partial-catalog refusal, and the non-pristine retention boundary.

The recovered final-client completion builder at raw `0x217d504..0x217d5b8`
looks up the matching `adventureRaidPartStage` row, writes
`adventureRecord.isRaid=true`, and writes `adventureRecord.raidDamage` from that
row's fifth numeric slot. Type-17 completion now admits exactly that Boolean and
requires the damage to equal the original linked value. The selected group comes
from the saved `UserAdventureRaid.playGroupId` when present, then the most recent
validated `raid/status` group, and finally a unique stage/group join. Conflicting
or ambiguous selection is rejected rather than credited to another phase.

The contribution is captured with operation 5000 and its exact pre-damage row.
It is applied once, capped at authored part HP, only in the same SQLite
transaction that validates and acknowledges the native stage save. Failed,
partial, or interrupted saves leave both the operation and contribution pending;
replay cannot add damage twice. `lastUpdatedAt` advances monotonically and
`completedAt` is set only when the capped total reaches HP. The status callback
therefore receives durable cumulative damage after the acknowledged save.

Phase transition/reset, raid-specific rewards and settlement, peer aggregation,
and recovery of unknown publisher-era partial raid history remain unsupported.
The deferred checks must cover the newly recovered Boolean request shape, exact
slot-five damage, group binding, cap/completion, split save/ACK, restart,
rollback, replay, and rejection of ambiguous or changed baselines. They have not
been run.
