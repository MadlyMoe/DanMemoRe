'use strict';

const fs = require('node:fs');
const path = require('node:path');
const lottoPrizeFile = [path.join(__dirname, 'data/danmemore-lotto-prizes.json'),
  path.join(__dirname, '../data/danmemore-lotto-prizes.json')].find(fs.existsSync);
if (!lottoPrizeFile) throw new Error('Original Lotto Orario prize catalog is missing');
const lottoPrizes = require(lottoPrizeFile);

const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const percent = value => `${value.toFixed(6).replace(/\.?0+$/, '')}%`;
const date = (epoch, seconds = false) => epoch ? `${new Date((epoch + 9 * 3600) * 1000).toISOString().slice(0, seconds ? 19 : 16).replace('T', ' ')} JST` : 'No date limit';
const day = epoch => Math.floor((epoch + 9 * 3600) / 86400);

// Match lottery/draw: choose a weight bucket, then uniformly choose a unit.
// Do not normalize incomplete weights into a fictional 100% pool.
function poolRates(master, groupId, lottery, selectedPcIds = null) {
  const buckets = Object.entries(master.lotteryPools[groupId] ?? {}).map(([id, pcs]) =>
    ({ id: Number(id), weight: master.lotteryWeights[id], pcs: [...pcs] }));
  // Select-lineup pools retain 97% in both the ordinary and separate 4-star
  // guaranteed groups. The two original selectable buckets supply the other
  // 3% in each, not only lottery.groupId. Keep draws and Details identical.
  if (selectedPcIds && selectedPcIds.length !== (lottery.selectionGroupIds ?? []).length) return null;
  (lottery.selectionGroupIds ?? []).forEach((id, index) => {
    const weightId = master.selectLineupWeights[id];
    let bucket = buckets.find(row => row.id === weightId);
    if (!bucket) buckets.push(bucket = { id: weightId, weight: master.lotteryWeights[weightId], pcs: [] });
    bucket.pcs.push(selectedPcIds ? selectedPcIds[index] : `choice-${index + 1}`);
  });
  buckets.sort((a, b) => a.id - b.id);
  const missing = buckets.filter(row => row.weight === undefined);
  const derivedWeightIds = [];
  // shortcut: only the two preserved Orgion pools have this exact 98% gap; replace when weight row 174000091 is recovered.
  if ([172003107, 172003108].includes(groupId) && missing.length === 1 &&
      missing[0].id === 174000091 && missing[0].pcs.length === 2 &&
      [1012018004, 1012019001].every(id => missing[0].pcs.includes(id)) &&
      buckets.filter(row => row !== missing[0]).every(row => Number.isSafeInteger(row.weight) && row.weight > 0) &&
      buckets.reduce((sum, row) => sum + (row.weight ?? 0), 0) === 98) {
    missing[0].weight = 2;
    derivedWeightIds.push(174000091);
  }
  // Repeated original lotteryCharacter rows are separate equally sampled slots.
  if (!buckets.length || buckets.some(row => !Number.isSafeInteger(row.weight) || row.weight <= 0 ||
      !row.pcs.length) ||
      buckets.reduce((sum, row) => sum + row.weight, 0) !== 100) return null;
  const rates = new Map();
  for (const bucket of buckets) for (const id of bucket.pcs)
    rates.set(id, (rates.get(id) ?? 0) + bucket.weight / bucket.pcs.length);
  return { buckets, rates, derivedWeightIds };
}

function lotteryGuarantee(master, lottery, button, fixedGroupId, groupId) {
  if (!button.fixedCount || fixedGroupId) return { groupId: fixedGroupId, selected: false };
  const rank = id => master.pcJobRanks?.[master.pcProfiles?.[id]?.jobIds?.[0]];
  const ordinary = Object.values(master.lotteryPools?.[groupId] ?? {}).flat();
  if (button.pickCount === 11 && button.fixedCount === 1 && lottery.selectionGroupIds?.length === 3 &&
      ordinary.length && ordinary.every(pcId => rank(pcId) < 4) &&
      lottery.selectionGroupIds.every(id => master.selectLineupPools?.[id]?.length &&
        master.selectLineupPools[id].every(pcId => rank(pcId) === 4 && master.bonds?.[pcId])))
    return { groupId: 0, selected: true };
  const pool = poolRates(master, groupId, lottery);
  if (!lottery.selectionGroupIds?.length && button.pickCount === 1 && button.fixedCount === 1 &&
      pool?.buckets.every(bucket => bucket.pcs.every(pcId => rank(pcId) === 4)))
    return { groupId, selected: false };
  return null;
}

function scratchDetails(id, scratch) {
  if (!scratch || typeof scratch.name !== 'string' || typeof scratch.description !== 'string' ||
      !Array.isArray(scratch.steps) || !scratch.steps.length ||
      scratch.steps.some((step, index) => step.index !== index + 1 || !Array.isArray(step.contents) ||
        !step.contents.length || step.contents.some(row => !Number.isSafeInteger(row.id) ||
          !Number.isSafeInteger(row.itemId) || row.itemId <= 0 ||
          !Number.isSafeInteger(row.amount) || row.amount <= 0 ||
          typeof row.rewardKey !== 'string' || ![0, 1].includes(row.special)))) return null;
  const rounds = scratch.steps.map(step => `<section><h2>Round ${step.index}</h2><table><thead><tr><th>Archived reward</th><th>Amount</th><th>Cell</th></tr></thead><tbody>${step.contents.map(row =>
    `<tr><td>${escapeHtml(row.rewardKey)} <small>#${row.itemId}</small></td><td>${row.amount}</td><td>${row.special ? 'Special' : 'Ordinary'}</td></tr>`
  ).join('')}</tbody></table></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(scratch.name)} · Scratch Details</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#f9f5ea;color:#27221b;max-width:850px;margin:auto;padding:18px}h1,h2{color:#703e31}section{margin:20px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #cfc4af;padding:8px}small{color:#6d6253}.note{background:#fff;border-left:4px solid #b8874d;padding:12px;white-space:pre-wrap}</style></head><body><h1>${escapeHtml(scratch.name)}</h1><p>Original scratch catalog #${id}</p><p class="note">${escapeHtml(scratch.description)}</p><p>This archived list does not draw a card or claim a reward. Cell probabilities and original publisher reset behavior are not asserted here.</p>${rounds}</body></html>`;
}

function packDetails(id, pack, master) {
  if (!pack || typeof pack.key !== 'string' || !Array.isArray(pack.contents) || !pack.contents.length ||
      pack.contents.some(row => !Number.isSafeInteger(row.type) || !Number.isSafeInteger(row.rewardId) ||
        row.rewardId <= 0 || !Number.isSafeInteger(row.amount) || row.amount <= 0)) return null;
  const listings = Object.entries(master?.shopProducts ?? {}).filter(([, product]) =>
    product.rewardId === id && (product.rewardType === 2 || product.rewardType === 4 && product.priceType === 1));
  if (listings.length !== 1 || listings[0][1].priceType !== 1 || listings[0][1].priceItemId !== 0) return null;
  const [productId, product] = listings[0];
  if (!Number.isSafeInteger(product.price) || product.price <= 0 ||
      !Number.isSafeInteger(product.amount) || product.amount <= 0 ||
      !Number.isSafeInteger(product.limit) || product.limit < 0 ||
      !Number.isSafeInteger(product.startAt) || product.startAt < 0 ||
      !Number.isSafeInteger(product.endAt) || product.endAt < 0 ||
      !Number.isSafeInteger(product.duration) || product.duration < 0 ||
      ![0, 1, 3].includes(product.limitType)) return null;
  const itemKeys = new Map(Object.entries(master?.items ?? {}).map(([key, value]) => [value, key]));
  const label = row => row.type === 0 ? itemKeys.get(row.rewardId) : row.type === 3
    ? master?.equipments?.[row.rewardId]?.name : row.type === 4
      ? master?.characterCostumes?.[row.rewardId]?.name : null;
  const rows = pack.contents.map(row => `<tr><td>${escapeHtml(label(row) ?? `Original type ${row.type}`)}</td><td>#${row.rewardId}</td><td>${row.amount}</td></tr>`).join('');
  const period = { 0: 'lifetime', 1: 'day', 3: 'month' }[product.limitType];
  const window = product.startAt || product.endAt ? `${date(product.startAt, true)} – ${date(product.endAt, true)}` : 'No fixed calendar dates';
  const duration = product.duration ? ` Available for ${product.duration} seconds after the saved account creation time.` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pack ${id} · Contents</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#f9f5ea;color:#27221b;max-width:850px;margin:auto;padding:18px}h1{color:#703e31}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #cfc4af;padding:8px}</style></head><body><h1>Archived pack contents</h1><p>Original pack #${id} · ${escapeHtml(pack.key)}</p><p>Shop product #${productId}: ${product.price} paid Iris · ${product.limit ? `${product.limit} per ${period}` : 'No catalog purchase limit'} · ${product.amount} pack${product.amount === 1 ? '' : 's'} per purchase.</p><p>Catalog dates: ${window}.${duration}</p><p>This page does not make a purchase or grant rewards. In-game eligibility can also depend on saved progress.</p><table><thead><tr><th>Reward</th><th>Reward ID</th><th>Amount per pack</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function eventBoxDetails(id, box) {
  if (!box || typeof box.key !== 'string' || typeof box.costKey !== 'string' ||
      !Number.isSafeInteger(box.cost) || box.cost <= 0 ||
      !Number.isSafeInteger(box.startAt) || !Number.isSafeInteger(box.endAt) ||
      !Array.isArray(box.steps) || !box.steps.length || box.steps.some((step, index) =>
        step.index !== index + 1 || !Array.isArray(step.contents) || !step.contents.length ||
        step.contents.some(row => !Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.amount) ||
          row.amount <= 0 || !Number.isSafeInteger(row.weight) || row.weight < 0 ||
          typeof row.rewardKey !== 'string'))) return null;
  const steps = box.steps.map(step => `<details><summary>Box ${step.index} · ${step.contents.length} archived rewards${step.repeatable ? ' · repeatable' : ''}</summary><table><thead><tr><th>Reward</th><th>Amount</th><th>Raw weight</th><th>Limit</th></tr></thead><tbody>${step.contents.map(row =>
    `<tr><td>${escapeHtml(row.rewardKey)}</td><td>${row.amount}</td><td>${row.weight}</td><td>${row.limited ? row.limit : 'None'}</td></tr>`
  ).join('')}</tbody></table></details>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Box ${id} · Details</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#f9f5ea;color:#27221b;max-width:850px;margin:auto;padding:18px}h1{color:#703e31}details{margin:12px 0;padding:8px;background:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #cfc4af;padding:8px}</style></head><body><h1>Archived event box</h1><p>Original box #${id} · ${escapeHtml(box.key)}</p><p>Original draw cost: ${box.cost} ${escapeHtml(box.costKey)}. Catalog window: ${date(box.startAt, true)} – ${date(box.endAt, true)}.</p><p>These are original raw weights, not final odds: remaining stock, resets and boosts can change a draw. Viewing this page does not spend event items or issue rewards.</p>${steps}</body></html>`;
}

function gachaDetails({ banner, master, catalog, savedButtons = [], dailyClaimedButtons = [], now }) {
  const lottery = master.lotteries[banner.lotteryId], featured = new Set(banner.source === 'authored-pickup' ? banner.pcIds : []);
  const pools = new Map(), poolRoles = new Map();
  const rank = id => master.pcJobRanks[master.pcProfiles[id]?.jobIds[0]];
  const unit = id => typeof id === 'string' ? { title: 'Selectable bonus slot', name: `Your chosen unit ${id.split('-')[1]}` }
    : catalog.pcs[id] ?? { title: 'Name unavailable', name: `Unit ${id}` };
  const unitName = id => { const row = unit(id); return `[${escapeHtml(row.title)}] ${escapeHtml(row.name)}`; };
  const addPool = (groupId, role) => {
    if (!groupId) return '<span class="muted">None</span>';
    if (!pools.has(groupId)) pools.set(groupId, poolRates(master, groupId, lottery));
    if (!poolRoles.has(groupId)) poolRoles.set(groupId, new Set());
    poolRoles.get(groupId).add(role);
    return `<a href="#pool-${groupId}">Pool ${groupId}</a>`;
  };
  const guaranteedPool = (button, fixedGroupId, groupId, role) => {
    const source = lotteryGuarantee(master, lottery, button, fixedGroupId, groupId);
    const html = !source ? '<span class="warning">Original guarantee unresolved</span>' : source.selected
      ? 'One of your three selected 4★ units · 1/3 each (offline policy)' : addPool(source.groupId, role);
    return { source, html };
  };
  const cost = button => !button.consumeAmount ? 'Free' : `${button.consumeAmount.toLocaleString('en-US')} ${
    ['','Iris',`ticket(s) #${lottery.ticketId}`,'paid Iris'][button.consumeType] ?? 'unknown currency'}`;
  const chance = (normal, guaranteed, normalCount, fixedCount) => {
    if (!featured.size || !normal || (fixedCount && !guaranteed) || lottery.selectionGroupIds?.length) return '';
    const hit = pool => [...featured].reduce((sum, id) => sum + (pool.rates.get(id) ?? 0), 0) / 100;
    const probability = 100 * (1 - (1 - hit(normal)) ** normalCount * (1 - (fixedCount ? hit(guaranteed) : 0)) ** fixedCount);
    return `<small class="chance">${percent(probability)} chance of at least one featured unit on the next purchase</small>`;
  };
  const buttons = lottery.buttons.flatMap((original, index) => {
    if (!original.pickCount && !original.stepUpGroupId) return [];
    const saved = savedButtons.find(row => row.buttonType === index + 1) ?? { count: 0, currentStepIndex: 1, lastPickedAt: 0 };
    const reset = original.daily && saved.lastPickedAt > 0 && day(saved.lastPickedAt) < day(now);
    const recorded = original.daily && dailyClaimedButtons.includes(index + 1);
    const count = Math.max(reset ? 0 : saved.count, recorded ? 1 : 0);
    const steps = master.lotteryStepUps[original.stepUpGroupId] ?? [], current = steps.length ? (reset ? 1 : saved.currentStepIndex) : 0;
    if (original.stepUpGroupId && !steps.length) return `<article class="draw"><h3>Button ${index + 1}</h3><p class="warning">Original step-up schedule ${original.stepUpGroupId} is unavailable. Costs and odds are not guessed.</p></article>`;
    if (steps.length && (!Number.isSafeInteger(current) || current < 1 || current > steps.length))
      return `<article class="draw"><h3>Button ${index + 1}</h3><p class="warning">Saved step-up progress is invalid. Costs and odds are not guessed.</p></article>`;
    const button = steps.length ? { ...original, ...steps[current - 1] } : original;
    const groupId = steps.length ? button.groupId : lottery.groupId;
    let fixedGroupId = button.fixedGroupId;
    const milestone = master.lotterySteps[banner.lotteryId]?.find(row => row.count === count + 1);
    if (milestone && button.fixedCount) fixedGroupId = milestone.groupId;
    const normalLink = button.pickCount > button.fixedCount ? addPool(groupId, `Button ${index + 1}: normal slots`) : 'No normal slots';
    const guarantee = guaranteedPool(button, fixedGroupId, groupId, `Button ${index + 1}: guaranteed slots`);
    const fixedLink = button.fixedCount ? guarantee.html : 'No guaranteed slots';
    const stepRows = steps.map(step => `<tr${step.stepIndex === current ? ' class="current"' : ''}><td>${step.stepIndex}${step.stepIndex === current ? ' · next' : ''}</td><td>${cost({ ...original, ...step })}</td><td>${step.pickCount - step.fixedCount} normal / ${step.fixedCount} guaranteed</td><td>${addPool(step.groupId, `Button ${index + 1}, step ${step.stepIndex}: normal`)}<br>${step.fixedCount ? guaranteedPool({ ...original, ...step }, step.fixedGroupId, step.groupId, `Button ${index + 1}, step ${step.stepIndex}: guaranteed`).html : 'No guarantee'}</td><td>${escapeHtml(step.description).replace(/\n/g, '<br>')}${step.lastStepFlag ? '<br>Final step' : ''}</td></tr>`).join('');
    return `<article class="draw"><div class="draw-heading"><h3>Button ${index + 1} · Draw ${button.pickCount}</h3><b>${cost(button)}</b></div><div class="pills"><span>${original.daily ? 'Resets daily at 00:00 JST' : 'No daily reset'}</span><span>${original.limit ? `${Math.max(0, original.limit - count)} / ${original.limit} purchases remaining` : 'No purchase-count limit'}</span><span>${count} completed purchase(s)${steps.length ? ` · next step ${current}` : ''}</span></div>${recorded ? '<p class="warning">Already drawn on this selected JST day in the local save.</p>' : ''}<p>${button.pickCount - button.fixedCount} normal slot(s): ${normalLink}<br>${button.fixedCount} guaranteed slot(s): ${fixedLink}</p>${chance(poolRates(master, groupId, lottery), poolRates(master, guarantee.source?.groupId, lottery), button.pickCount - button.fixedCount, button.fixedCount)}${stepRows ? `<details><summary>Full step-up schedule (${steps.length} steps)</summary><div class="scroll"><table><thead><tr><th>Step</th><th>Cost</th><th>Slots</th><th>Pools</th><th>Original description</th></tr></thead><tbody>${stepRows}</tbody></table></div></details>` : ''}</article>`;
  }).join('');
  const milestones = (master.lotterySteps[banner.lotteryId] ?? []).map(row =>
    `<tr><td>Purchase ${row.count}</td><td>${row.groupId ? addPool(row.groupId, `Milestone purchase ${row.count}`) : lottery.selectionGroupIds?.length ? 'Selected 4★ guarantee' : 'No separate pool'}</td><td>${row.groupId ? 'Replaces the guaranteed pool on buttons with guaranteed slots' : 'Uses the banner guarantee without a separate archived pool'}</td></tr>`).join('');
  const selection = (lottery.selectionGroupIds ?? []).map((id, index) => `<details><summary>Selectable slot ${index + 1} · ${(master.selectLineupPools[id] ?? []).length} eligible units</summary><p>Choose one unit from this list. The bonus contribution uses weight bucket ${master.selectLineupWeights[id]}; the base-pool chance, if present, is additional. Choices must be distinct.</p><ul>${(master.selectLineupPools[id] ?? []).map(pcId => `<li>${unitName(pcId)} <small>#${pcId}</small></li>`).join('')}</ul></details>`).join('');
  const poolTables = [...pools].map(([id, pool], index) => {
    if (!pool) {
      const raw = Object.entries(master.lotteryPools[id] ?? {}).map(([weightId, pcs]) => {
        const weight = master.lotteryWeights[weightId], counts = new Map();
        for (const pcId of pcs) counts.set(pcId, (counts.get(pcId) ?? 0) + 1);
        return `<details><summary>Weight bucket ${weightId} · ${Number.isSafeInteger(weight) ? `${weight}% archived weight` : 'weight missing'} · ${pcs.length} archived entries</summary><ul>${[...counts].map(([pcId, count]) => `<li>${unitName(pcId)} <small>#${pcId}${count > 1 ? ` · ${count} duplicate entries in source` : ''}</small></li>`).join('')}</ul></details>`;
      }).join('');
      return `<article id="pool-${id}" class="pool"><h3>Pool ${id}</h3><p class="warning">This archived pool does not satisfy the local draw handler: missing weights, missing entries, or invalid totals. Its original member list is retained below; no final odds have been invented.</p>${raw || '<p>Original member list unavailable.</p>'}</article>`;
    }
    const totalByRank = new Map();
    for (const [pcId, rate] of pool.rates) { const label = typeof pcId === 'string' ? 'Selectable bonus' : `${rank(pcId) ?? '?'}★`; totalByRank.set(label, (totalByRank.get(label) ?? 0) + rate); }
    const repeated = pool.buckets.some(bucket => new Set(bucket.pcs).size !== bucket.pcs.length);
    const summary = [...totalByRank].sort(([a],[b]) => b.localeCompare(a)).map(([label, rate]) => `<span>${label}: <b>${percent(rate)}</b></span>`).join('') +
      (repeated ? '<span>Repeated original unit entries each count as one pool slot</span>' : '');
    const rows = [...pool.rates].sort(([a,ar],[b,br]) => Number(featured.has(b)) - Number(featured.has(a)) || br - ar || String(a).localeCompare(String(b))).map(([pcId, rate]) =>
      `<tr${featured.has(pcId) ? ' class="featured"' : ''}><td>${typeof pcId === 'string' ? 'Choice' : `${rank(pcId) ?? '?'}★`}</td><td>${unitName(pcId)}${featured.has(pcId) ? ' <span class="badge">Featured</span>' : ''}<small class="identity">${typeof pcId === 'string' ? 'Additional selectable contribution' : `#${pcId}`}</small></td><td class="rate">${percent(rate)}</td></tr>`).join('');
    const buckets = pool.buckets.map(row => `<tr><td>${row.id}</td><td>${percent(row.weight)}</td><td>${row.pcs.length}</td><td>${percent(row.weight / row.pcs.length)}</td></tr>`).join('');
    return `<article id="pool-${id}" class="pool"><h3>Pool ${id}</h3><p class="muted">${escapeHtml([...poolRoles.get(id)].join(' · '))}</p>${pool.derivedWeightIds.length ? '<p class="warning">Weight 174000091 is absent from the surviving master table. Its 2% rate is reconstructed from the other original weights totaling 98% and the preserved double-4★ banner art; it is not a recovered publisher weight row.</p>' : ''}<div class="pills">${summary}</div><details${index === 0 ? ' open' : ''}><summary>Complete unit pool · ${pool.rates.size} entries · total 100%</summary><table><thead><tr><th>Rank</th><th>Unit</th><th>Per-slot odds</th></tr></thead><tbody>${rows}</tbody></table></details><details><summary>${pool.derivedWeightIds.length ? 'Weight-bucket breakdown (one reconstructed)' : 'Original weight-bucket breakdown'}</summary><table><thead><tr><th>Weight ID</th><th>Bucket odds</th><th>Entries</th><th>Per-entry contribution</th></tr></thead><tbody>${buckets}</tbody></table></details></article>`;
  }).join('');
  const featuredCards = banner.units.map(row => `<div class="unit"><small>${escapeHtml(row.title)}</small><b>${escapeHtml(row.name)}</b><span>${rank(row.id) ?? '?'}★ · #${row.id}</span></div>`).join('');
  const scratches = (master.lotteryScratches[banner.lotteryId] ?? []).map(row =>
    `<li>Button ${row.buttonType}: scratch #${row.scratchId} (${row.once ? 'recurring on eligible draws' : 'first draw only'}). Scratch rewards are separate from unit-pool odds.</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(banner.title)} · Gacha Details</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f0e7;color:#352c29;font:16px/1.55 sans-serif}main{max-width:1120px;margin:auto;padding:24px}header{padding:28px 32px;background:linear-gradient(120deg,#542528,#853b35);color:#fff8e5;border-top:5px solid #c1a365;border-radius:10px}header small{letter-spacing:2px;color:#e6cb91}h1{font-size:30px;line-height:1.25;margin:10px 0 16px}h2{font-size:23px;margin:28px 0 14px}h3{margin:0 0 10px;font-size:19px}.pills{display:flex;flex-wrap:wrap;gap:8px}.pills span{background:#efe5d5;border:1px solid #dccbac;border-radius:20px;padding:5px 12px;font-size:13px}header .pills span{background:#ffffff13;border-color:#c1a36570}nav{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}nav a{border:1px solid #ccb588;border-radius:6px;padding:8px 14px;background:#fffaf0}a{color:#863d31}header a{color:#fff}.units{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:12px}.unit{background:#fffdf8;border:1px solid #d8c7a6;border-left:4px solid #b99552;padding:14px;border-radius:6px}.unit b,.unit span{display:block}.unit small{color:#86422e}.unit span{font-size:12px;color:#817466}.draw,.pool,.note{padding:20px;background:#fffdf9;border:1px solid #dfd2bd;border-radius:8px;margin:14px 0;box-shadow:0 3px 12px #37221108}.draw-heading{display:flex;justify-content:space-between;gap:12px}.draw-heading>b{color:#853b35}.chance{display:block;background:#f2ecd9;padding:8px 12px;border-radius:4px;margin:12px 0}.muted{color:#817466;font-size:13px}.warning{color:#9b3428}.badge{font-size:11px;background:#f1ddb0;border-radius:4px;padding:2px 6px;color:#68451c}.identity{display:block;color:#8c8172;font-size:11px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:12px}th{text-align:left;background:#ece2d3;color:#5b4336}td,th{padding:10px 12px;border-bottom:1px solid #e8dfd1}td.rate{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:bold}th:last-child{text-align:right}tr.featured{background:#fff4d9}tr.current{background:#fff4d9}details{margin-top:14px}summary{cursor:pointer;font-weight:bold;color:#74412f;padding:10px 0}.scroll{overflow:auto}footer{font-size:12px;color:#817466;padding:16px 0 32px}section{scroll-margin-top:12px}@media(max-width:650px){main{padding:12px}header{padding:20px}h1{font-size:23px}.draw,.pool,.note{padding:14px}td,th{padding:8px 6px}.draw-heading{display:block}.unit{padding:10px}}
</style></head><body><main><header><small>DANMEMORE · GACHA DETAILS</small><h1>${escapeHtml(banner.title)}</h1><div class="pills"><span>Banner #${banner.lotteryId}</span><span>${lottery.startAt <= now && (!lottery.endAt || now < lottery.endAt) ? 'Active on event clock' : 'Outside event-clock window'}</span><span>${banner.background.source === 'archive' ? 'Original artwork preserved' : 'Labeled fallback · original image unavailable'}</span></div></header><nav><a href="#featured">Featured units</a><a href="#draws">Draw rules</a><a href="#pools">Pools &amp; odds</a><a href="#notes">How rates work</a></nav><div class="note"><b>Availability</b><br>${date(lottery.startAt)} → ${date(lottery.endAt)}<br><small class="muted">Current event clock: ${date(now)}. End dates are exclusive.</small></div><section id="featured"><h2>${featured.size ? 'Featured units' : 'Original pool preview'}</h2>${!featured.size ? '<p class="muted">No authored pickup list exists for this banner. These are pool examples, not claimed rate-up units.</p>' : ''}<div class="units">${featuredCards}</div></section><section id="draws"><h2>Draw costs, limits &amp; guarantees</h2>${buttons}${milestones ? `<article class="draw"><h3>Milestone guarantees</h3><table><thead><tr><th>Purchase number</th><th>Guaranteed pool</th><th>Applies to</th></tr></thead><tbody>${milestones}</tbody></table></article>` : ''}${selection ? `<article class="draw"><h3>Selectable lineups</h3>${selection}</article>` : ''}${scratches ? `<article class="draw"><h3>Scratch availability</h3><ul>${scratches}</ul></article>` : ''}</section><section id="pools"><h2>Complete pools &amp; exact per-slot odds</h2>${poolTables}</section><section id="notes" class="note"><h3>How these rates work</h3><p>Each slot first selects an original weight bucket, then uniformly selects one entry in that bucket. A unit's rate is the bucket weight divided by its entry count; contributions are added if the same unit appears in multiple buckets. Guaranteed slots use their own pool and replace normal slots.</p><p>Multi-draw chance is calculated independently across its normal and guaranteed slots. A purchase count means one draw purchase, not the number of units received. Daily counters reset at 00:00 JST. Step-up and milestone pools can change the next purchase's rates.</p><p>Selectable bonus slots are shown as placeholders before you choose units. Their listed rate is the additional contribution; any ordinary-pool chance for the chosen unit also applies. No final selected-lineup probability is claimed before selection.</p><p>Percentages are rounded to six decimal places for display; the handler uses original integer weights except the explicitly labeled Orgion 2% reconstruction. Other missing source data remains unavailable.</p></section><footer>Source: original lottery, lotteryCharacter, lotteryWeightGroup, lotteryPickup, lotteryStep, lotteryStepUpStep, selectLineupLottery and PC master tables. These rates describe DanMemoRe's local draw handler.</footer></main></body></html>`;
}

function takarakujiDetails({ id, event, item, missions, ticketCount, now, items = {}, result = null }) {
  const rows = missions.filter(([, mission]) => mission.rewardKey === item.key).map(([missionId, mission]) =>
    `<tr data-mission-id="${escapeHtml(missionId)}"><td>${escapeHtml(missionId)}</td><td>${escapeHtml(mission.rewardAmount)}</td><td>${date(mission.startAt, true)}<br>to ${date(mission.expireAt, true)}</td></tr>`).join('');
  const season = id - 56000000000, groups = lottoPrizes[season] ?? [];
  const itemKeys = Object.fromEntries(Object.entries(items).map(([key, itemId]) => [itemId, key]));
  if (groups.some(group => group.some(([itemId, amount]) => !itemKeys[itemId] ||
      !Number.isSafeInteger(amount) || amount <= 0))) return null;
  const prizeRows = groups.map((group, index) => `<tr data-prize-rank="${index + 1}"><td>Rank ${index + 1}</td><td>${group.map(([itemId, amount]) =>
    `${escapeHtml(itemKeys[itemId])} × ${amount.toLocaleString('en-US')}`).join('<br>')}</td></tr>`).join('');
  const prizeSection = `${season === 11 ? '<section><h2>Archived drawing announcement</h2><p>Season 11 announced a drawing on 17 July 2023 (labeled PST), with ticket distribution from 14 June 18:00 to 16 July 06:59 PST. The announcement gives no draw hour or result-publication time.</p></section>' : ''}<section><h2>Archived prize contents</h2>${prizeRows ?
    `<div class="scroll"><table><thead><tr><th>Rank</th><th>Original item key and quantity</th></tr></thead><tbody>${prizeRows}</tbody></table></div><p class="muted">These archived reward rows do not establish winning numbers, odds, publication time, or an earned prize.${season === 11 ? ' Season 11 has content rows but no matching gift heading rows in the final archive.' : ''}</p>` :
    '<p>No prize-content rows for this season are present in the final archive. Rewards are not invented.</p>'}</section>`;
  const drawAt=Number.isSafeInteger(result?.drawAt) ? result.drawAt : null;
  const resultSection=result?.published && Array.isArray(result.tickets) ? (()=>{
    const counts=new Map();
    for(const ticket of result.tickets) counts.set(ticket.prize,(counts.get(ticket.prize) ?? 0)+1);
    const summary=[...counts].sort(([a],[b])=>a-b).map(([rank,count])=>
      `<tr><td>Rank ${rank}</td><td>${count.toLocaleString('en-US')}</td></tr>`).join('');
    return `<section class="warning" data-lotto-result="published"><h2>Offline result published</h2><p>Best ticket: <b>${result.playerPrize === 99999999 ? 'No issued ticket' : `Rank ${result.playerPrize}`}</b><br>Publication boundary: ${date(drawAt,true)}</p>${summary ? `<table><thead><tr><th>Result rank</th><th>Your tickets</th></tr></thead><tbody>${summary}</tbody></table>` : '<p>No numbered tickets were issued before publication.</p>'}<p class="muted">Ticket ranks use a deterministic, lowest-rank-heavy offline reconstruction because the retired service’s winning numbers and exact odds are absent. Opening the Lotto screen freezes this event’s issued ticket set. ${groups.length ? 'The exact surviving rank contents are issued once as Ranking Presents; claiming them remains the normal Present flow.' : 'This season has no surviving prize-content rows, so no payout is invented.'} This details page never claims a Present.</p></section>`;
  })() : `<section class="warning" data-lotto-result="pending"><h2>${drawAt && now>=drawAt ? 'Offline result ready' : 'Results pending'}</h2><p>${drawAt ? `Local publication boundary: ${date(drawAt,true)}.` : 'The local publication boundary is unavailable.'}${drawAt && now>=drawAt ? ' Open the Lotto screen to publish and persist the result.' : ''}</p><p>Original winning numbers and exact odds were not archived. No ticket has been declared a winner or loser by viewing this page.</p></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(event.name)} · Lotto Details</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f0e7;color:#352c29;font:16px/1.55 sans-serif}main{max-width:1000px;margin:auto;padding:24px}header{padding:24px;background:#542528;color:#fff8e5;border-top:5px solid #c1a365;border-radius:8px}h1{margin:8px 0;font-size:28px}h2{font-size:21px}section{padding:20px;background:#fffdf9;border:1px solid #dfd2bd;border-radius:8px;margin:16px 0}.warning{border-left:5px solid #b99552}.muted,footer{color:#817466;font-size:13px}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:10px;border-bottom:1px solid #e8dfd1}th{background:#ece2d3}footer{padding:12px 0}@media(max-width:650px){main{padding:12px}header,section{padding:16px}h1{font-size:23px}td,th{padding:8px 5px}}
</style></head><body><main data-lotto-event="${id}"><header><small>DANMEMORE · LOTTO DETAILS</small><h1>${escapeHtml(event.name)}</h1><div>Event #${id} · Active on event clock</div></header><section><h2>Original event window</h2><p>${date(event.startAt, true)} → ${date(event.endAt, true)}<br><small class="muted">Start inclusive; end exclusive. Event clock at page generation: ${date(now, true)}.</small></p><p>${escapeHtml(item.name)} · Item #${event.itemId}<br>${escapeHtml(item.description)}</p></section><section data-ticket-count="${ticketCount}"><h2>Your saved tickets</h2><p><b>${ticketCount.toLocaleString('en-US')} issued ticket(s)</b>${ticketCount ? `<br>Saved numbers: 1–${ticketCount}` : '<br>No tickets have been issued for this event.'}</p><p class="muted">Includes committed mission awards still awaiting the client save. Consecutive numbers are offline ticket identities, not recovered publisher winning numbers. Reading this page does not issue or spend tickets, change result flags, or award Iris.</p></section>${resultSection}${prizeSection}<section><h2>Archived ticket missions</h2>${rows ? `<div class="scroll"><table><thead><tr><th>Original mission ID</th><th>Tickets awarded</th><th>Authored mission start / expiry</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>No ticket mission rows for this event are present in the final mission table. Earlier rewards are not invented.</p>'}<p class="muted">These are original reward quantities and mission dates, not proof that a mission is currently unlocked or claimable. Native completion conditions, repeat eligibility and any later claim deadline are separate. Claim supported completed missions through the game’s mission screen.</p></section><footer>Source: original takarakujiInfo, takarakujiItem, gift, giftContent and achievement tables; permanent offline ticket receipts. Prize rows are present only for seasons 1–4 and 11. Published ranks use the explicitly labeled local result policy, not claimed publisher odds. The page is self-contained and uses no publisher service. Exact transport retries preserve their earlier page snapshot; reopening details creates a fresh snapshot.</footer></main></body></html>`;
}

// The subscription callback181c75c uses root `result`, and passes that
// string to WebViewUIState::initWithBody(1fa1e60), not a remote URL.
function subscriptionDetails({ id, plan, now }) {
  const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff;
  const text = value => typeof value === 'string' && value.length > 0;
  const item = row => row && integer(row.id) && row.id > 0 && integer(row.type) &&
    integer(row.itemId) && row.itemId > 0 && integer(row.amount) && row.amount > 0 && text(row.name);
  if (!integer(id) || id === 0 || !plan || !text(plan.name) || !text(plan.productId) || !text(plan.description) ||
      !integer(plan.tier) || plan.tier === 0 || !integer(plan.slot3) ||
      !integer(plan.missionShopId) || !integer(plan.exchangeShopId) ||
      !Number.isSafeInteger(plan.startAt) || plan.startAt < 0 ||
      !Number.isSafeInteger(plan.endAt) || plan.endAt <= plan.startAt || plan.endAt > 253402300799 ||
      !Number.isSafeInteger(now) || now < 0 || now > 253402300799 ||
      !Array.isArray(plan.bonusItems) || plan.bonusItems.length !== 4 ||
      !plan.bonusItems.every(row => item(row) && integer(row.slot5)) ||
      !Array.isArray(plan.extendBonusItems) || plan.extendBonusItems.length !== 2 ||
      !plan.extendBonusItems.every(item) ||
      new Set([...plan.bonusItems, ...plan.extendBonusItems].map(row => row.id)).size !== 6) return null;
  const rewards = (rows, variants) => rows.map(row => `<tr data-reward-id="${row.id}"><td>${escapeHtml(row.name)}<small>Item #${row.itemId} · original type ${row.type}</small></td><td>${row.amount}</td>${variants ? `<td>${row.slot5}</td>` : ''}</tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(plan.name)} · Subscription Details</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f0e7;color:#352c29;font:16px/1.55 sans-serif}main{max-width:1000px;margin:auto;padding:24px}header{padding:24px;background:#542528;color:#fff8e5;border-top:5px solid #c1a365;border-radius:8px}h1{margin:8px 0;font-size:28px}h2{font-size:21px}section{padding:20px;background:#fffdf9;border:1px solid #dfd2bd;border-radius:8px;margin:16px 0}.warning{border-left:5px solid #b99552}small,footer{display:block;color:#817466;font-size:13px;overflow-wrap:anywhere}header small{color:#fff8e5}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:10px;border-bottom:1px solid #e8dfd1}th{background:#ece2d3}.archive{white-space:pre-wrap;overflow-wrap:anywhere}footer{padding:12px 0}@media(max-width:650px){main{padding:12px}header,section{padding:16px}h1{font-size:23px}td,th{padding:8px 5px}}
</style></head><body><main data-subscription-id="${id}"><header><small>DANMEMORE · SUBSCRIPTION DETAILS</small><h1>${escapeHtml(plan.name)}</h1><div>Original tier ${plan.tier} · Plan #${id}</div></header><section class="warning"><h2>Offline membership service — native acceptance pending</h2><p>Opening this page does not enroll you, charge money, renew a subscription or claim rewards. Local product, order, activation, status and history handlers are implemented in server source, but native enrollment is not yet verified. Daily/monthly bonus delivery is implemented in server source; native effects, enrollment and save ordering are not yet verified. This is not a live Apple, Google or publisher subscription service.</p></section><section><h2>Local membership policy</h2><p>No real charge and no automatic renewal. The first activation of each tier is a one-calendar-month trial; later manual renewals are regular membership periods at no charge. Periods follow the event clock and the client’s UTC+9 calendar, clamping month-end dates. Clock rewinds do not reset lifetime activation counts. Activation does not itself deliver the rewards below. A separate local bonus packet issues them once, with required saved inventory and stamina proof before acknowledgement. Unclaimed regular renewal rewards are retained offline; publisher monthly forfeiture rules are not reconstructed.</p></section><section><h2>Original plan data</h2><p>Catalog start: ${date(plan.startAt, true)}<br>Catalog end: ${date(plan.endAt, true)}<br>Event clock when this page was generated: ${date(now, true)}</p><small>Product: ${escapeHtml(plan.productId)}<br>Original mission shop #${plan.missionShopId} · exchange shop #${plan.exchangeShopId}. These dates identify archived catalog data, not a purchased entitlement or guaranteed availability.</small></section><section><h2>Archived daily bonus variants</h2><table><thead><tr><th>Reward</th><th>Quantity</th><th>Original variant</th></tr></thead><tbody>${rewards(plan.bonusItems, true)}</tbody></table><p>The archive retains two variants of the skip-ticket reward. They are alternative source rows, not a combined daily grant. New local memberships explicitly use the assist-ticket variant (original slot5=1), with 100 stamina and five assist tickets per active tier per client day. This local choice is not a recovered publisher meaning of slot5. The separate default daily refill is not duplicated; native claim/reset flags remain unrecovered.</p></section><section><h2>Archived renewal reward rows</h2><table><thead><tr><th>Reward</th><th>Quantity</th></tr></thead><tbody>${rewards(plan.extendBonusItems, false)}</tbody></table><p>The archived description excludes monthly tickets and Prism Bond Shards during the free trial. No trial, renewal or reward is created by viewing these rows. Regular local renewals earn their original ticket and shard once; their archived 30/180-day lifetimes start at the captured claim time, and retries do not refresh them.</p></section><section><h2>Archived description — not live billing terms</h2><p>The following is preserved original text. Its price placeholders, trial, account, payment and auto-renewal statements describe the retired publisher service and do not apply to this offline listener.</p><div class="archive">${escapeHtml(plan.description)}</div></section><footer>Original subscription, subscriptionItem, subscriptionExtendItem and skipTicket data from the final archive. Names and quantities are not reconstructed. Self-contained page; no publisher requests, external assets, purchase buttons or enrollment links. Exact retries preserve the earlier snapshot; reopen for the current event-clock date.</footer></main></body></html>`;
}

module.exports = { poolRates, lotteryGuarantee, gachaDetails, scratchDetails, packDetails, eventBoxDetails, takarakujiDetails, subscriptionDetails };
