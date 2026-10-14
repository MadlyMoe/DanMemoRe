# Offline Iris purchase history

Source implementation only. No checks, builds, installations, listener restarts or emulator interaction were performed for this change. Testing is deferred until all packets are implemented, as requested; co-op remains last.

## Gameplay wallet-history follow-up (2026-10-07, NOT RUN)

This source revision extends the purchase-only view described below. Original `Transaction.smali` and `TransactionHistory.smali` were read directly: consumption1, paid-Iris purchase2, free issuance3, typed dates/reasons/signed paid-free deltas and pagination are required. Optional prices/expiration fields do not justify invented publisher prices or expiry.

All currently implemented wallet writers now reuse `changeIrisBalances` and the existing nested request transaction. One indexed `iris_transaction` row captures the actual before/after free and paid balances, event-clock time, explicit local reason and optional original local purchase key. Credits, paid-only spending and ordinary free-first spending retain their existing amounts/caps/eligibility; a debit crossing both buckets is one journal entry, not two. No-op zero changes create no entry. Standalone helper calls also wrap wallet plus journal atomically; failure propagates so the outer request rolls back its queue/source receipt/sequence/reply too.

Current sources include stage/Record Buster, expedition, Presents, missions, CP, dress-point, video-ad and scratch rewards; gacha, shop, ability-panel and continuation/stamina consumes; and existing explicit launcher credits. These are labels for **actual offline listener changes**, not recovered publisher strings or proof that every reward source is implemented. Launcher paid credits use the SDK paid-credit category with an explicit local-grant reason and zero offline price; they are not real-money purchases. No purchase authentication or entitlement policy changed.

Iris purchases now write their original paid and bonus-free credit together, with one captured timestamp shared by journal and permanent `billing_purchase`. Request-token/byte-hash retries still return the original order without crediting or journaling twice. The existing purchase validator also checks journal-linked quantities, date and local reason during history reads.

`GET /billing/v1.0/payment/history` pages two indexed streams: authoritative purchase receipts and nonpurchase wallet transactions. A nullable `billing_purchase.history_id` links new purchases to their exact journal entry; old known receipts remain visible without inventing before/after balances. The partial nonpurchase-history index excludes purchase journals, avoiding both duplicate entries and a lifetime anti-join/deduplication scan. New same-second entries use recorded journal order; older receipts retain their purchase-ID tie-break. The view never backfills unknown pre-upgrade spending/earnings or invents balance-derived history. Backward event-clock changes do not rewrite or discard recorded entries. Returned rows and one-row lookahead validate native fields, amount bounds, delta signs/type and actual purchase receipts; missing/malformed new-purchase journal links remain unavailable, not silently omitted or reclassified as legacy. No publisher data is synthesized.

Extended `test_offline_billing.cjs` is **written but NOT RUN**: new/legacy purchase projection, same-second ordering, no-op handling, standalone and purchase/history rollback, both-bucket and paid-only spending, free credit, malformed/capped changes, journal/receipt corruption, missing/malformed new-purchase links, restart/read-only preservation and an existing Present route's once-only credit. These are future disposable synthetic checks, not native earning/purchase/history-screen acceptance. Repeat gacha/shop/rewards/refills/ability-panel/launcher/save/recovery checks and actual native history UI only after all packets are implemented. The actual player database, installed APK and emulator remain untouched.

## Original client contract

The extracted 15.1.0 SDK `net/gree/gamelib/payment/depositbook/DepositBook.smali` requests history with two Java int parameters. `payment/internal/e0.smali` constructs `/payment/history?offset=...&limit=...`. `TransactionHistory.smali` requires `entry.offset`, `limit`, `has_next` and `transactions`. `cocos2dx/QueryHistoryListener$1.smali` forwards those actual values to the native callback.

`Transaction.smali` requires each row's integer `transaction_type`, string `date` and `reason`, and long `balance_change_charge` / `balance_change_free`. Its constants identify consumption as1, paid-Iris purchase as2 and free-Iris issuance as3. Price, formatted price and expiration strings are optional.

## Earlier purchase-only scope (superseded source revision)

`GET /billing/v1.0/payment/history` now returns actual permanent `billing_purchase` receipts instead of an unconditional empty list. Only completed local Iris purchases are included: type2, their recorded paid/free quantities, recorded event-clock time, zero local price and the existing `Free (Offline)` label. `Offline purchase: ...` and newest-recorded-date-first ordering are explicit local presentation policies, not recovered publisher labels or ordering. The existing ISO billing-date formatter is reused. No publisher expiry is invented.

An index on `(created_at DESC,purchase_id)` supports bounded SQL pagination with one lookahead row. Purchase ID breaks timestamp ties consistently across restarts. All retained receipt dates remain history when the event clock changes; they are not rewritten or discarded as future entries. The view does not change wallets, native tables, signatures, queued operations, game sequence or receipts, and cannot issue purchases or rewards.

Each returned or lookahead receipt must match the existing local product, request-token/product identity, deterministic purchase ID, recorded original paid/free quantities, valid timestamp/hash and exact saved response. Corrupt or unknown records remain intact and return the existing unavailable billing error, not fabricated entries or empty success. The same validator now protects purchase-response retries without crediting another order.

Both Iris and subscription history use the same page validator: nonnegative decimal int32 offset, limit0..1000, defaults0/100, and no duplicate pagination parameters. Limit1000 is an explicit offline safety bound. Limit0 returns no entries with `has_next:false`, avoiding a non-advancing paging loop; this is a local policy, not proof of publisher behavior.

This is **partial purchase-history support**, not an exhaustive Iris transaction ledger. Shop/gacha/continue debits, earned free Iris, launcher grants, publisher payment history and their precise historical reasons are not synthesized from current balances. Subscription activations retain their separate native `subscriptions` history route. Native date/label formatting, history UI, back navigation and performance remain unverified.

## Deferred checks

Extended `tools/test_offline_billing.cjs` is written but **NOT RUN**. It covers all six local products, atomic failed-purchase exclusion, once-only retries, tied-date ordering, pages/lookahead/empty/zero-limit reads, shared malformed/int32/duplicate query rejection, read-only save/wallet/queue/receipt preservation, corrupt receipt and replay rejection without credit, and identical history after restart. Run it with the subscription, save/recovery and launcher checks only after implementation is finished, then verify the actual history screen and native callback behavior. No full packet, shop or game-completion claim is made.
