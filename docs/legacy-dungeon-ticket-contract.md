# Legacy dungeon-ticket purchase

SOURCE ONLY / PARTIAL / UNTESTED. The final client retained the old
`dungeon/ticket/issue` wrapper but the final archive did not retain a dedicated
price/allocation catalog. DanMemoRe therefore implements an explicitly disclosed
offline restoration, not recovered publisher billing parity:

- The exact request is `{id}` with one positive signed-int32 dungeon/gate ID.
- One request authorizes one opaque legacy gate and returns operation `3000`
  with its original empty parameter object.
- The price is the surviving authored `gamelibConsume` row `81021001`
  (`CONSUME_BATTLE_CONTINUE`, 10 Iris). This is an offline mapping because no
  original legacy dungeon-ticket price survived.
- Existing wallet rules spend free Iris first and paid Iris second and append
  the change to `iris_transaction` in the same SQLite transaction.
- `dungeon_ticket_issue` permanently binds operation, dungeon ID, price and
  amount. `dungeon_ticket_request` binds every request identity and body hash
  to that operation. A retry cannot charge again or change the requested ID.
- Only one `3000` issue may be pending. A new request for the same ID aliases
  the retained issue; another ID is refused until the first issue is ACKed.
- Hot responses expose singular `operation` and retain plural `operations` for
  cold recovery. Login/confirm delivery and ACK require the permanent issue and
  request receipts.
- Startup archives and removes only an exact old DanMemoRe-generated fake
  `dungeon/ticket/issue` success, including every cached JSON envelope that
  contains it. Unknown publisher/legacy `3000` entries remain queued and
  unavailable instead of being guessed or discarded.
- ACK moves the operation to the normal done ledger without inventing a client
  inventory table. Retained request identities then refuse stale redelivery.

Original client evidence:

- `.work/dungeon-revive-wrappers-20261004.txt`: `25da884:25dabb8`
  constructs `{id}` for the old `DomainGemRepository` path. It supplies no
  quantity or price.
- `.work/dungeon-revive-callbacks-20261004.txt`: `25df224` refreshes Gem state
  and invokes its captured status callback rather than reading an allocation.
- `.work/legacy-battle-ticket-exact-20261006.txt`: operation `3000` handler
  `25dabb8` is return-only. The empty acknowledgement is therefore the native
  success contract, but not evidence of a separate persistent ticket object.
- The final `gamelibConsume` export has nine rows. All surviving recovery
  consumes cost 10 Iris; none names the removed legacy dungeon-ticket product.
- `.work/dungeon-packet-refs-20261007.txt` found no direct caller for the old
  wrapper/vtables. Compressed or dynamic dispatch is still possible.
- The `DUNGEON_MAP_BUY_TICKET` string reaches the generic analytics-name
  switch, not a recovered purchase catalog.
- Preserved ARM64 relocation entries retain callback `25df224` and handler
  `25dabb8`, but not a wrapper caller.
- Final `ticket.enc`, `ticketItem.enc`, `adventureTicket.enc` and
  `shopProduct` data describe subscription stamina and other orb/shop products;
  none joins wrapper `{id}` to a legacy dungeon price. DanMemoRe does not
  substitute `UserAdventureTicket` or Another Eden semantics.

Deferred source fixtures now cover a successful debit/receipt, hot/cold shape,
exact and aliased retry without a second charge, ACK settlement, stale retry,
malformed signed-int32 bodies, unreceipted queue refusal and generic recovery
preservation, plus exact fake-success archival while a receipt-backed issue
survives restart. They are WRITTEN ONLY / NONE RUN.

Current classification becomes 126 partial / 49 unsupported across 175 tracked
routes. The remaining unsupported routes are the co-op/peer-dependent group,
which remains last. No test, syntax/static check, generator, build, APK,
listener, emulator, ADB, worker or GitHub Action was run for this change.
