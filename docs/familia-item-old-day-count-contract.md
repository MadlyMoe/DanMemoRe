# Familia item count saved with an older or zero timestamp

SOURCE ONLY / PARTIAL / UNTESTED. A modern22200 donation may save its
new count while the item timestamp still belongs to an older JST day or
is zero on a first-time donation.
The original callback's date-aware getter returns zero on replay,
resetting an old-day row when present, then the count setter writes the positive donation
quantity again. With no nested getter row it returns zero directly.
Skipping the count setter as in the same-day branch would erase the
saved count or skip first-time initialization. Read-only evidence is in
`.work/familia-item-old-day-count-original-20261010.txt`.

Cold replay requires the original positive queued item, item cap,
contribution, token/signature and current owned Familia. Modern private
count must equal the actual positive donation amount, visibly changed
from the captured before count; private date remains null and version
unchanged. The actual timestamp must equal the before timestamp,
which must be zero or belong to an earlier day. The issued target is
exactly the donation amount, not stale before count plus amount.
The current event clock must be in the issue day with a120-second
rollover margin. Payment is either exact untouched stock with retained
charge0 or exact original debit with charge1 and unchanged cumulative.
Ambiguous equal-count, changed-wallet, mixed/coalesced, legacy and
future-day evidence remain guarded.

Unpaid replay uses the original positive `consumedItem` unchanged.
Paid replay derives `amount:0` plus the original positive
`offlineDonationCounterQuantity`; the existing callback leaf then
calls the original helper with that quantity. Neither case carries
`offlineDonationCountApplied`. The source queue retains its positive
amount and no marker. The original getter zero-count path, count setter and
timestamp setter all run; no new native hook is needed.

Only exact original/current cached singular/plural operations and
captured popup are accepted. A later actual date or debit save changes
the derived reply; a stale paid quantity reply refuses, while an
untouched original cache derives the current phase. Login/pull only
validate and hot retry stays guarded. Actual saved debit/count/date
and original token ACK remain separate. Existing atomic receipt,
owned row, queue, completion floor, done and reply path are reused;
there is no prewrite, duplicate Familia contribution/skill credit,
new DDL or fabricated ACK.

`tools/test_familia_donation.cjs` extends the three existing
count-first-old-day contexts and adds paid-progress and unpaid-exhausted
old-day modes, plus unpaid, paid-progress and unpaid-exhausted zero-date
modes for each of the three original Faithstones. Fifteen contexts
are new;93 cold within156 total recovery contexts are written only.
None have been run. The original getter/setter source, native callback
quantity and later date/debit save paths still need acceptance.

Repeated native reset/dirty notifications, actual signing/save order,
subscribers, UI and crash/freeze behavior remain unverified. Earlier
DDL is unapplied, real saves/listener untouched. Other packets and
cross-day boundaries remain; all149 and variants precede consolidated
testing, with peer-dependent systems last.
