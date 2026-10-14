# DanMemoRe working instructions

## Current phase: packet implementation only

The user explicitly requires testing only after all packets are implemented.
This applies across turns and automatic goal continuations; continuing the goal
does not authorize testing early.

- Continue implementing the original packets, discovered variants, and unfinished
  branches. Registered routes, parsers, empty replies, and fake-success responses
  do not count as implemented gameplay.
- Do not run tests, smoke checks, syntax or static acceptance checks, builds,
  APK packaging/signing/installation, listener restarts, or emulator/ADB gameplay
  checks during this phase.
- Reading source, original client code/binary contracts, and original game data
  to implement packets is allowed. Writing deferred test cases and maintaining
  the packet checklist is allowed; do not execute those cases yet.
- Mark new implementation as untested. Keep implementation coverage separate
  from verified gameplay; do not claim stability or feature completion.
- Start the consolidated server and emulator test pass only when implementation
  coverage is complete, unless the user explicitly changes this instruction.

## Existing project constraints

- Co-op and peer-dependent features come last.
- Do not spawn workers or use GitHub Actions.
- Preserve unrelated changes and existing saves. Do not stage, commit, push,
  reset, or clean up unrelated work.
- Keep the large game archive, extracted contents, and `.work` out of Git.
- Never read or launch the protected Adventure5 save `d8924112` dated
  `2022-08-20`.
- Do not read, search, or print `.work/asset-config.json` values.
- Do not read or run the legacy tutorial repair/inspection scripts
  `.work/inspect_master_fields.cjs`, `.work/inspect_master.cjs`,
  `.work/test_repair_tutorial.cjs`, `tools/test_repair_tutorial.cjs`, or
  `tools/repair_tutorial.cjs`.
