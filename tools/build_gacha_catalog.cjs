'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { decodeFile, decodeTable } = require('./decode_master_data.cjs');

const root = path.resolve(__dirname, '..');
const contents = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'contents');
const configFile = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, '.work', 'asset-config.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8')), numericKey = Buffer.from(config.numericKey);
const source = path.join(contents, '1', 'master', 'divide_enc', 'lottery.enc');
const wire = fs.readFileSync(source), original = decodeFile(wire, config.key, config.iv);
const schema = Array.from({ length: 59 }, (_, i) => [String(i), i === 2 ? 'string' : [4,5].includes(i) ? 'long' : 'int']);
const lotteries = decodeTable(original, schema, numericKey);
assert.equal(lotteries.length, 2236);

const read = (name, fields) => decodeTable(decodeFile(fs.readFileSync(path.join(contents, '1', 'master',
  'divide_enc', `${name}.enc`)), config.key, config.iv), fields, numericKey);
const originalPickups = read('lotteryPickup', Array.from({ length: 5 }, (_, i) => [String(i), 'int']));
const pcs = new Map(read('pc', [['id','int'],['title','string'],['name','string']]).map(row => [row.id, row]));
const poolRows = read('lotteryCharacter', [null,['groupId','int'],['pcId','int'],['weightId','int']]);
const weights = Object.fromEntries(read('lotteryWeightGroup', [['id','int'],['weight','int']])
  .map(row => [row.id, row.weight]));
const stepGroups = {};
for (const row of read('lotteryStepUpStep', [null,['stepUpGroupId','int'],['groupId','int'],['fixedGroupId','int']]))
  (stepGroups[row.stepUpGroupId] ??= []).push(row);
const pools = Map.groupBy(poolRows, row => row.groupId);
const pickupByLottery = Map.groupBy(originalPickups, row => row[1]);
const lotteriesByGroup = Map.groupBy(lotteries, row => row[7]);
const asset = relative => {
  for (let phase = 1; phase <= 8; phase++) if (fs.existsSync(path.join(contents, String(phase), relative)))
    return `${phase}/${relative.replaceAll('\\', '/')}`;
  return null;
};
const artCache = new Map();
const art = pcId => {
  if (artCache.has(pcId)) return artCache.get(pcId);
  const lottery = asset(`files/character/lottery/gac_${pcId}/lottery.png`);
  const name = asset(`files/lottery/name/${pcId}.png`), text = asset(`files/lottery/text/${pcId}.png`);
  const result = lottery && name && text ? { pcId, lottery, name, text } : null;
  artCache.set(pcId, result);
  return result;
};
for (const row of originalPickups) assert.ok(art(row[2]), `Missing archived pickup art ${row[2]}`);

const fallbackFor = lottery => {
  const sibling = lottery[7] ? (lotteriesByGroup.get(lottery[7]) ?? [])
    .flatMap(row => pickupByLottery.get(row[0]) ?? []).map(row => row[2]) : [];
  const groups = new Set([lottery[7], lottery[25], lottery[35]].filter(Boolean));
  for (const stepGroupId of [lottery[42], lottery[43]].filter(Boolean))
    for (const step of stepGroups[stepGroupId] ?? []) for (const groupId of [step.groupId, step.fixedGroupId].filter(Boolean)) groups.add(groupId);
  const scored = [...groups].flatMap(groupId => {
    const rows = pools.get(groupId) ?? [], byWeight = Map.groupBy(rows, row => row.weightId);
    return rows.map(row => ({ pcId: row.pcId, score: (weights[row.weightId] ?? 0) / byWeight.get(row.weightId).length }));
  }).sort((a, b) => b.score - a.score || a.pcId - b.pcId).map(row => row.pcId);
  return [...new Set([...sibling, ...scored])].filter(pcId => art(pcId)).slice(0, 3);
};
const artAudit = [];
for (const lottery of lotteries) {
  const authored = [...new Set((pickupByLottery.get(lottery[0]) ?? []).map(row => row[2]))];
  const fallback = authored.length ? [] : fallbackFor(lottery);
  assert.ok(authored.length || fallback.length, `No archived pool art for lottery ${lottery[0]}`);
  const pcIds = authored.length ? authored : fallback;
  const background = asset(`files/lottery/background/${lottery[0]}.png`);
  artAudit.push({ lotteryId: lottery[0], title: lottery[2],
    source: authored.length ? 'authored-pickup' : 'original-pool-preview', pcIds,
    units: pcIds.map(pcId => { assert.ok(pcs.has(pcId)); return pcs.get(pcId); }), art: pcIds.map(art),
    background: { source: background ? 'archive' : 'text-fallback',
      path: background ?? `3/files/lottery/background/${lottery[0]}.png` } });
}

const output = path.join(root, 'data', 'manifests', 'resources', 'gacha', 'lottery.enc');
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, wire);
const manifestFile = path.join(root, 'data', 'manifests', 'project.manifest.1');
const manifest = JSON.parse(fs.readFileSync(path.join(contents, '1', 'project.manifest'), 'utf8'));
manifest.assets['master/divide_enc/lottery.enc'] = {
  md5: crypto.createHash('md5').update(wire).digest('hex'), path: 'resources/gacha/lottery.enc', size: wire.length,
};
// Pickup rows drive character previews, NOT the main banner. Preserve them exactly.
const pickupWire = fs.readFileSync(path.join(contents, '1', 'master', 'divide_enc', 'lotteryPickup.enc'));
const pickupOutput = path.join(root, 'data', 'manifests', 'resources', 'gacha', 'lotteryPickup.enc');
fs.writeFileSync(pickupOutput, pickupWire);
manifest.assets['master/divide_enc/lotteryPickup.enc'] = {
  md5: crypto.createHash('md5').update(pickupWire).digest('hex'), path: 'resources/gacha/lotteryPickup.enc', size: pickupWire.length,
};
const auditFile = path.join(root, 'data', 'danmemore-gacha-art.json');
fs.writeFileSync(auditFile, `${JSON.stringify({ version: 2,
  archivedRows: originalPickups.length, pcs: Object.fromEntries(pcs), banners: artAudit }, null, 2)}\n`);
const backgrounds = path.join(root, 'data', 'manifests', 'resources', 'gacha', 'background');
fs.mkdirSync(backgrounds, { recursive: true });
execFileSync('powershell.exe', ['-NoProfile', '-File', path.join(__dirname, 'render_gacha_banners.ps1'),
  '-Catalog', auditFile, '-OutputDirectory', backgrounds], { stdio: 'inherit' });
const bannerManifest = JSON.parse(fs.readFileSync(path.join(contents, '3', 'project.manifest')));
for (const banner of artAudit.filter(row => row.background.source === 'text-fallback')) {
  const image = fs.readFileSync(path.join(backgrounds, `${banner.lotteryId}.png`));
  bannerManifest.assets[`files/lottery/background/${banner.lotteryId}.png`] = {
    md5: crypto.createHash('md5').update(image).digest('hex'),
    path: `resources/gacha/background/${banner.lotteryId}.png`, size: image.length,
  };
}
fs.writeFileSync(path.join(root, 'data', 'manifests', 'project.manifest.3'), JSON.stringify(bannerManifest));

const shopSource = path.join(contents, '1', 'master', 'divide_enc', 'shopProduct.enc');
const shopWire = fs.readFileSync(shopSource), shopOriginal = decodeFile(shopWire, config.key, config.iv);
const shopSchema = [['id','int'], null, null, null, ['priceType','int'], ['priceItemId','long'], ['price','int'],
  ['limitType','int'], ['limit','int'], ['rewardType','int'], ['rewardId','long'], ['amount','int'],
  ['startAt','long'], ['endAt','long'], ['shopId','int'], ['duration','long']];
const shopProducts = decodeTable(shopOriginal, shopSchema, numericKey);
assert.equal(shopProducts.filter(row => row.rewardType === 2).length, 346);
const shopOutput = path.join(root, 'data', 'manifests', 'resources', 'shop', 'shopProduct.enc');
fs.mkdirSync(path.dirname(shopOutput), { recursive: true }); fs.writeFileSync(shopOutput, shopWire);
manifest.assets['master/divide_enc/shopProduct.enc'] = {
  md5: crypto.createHash('md5').update(shopWire).digest('hex'), path: 'resources/shop/shopProduct.enc', size: shopWire.length,
};
// Preserve the independently verified offline voice catalog on art rebuilds.
const voiceCatalog = path.join(root, 'data', 'manifests', 'resources', 'voice', 'voice_episode.manifest');
if (fs.existsSync(voiceCatalog)) {
  const voiceWire = fs.readFileSync(voiceCatalog);
  manifest.assets['manifests/voice_episode.manifest'] = {
    md5: crypto.createHash('md5').update(voiceWire).digest('hex'),
    path: 'resources/voice/voice_episode.manifest', size: voiceWire.length,
  };
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest));
console.log(`Preserved ${lotteries.length} original gacha schedules in ${path.relative(root, output)} (${wire.length} bytes)`);
console.log(`Main banner backgrounds: ${artAudit.filter(row => row.background.source === 'archive').length} exact archive images; ${artAudit.filter(row => row.background.source === 'text-fallback').length} labeled text cards. Pickup metadata unchanged.`);
console.log(`Preserved ${shopProducts.filter(row => row.rewardType === 2).length} original bundle schedules in ${path.relative(root, shopOutput)} (${shopWire.length} bytes)`);
