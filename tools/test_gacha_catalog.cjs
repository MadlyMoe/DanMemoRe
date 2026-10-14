'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { decodeBlock, decodeFile, decodeTable, field, rows: tableRows } = require('./decode_master_data.cjs');

const root = path.resolve(__dirname, '..'), config = JSON.parse(fs.readFileSync(path.join(root, '.work', 'asset-config.json')));
const key = Buffer.from(config.numericKey), file = path.join(root, 'data', 'manifests', 'resources', 'gacha', 'lottery.enc');
const wire = fs.readFileSync(file), schema = Array.from({ length: 59 }, (_, i) =>
  i === 2 ? null : [String(i), [4,5].includes(i) ? 'long' : 'int']);
const rows = decodeTable(decodeFile(wire, config.key, config.iv), schema, key);
assert.equal(rows.length, 2236);
assert.deepEqual(wire, fs.readFileSync(path.join(root, 'contents', '1', 'master', 'divide_enc', 'lottery.enc')));
const clock = Math.floor(Date.parse('2019-10-18T12:00:00Z') / 1000);
const active = rows.filter(row => row[4] <= clock && (!row[5] || clock < row[5])).map(row => row[0]);
assert.ok(active.includes(171000713));
assert.ok(!active.includes(171000714));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'manifests', 'project.manifest.1')));
assert.deepEqual(manifest.assets['master/divide_enc/lottery.enc'], {
  md5: crypto.createHash('md5').update(wire).digest('hex'), path: 'resources/gacha/lottery.enc', size: wire.length,
});
const pickupFile = path.join(root, 'data', 'manifests', 'resources', 'gacha', 'lotteryPickup.enc');
const pickupWire = fs.readFileSync(pickupFile), pickups = decodeTable(decodeFile(pickupWire, config.key, config.iv),
  Array.from({ length: 5 }, (_, i) => [String(i), 'int']), key);
const pickupBlob = decodeFile(pickupWire, config.key, config.iv);
assert.ok(tableRows(pickupBlob).every(table => table % 8 === 4 && decodeBlock(pickupBlob.subarray(
  field(pickupBlob, table, 4), field(pickupBlob, table, 4) + 8), key).length === 1));
const originalPickups = decodeTable(decodeFile(fs.readFileSync(path.join(root, 'contents', '1', 'master',
  'divide_enc', 'lotteryPickup.enc')), config.key, config.iv), Array.from({ length: 5 }, (_, i) => [String(i), 'int']), key);
assert.deepEqual(pickups.slice(0, originalPickups.length), originalPickups);
assert.deepEqual(pickupWire, fs.readFileSync(path.join(root, 'contents', '1', 'master', 'divide_enc', 'lotteryPickup.enc')));
assert.equal(new Set(pickups.map(row => row[1])).size, 1868);
assert.deepEqual(manifest.assets['master/divide_enc/lotteryPickup.enc'], {
  md5: crypto.createHash('md5').update(pickupWire).digest('hex'), path: 'resources/gacha/lotteryPickup.enc', size: pickupWire.length,
});
const art = JSON.parse(fs.readFileSync(path.join(root, 'data', 'danmemore-gacha-art.json')));
assert.equal(art.banners.length, 2236);
assert.equal(art.banners.filter(row => row.source === 'authored-pickup').length, 1868);
assert.equal(art.banners.filter(row => row.source === 'original-pool-preview').length, 368);
assert.ok(art.banners.every(row => row.pcIds.length && row.art.every(item =>
  ['lottery','name','text'].every(key => fs.existsSync(path.join(root, 'contents', item[key]))))));
assert.equal(art.banners.filter(row => row.background.source === 'archive').length, 692);
assert.equal(art.banners.filter(row => row.background.source === 'text-fallback').length, 1544);
const bannerManifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'manifests', 'project.manifest.3')));
for (const banner of art.banners) {
  assert.equal(banner.background.path, `3/files/lottery/background/${banner.lotteryId}.png`);
  assert.ok(banner.units.every(unit => unit.id > 0 && unit.title && unit.name && art.pcs[unit.id]));
  if (banner.background.source === 'archive') {
    assert.ok(fs.existsSync(path.join(root, 'contents', banner.background.path)));
  } else {
    const metadata = bannerManifest.assets[banner.background.path.slice(2)];
    const image = fs.readFileSync(path.join(root, 'data', 'manifests', metadata.path));
    assert.equal(metadata.md5, crypto.createHash('md5').update(image).digest('hex'));
    assert.equal(metadata.size, image.length);
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), 1280); assert.equal(image.readUInt32BE(20), 720);
  }
}
const shopFile = path.join(root, 'data', 'manifests', 'resources', 'shop', 'shopProduct.enc');
const shopWire = fs.readFileSync(shopFile), shopRows = decodeTable(decodeFile(shopWire, config.key, config.iv),
  [['id','int'], null, null, null, ['priceType','int'], ['priceItemId','long'], ['price','int'],
    ['limitType','int'], ['limit','int'], ['rewardType','int'], ['rewardId','long'], ['amount','int'],
    ['startAt','long'], ['endAt','long'], ['shopId','int'], ['duration','long']], key);
assert.equal(shopRows.filter(row => row.rewardType === 2).length, 346);
assert.deepEqual(shopWire, fs.readFileSync(path.join(root, 'contents', '1', 'master', 'divide_enc', 'shopProduct.enc')));
assert.deepEqual(manifest.assets['master/divide_enc/shopProduct.enc'], {
  md5: crypto.createHash('md5').update(shopWire).digest('hex'), path: 'resources/shop/shopProduct.enc', size: shopWire.length,
});
console.log(`Event-clock catalog: ${active.length} active; 692 original backgrounds and 1544 native text fallbacks; original master bytes preserved: OK`);
