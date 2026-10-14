'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Read only the pristine15.1.0 ARM64 image.22acfa8 initializes the archive
// AES/IV and20b76f8 initializes XXTEA; values stay in memory, never in Git/logs.
function nativeMasterConfig(binary) {
  const blob=fs.readFileSync(binary);
  if(crypto.createHash('sha256').update(blob).digest('hex')!==
      'e49a8cc7991f8946365a28aebad605ce566b034826dd4b34a982ab18b38303b3')
    throw new Error('Master extraction requires the untouched15.1.0 ARM64 image');
  const base=Number(blob.readBigUInt64LE(0x28)),size=blob.readUInt16LE(0x3a),count=blob.readUInt16LE(0x3c),sections=[];
  for(let i=0;i<count;i++) {
    const at=base+i*size;
    sections.push({address:Number(blob.readBigUInt64LE(at+16)),offset:Number(blob.readBigUInt64LE(at+24)),
      size:Number(blob.readBigUInt64LE(at+32))});
  }
  const bytes=(address,length)=>{
    const section=sections.find(row=>row.address<=address && address+length<=row.address+row.size);
    if(!section)throw new Error('Original master constant is unmapped');
    return blob.subarray(section.offset+address-section.address,section.offset+address-section.address+length);
  };
  const recover=(address,length,lookup,inputMask,outputMask)=>{
    const table=bytes(lookup,256);
    return Buffer.from(bytes(address,length).map(value=>(table[value^inputMask]^outputMask)&255));
  };
  return {key:recover(0x34991e3,32,0x34ebdfb,0x42,0x6e),iv:recover(0x3498030,16,0x34ebe7b,0xa8,0xdb),
    numericKey:recover(0x34a2c90,16,0x34a39ac,0x1f,0x9a)};
}

// Final-content master files are AES/zlib FlatBuffers. Numeric fields contain
// an XXTEA block (two value words plus the original byte length).
function decodeFile(wire, key, iv) {
  if (!wire.length || wire.length % 16) throw new Error('Invalid master file length');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
  decipher.setAutoPadding(false);
  return zlib.inflateSync(Buffer.concat([decipher.update(wire), decipher.final()]), { maxOutputLength: 64 * 1024 * 1024 });
}

function decodeBlock(block, key) {
  if (block.length < 8 || block.length % 4 || key.length !== 16) throw new Error('Invalid master field');
  const v = Array.from({ length: block.length / 4 }, (_, i) => block.readUInt32LE(i * 4));
  const k = [0, 4, 8, 12].map(at => key.readUInt32LE(at));
  let sum = Math.imul(6 + Math.floor(52 / v.length), 0x9e3779b9) >>> 0, y = v[0];
  const mix = (z, p, e) => (((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^
    ((sum ^ y) + (k[p & 3 ^ e] ^ z))) >>> 0;
  while (sum) {
    const e = sum >>> 2 & 3;
    for (let p = v.length - 1; p > 0; p--) y = v[p] = (v[p] - mix(v[p - 1], p, e)) >>> 0;
    y = v[0] = (v[0] - mix(v[v.length - 1], 0, e)) >>> 0;
    sum = (sum - 0x9e3779b9) >>> 0;
  }
  const length = v[v.length - 1];
  if (length < block.length - 7 || length > block.length - 4) throw new Error('Master field failed length validation');
  const plain = Buffer.alloc(block.length);
  v.forEach((word, i) => plain.writeUInt32LE(word, i * 4));
  return plain.subarray(0, length);
}

function encodeBlock(plain, key, size) {
  if (!Buffer.isBuffer(plain) || ![8,12].includes(size) || plain.length > size - 4 || key.length !== 16)
    throw new Error('Invalid master field encoding');
  const block = Buffer.alloc(size); plain.copy(block); block.writeUInt32LE(plain.length, size - 4);
  const v = Array.from({ length: size / 4 }, (_, i) => block.readUInt32LE(i * 4));
  const k = [0, 4, 8, 12].map(at => key.readUInt32LE(at));
  let rounds = 6 + Math.floor(52 / v.length), sum = 0, z = v.at(-1);
  while (rounds--) {
    sum = (sum + 0x9e3779b9) >>> 0;
    const e = sum >>> 2 & 3;
    for (let p = 0; p < v.length - 1; p++) {
      const y = v[p + 1];
      z = v[p] = (v[p] + ((((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^
        ((sum ^ y) + (k[p & 3 ^ e] ^ z))) >>> 0)) >>> 0;
    }
    const y = v[0], p = v.length - 1;
    z = v[p] = (v[p] + ((((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^
      ((sum ^ y) + (k[p & 3 ^ e] ^ z))) >>> 0)) >>> 0;
  }
  v.forEach((word, i) => block.writeUInt32LE(word, i * 4));
  return block;
}

function encodeNumber(value, type, key) {
  if (!Number.isSafeInteger(value)) throw new Error('Master numeric value exceeds safe integer range');
  const plain = Buffer.alloc(type === 'long' ? 8 : 4);
  if (type === 'long') plain.writeBigInt64LE(BigInt(value));
  else if (type === 'int') plain.writeInt32LE(value);
  else throw new Error('Unknown master numeric type');
  return encodeBlock(plain, key, type === 'long' ? 12 : 8);
}

function encodeFile(blob, key, iv) {
  const compressed = zlib.deflateSync(blob), padded = Buffer.alloc(Math.ceil(compressed.length / 16) * 16);
  compressed.copy(padded);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

function decodeNumber(block, key) {
  const plain = decodeBlock(block, key);
  if (plain.length === 1) return plain.readUInt8(0);
  if (plain.length === 4) return plain.readInt32LE(0);
  if (plain.length !== 8) throw new Error('Invalid master numeric field width');
  const value = plain.readBigUInt64LE(0);
  const signed = BigInt.asIntN(64, value);
  if (signed < BigInt(Number.MIN_SAFE_INTEGER) || signed > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Master numeric field exceeds safe integer range');
  return Number(signed);
}

function bounds(blob, at, size) {
  if (!Number.isSafeInteger(at) || at < 0 || at + size > blob.length) throw new Error('Master field exceeds file bounds');
}

function field(blob, table, index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid master field index');
  bounds(blob, table, 4);
  const vtable = table - blob.readInt32LE(table), at = 4 + index * 2;
  bounds(blob, vtable, 4);
  const size = blob.readUInt16LE(vtable);
  if (size < 4 || size % 2) throw new Error('Invalid master vtable');
  bounds(blob, vtable, size);
  const offset = at < size ? blob.readUInt16LE(vtable + at) : 0;
  if (offset) bounds(blob, table + offset, 1);
  return offset ? table + offset : null;
}

function rows(blob) {
  bounds(blob, 0, 4);
  const root = blob.readUInt32LE(0), at = field(blob, root, 0);
  if (at === null) return [];
  bounds(blob, at, 4);
  const vector = at + blob.readUInt32LE(at);
  bounds(blob, vector, 4);
  const count = blob.readUInt32LE(vector);
  if (count > blob.length / 4) throw new Error('Invalid master row count');
  bounds(blob, vector + 4, count * 4);
  return Array.from({ length: count }, (_, i) => {
    const entry = vector + 4 + i * 4;
    const table = entry + blob.readUInt32LE(entry);
    bounds(blob, table, 4);
    return table;
  });
}

function decodeTable(blob, schema, numericKey) {
  return rows(blob).map(table => Object.fromEntries(schema.flatMap((spec, index) => {
    if (spec === null) return [];
    const [name, type] = spec;
    const at = field(blob, table, index);
    if (at === null) return [[name, type === 'string' ? '' : type === 'bool' ? false : 0]];
    if (type === 'bool' || type === 'byte') {
      bounds(blob,at,8);
      const plain=decodeBlock(blob.subarray(at,at+8),numericKey);
      if (plain.length!==1 || type==='bool' && plain[0]>1) throw new Error('Invalid master byte/boolean');
      return [[name, type==='bool' ? Boolean(plain[0]) : plain[0]]];
    }
    if (type === 'int' || type === 'long' || type === 'float') {
      const size = type === 'long' ? 12 : 8;
      bounds(blob, at, size);
      if (type === 'float') {
        const plain = decodeBlock(blob.subarray(at, at + 8), numericKey);
        if (plain.length !== 4 || !Number.isFinite(plain.readFloatLE(0))) throw new Error('Invalid master float');
        return [[name, plain.readFloatLE(0)]];
      }
      return [[name, decodeNumber(blob.subarray(at, at + size), numericKey)]];
    }
    if (type !== 'string') throw new Error(`Unknown master field type ${type}`);
    bounds(blob, at, 4);
    const text = at + blob.readUInt32LE(at);
    bounds(blob, text, 4);
    const size = blob.readUInt32LE(text);
    bounds(blob, text + 4, size);
    return [[name, size ? decodeBlock(blob.subarray(text + 4, text + 4 + size), numericKey).toString('utf8').replace(/\0$/, '') : '']];
  })));
}

function gameplayData(contents, config) {
  const sources = {};
  const read = (name, schema) => {
    const relative = `1/master/divide_enc/${name}.enc`, wire = fs.readFileSync(path.join(contents, relative));
    const data = decodeTable(decodeFile(wire, config.key, config.iv), schema, Buffer.from(config.numericKey));
    sources[name] = { path: relative, sha256: crypto.createHash('sha256').update(wire).digest('hex'), rows: data.length };
    return data;
  };
  const characters = Object.fromEntries(read('character', [['id','int'], ['key','string']])
    .map(({ id, key }) => [id, { key, levels: [], rewards: [], favoriteItems: [] }]));
  const byKey = Object.fromEntries(Object.values(characters).map(row => [row.key, row]));
  const characterIdsByKey = Object.fromEntries(Object.entries(characters).map(([id, row]) => [row.key, Number(id)]));
  const communicationCharacters = Object.fromEntries(read('communicationCharacter', [['id','int'], ['key','string'],
    ['characterKey','string']]).map(({ id, key, characterKey }) => {
      if (!characterIdsByKey[characterKey]) throw new Error(`Unknown original communication character ${id}`);
      return [id, { key, characterId: characterIdsByKey[characterKey] }];
    }));
  // Gift2000/248cbb8 and shop9000/24219c4 share2505fc4. Costume gain
  // also unlocks every communicationVoice whose slot9 matches the costume
  // (23a273c ->23a483c), NOT communication-character or playable-PC records.
  const characterCostumes = Object.fromEntries(read('characterCostume',
    [['id','int'], ['characterKey','string'], null, ['name','string'], ['description','string'],null,null,null,
      ['initialUnlock','bool'],['priority','int']])
    .map(({ id, ...row }) => [id, row]));
  const communicationVoices = Object.fromEntries(read('communicationVoice',
    [['id','int'], ['communicationCharacterKey','string'], null, ['name','string'], ['friendshipLevel','int'],
      ['voiceKey','string'], null, ['kind','byte'], ['userHeroType','byte'], ['costumeId','int']]).map(({ id, ...row }) => [id, row]));
  const communicationKeys = new Set(Object.values(communicationCharacters).map(row => row.key));
  if (Object.values(characterCostumes).some(row => !characterIdsByKey[row.characterKey]) ||
      Object.values(communicationVoices).some(row => !communicationKeys.has(row.communicationCharacterKey) ||
        ![0,1,2].includes(row.kind) || ![0,1,2].includes(row.userHeroType) || row.friendshipLevel<0 ||
        row.costumeId && !characterCostumes[row.costumeId]))
    throw new Error('Invalid original costume/voice joins');
  for (const { characterKey, level, points } of read('characterFriendshipLevelStep',
    [null, ['characterKey','string'], ['level','int'], ['points','int']])) {
    if (!byKey[characterKey]) throw new Error(`Unknown friendship character ${characterKey}`);
    byKey[characterKey].levels.push([level, points]);
  }
  for (const row of Object.values(characters)) row.levels.sort((a, b) => a[0] - b[0]);
  for (const { id, characterKey, level, type, amount, itemId, userHeroType } of read('characterFriendshipReward',
    [['id','int'], ['characterKey','string'], ['level','int'], null, null,
      ['type','int'], ['amount','int'], ['itemId','int'], ['userHeroType','int']])) {
    if (!byKey[characterKey]) throw new Error(`Unknown friendship reward character ${characterKey}`);
    byKey[characterKey].rewards.push([id, level, type, amount, itemId, userHeroType]);
  }
  // Native 0x250896c checks five item/factor pairs in order, defaulting to 1.
  for (const { characterKey, ...row } of read('characterFavoriteItem', [null, ['characterKey','string'],
    ...Array.from({ length: 5 }, (_, i) => [[`item${i}`,'int'], [`factor${i}`,'float']]).flat()])) {
    if (!byKey[characterKey]) throw new Error(`Unknown favorite-item character ${characterKey}`);
    byKey[characterKey].favoriteItems = Array.from({ length: 5 }, (_, i) => [row[`item${i}`], row[`factor${i}`]])
      .filter(([id]) => id !== 0);
  }
  const cpItems = Object.fromEntries(read('cpItem', [['id','int'], ...Array(4).fill(null), ['points','int']])
    .map(({ id, points }) => [id, points]));
  const dpItems = Object.fromEntries(read('dpItem', [['id','int'], ...Array(4).fill(null), ['points','int']])
    .map(({ id, points }) => [id, points]));
  const dpLevels = read('pcDPLevelStep', [['id','int'], ['level','int'], ['points','int'],
    ['rewardType','int'], ['rewardKey','string'], ['amount','int']]).sort((a, b) => a.level - b.level);
  // The playable window uses slots 3 and 6 (native 0x2406834), not the
  // shorter competition window in slot 4 (0x24066e4).
  const shootingGames = Object.fromEntries(read('shootingGameInformation', [['id','long'], null, null,
    ['startAt','long'], ['competitionEndAt','long'], null, ['endAt','long']]).map(({ id, ...row }) => [id, row]));
  const shootingPcIds = read('shootingGamePc', [['id','long']]).map(row => row.id);
  const shootingDailyRewards=Object.fromEntries(read('shootingGameDailyRankingReward',
    [['id','long'],['infoId','long'],['startAt','long'],['endAt','long'],['minRank','int'],['maxRank','int'],
      ['itemId','int'],['amount','int']]).map(({id,...row})=>[id,row]));
  if(Object.values(shootingDailyRewards).some(row=>!shootingGames[row.infoId] || row.startAt>row.endAt ||
      row.minRank<1 || row.maxRank!==0 && row.maxRank<row.minRank || row.itemId<=0 || row.amount<=0))
    throw new Error('Invalid original shooting daily-ranking rewards');
  // DomainTakarakuji0x25aeca8 uses slots2/3 via0x2a3a5dc: start-inclusive,
  // end-exclusive. These rows contain no draw date, winning numbers or prizes.
  const takarakujiInfos = Object.fromEntries(read('takarakujiInfo',
    [['id','long'], ['name','string'], ['startAt','long'], ['endAt','long'], ['itemId','int']])
    .map(({ id, ...row }) => [id, row]));
  const takarakujiItems = Object.fromEntries(read('takarakujiItem',
    [['id','int'], ['key','string'], ['name','string'], ['description','string']])
    .map(({ id, ...row }) => [id, row]));
  const takarakujiItemIds = Object.fromEntries(Object.entries(takarakujiItems).map(([id, row]) => [row.key, Number(id)]));
  if (!Object.keys(takarakujiInfos).length || Object.values(takarakujiInfos).some(row =>
      !takarakujiItems[row.itemId] || !Number.isSafeInteger(row.startAt) || row.startAt < 0 ||
      !Number.isSafeInteger(row.endAt) || row.endAt <= row.startAt) ||
      new Set(Object.values(takarakujiInfos).map(row => row.itemId)).size !== Object.keys(takarakujiInfos).length ||
      Object.keys(takarakujiItemIds).length !== Object.keys(takarakujiItems).length)
    throw new Error('Invalid original Lotto Orario event/ticket joins');
  const consumes = Object.fromEntries(read('gamelibConsume',
    // DomainPlayerSerialPvpSp2546cbc reads slot7 for Iris recovery.
    [['id','int'], ['key','string'], null, null, null, ['amount','long'], null, ['recovery','int']])
    .map(({ id, ...row }) => [id, row]));
  const itemProfiles = {}, itemTables = {
    currency: ['UserCurrency','currencyId'], expItem: ['UserExpItem','expItemId'],
    staminaTicket: ['UserStaminaTicket','staminaTicketId'], statusBoardItem: ['UserStatusBoardItem','statusBoardItemId'],
    limitBreakItem: ['UserLimitBreakItem','limitBreakItemId'], equipmentMaterial: ['UserEquipmentMaterial','equipmentMaterialId'],
    heroSublimateItem: ['UserHeroSublimateItem','heroSublimateItemId'],
    heroSublimateUnlockItem: ['UserHeroSublimateUnlockItem','heroSublimateUnlockItemId'],
    familiaDonationItem: ['UserFamiliaDonationItem','familiaDonationItemId'], gachaTicket: ['UserGachaTicket','gachaTicketId'],
    cpItem: ['UserCpItem','cpItemId'], dpItem: ['UserDpItem','dpItemId'],
    adventureTicket: ['UserAdventureTicket','adventureTicketId'], keyItem: ['UserKeyItem','keyItemId'],
    //27d52dc/27d57b0 use native row IDs shorter than their master table names.
    equipmentEnhanceItem: ['UserEquipmentEnhanceItem','enhanceItemId'],
    equipmentEvolveItem: ['UserEquipmentEvolveItem','evolveItemId'],
    alarmVoiceItem: ['UserAlarmVoiceItem','alarmVoiceItemId'],
    generalLimitBreakItem: ['UserGeneralLimitBreakItem','limitBreakItemId'],
    eventItem: ['UserEventItem','eventItemId'], voteItem: ['UserVoteItem','voteItemId'],
    memoriaExpItem: ['UserMemoriaExpItem','memoriaExpItemId'], pcTicket: ['UserPCTicket','pcTicketId'],
    subscriptionTicket: ['UserSubscriptionTicket','subscriptionTicketId'],
    serialPvpSpTicketItem: ['UserSerialPvpSpTicketItem','ticketId'],
    unionRaidMedal: ['UserUnionRaidMedal','medalId'],
    unionRaidBossSpTicketItem: ['UserUnionRaidBossSpTicketItem','ticketId'],
    unionRaidNormalSpTicketItem: ['UserUnionRaidNormalSpTicketItem','ticketId'],
    //25d7798 reads master int32 slot0;27ddb4c uses lockAbilityId,
    //NOT lockAbilityItemId. This is ordinary additive inventory, not a ticket.
    lockAbilityItem: ['UserLockAbilityItem','lockAbilityId'],
  };
  const registerItem = (source, id, key) => {
    if (!id || !key || Object.hasOwn(itemProfiles, id)) throw new Error(`Invalid or duplicate original item ${key}`);
    const [table, idField] = itemTables[source];
    itemProfiles[id] = { table, idField };
    return [key, id];
  };
  const currencyRows = read('currency', [['id','int'], ['key','string'], ['name','string']]);
  const currencies = Object.fromEntries(currencyRows.map(({ id, key }) => registerItem('currency', id, key)));
  const items = { ...currencies };
  for (const name of ['expItem','staminaTicket','statusBoardItem','limitBreakItem','equipmentMaterial',
    'heroSublimateItem','heroSublimateUnlockItem','familiaDonationItem','gachaTicket','cpItem','dpItem',
    'adventureTicket','keyItem','equipmentEnhanceItem','equipmentEvolveItem','alarmVoiceItem','generalLimitBreakItem',
    'eventItem','voteItem','pcTicket','subscriptionTicket','lockAbilityItem','unionRaidMedal','unionRaidBossSpTicketItem','unionRaidNormalSpTicketItem']) {
    for (const { id, key } of read(name, [['id','int'], ['key','string']])) {
      const entry = registerItem(name, id, key);
      if (Object.hasOwn(items, key)) throw new Error(`Duplicate original item key ${key}`);
      items[entry[0]] = entry[1];
    }
  }
  //173a328 selects owned key-item amounts;173a530 filters master slot8.
  //Keep the feat flag separate from itemProfiles and existing reward hashes.
  const keyItems=Object.fromEntries(read('keyItem',[['id','int'],...Array(7).fill(null),['isExploit','bool']])
    .map(({id,...row})=>[id,row]));
  // Memoria EXP items put their key after the optional target memoria ID.
  for (const { id, key } of read('memoriaExpItem', [['id','int'], null, ['key','string']])) {
    const entry = registerItem('memoriaExpItem', id, key);
    if (Object.hasOwn(items, key)) throw new Error(`Duplicate original item key ${key}`);
    items[entry[0]] = entry[1];
  }
  const memoriaRows = read('memoria', [['id','int'], null, ['key','string'], null, ['groupId','int']]);
  const memorias = Object.fromEntries(memoriaRows.map(({ id, key }) => [key, id]));
  const memoriaSteps = read('memoriaEnhanceStep', [null, ['groupId','int'], ['level','int'], ['totalExp','int']]);
  // Native 0x24fbe18 converts received level to this totalExp threshold;
  // UserMemoria stores totalExp, not level (serializer 0x278ea90).
  const memoriaLevels = Object.fromEntries(memoriaRows.map(({ id, groupId }) => {
    const levels = memoriaSteps.filter(row => row.groupId === groupId).sort((a, b) => a.level - b.level);
    if (levels.length !== 6 || levels.some((row, i) => row.level !== i + 1 || row.totalExp < 0 ||
        row.totalExp < (levels[i - 1]?.totalExp ?? 0))) throw new Error(`Invalid memoria levels ${id}`);
    return [id, levels.map(row => row.totalExp)];
  }));
  const loginExplorers = Object.fromEntries(read('loginBonusExplorer', [['id','int'], ['key','string'],
    ['title','string'], ['limit','int'], ['startAt','long'], ['endAt','long'],
    ...Array.from({ length: 4 }, (_, i) => [`weight${i}`,'int'])]).map(({ id, weight0, weight1, weight2, weight3, ...row }) =>
    [id, { ...row, weights: [weight0,weight1,weight2,weight3], rewards: [] }]));
  // Native 0x23d7094 reads event slots 2/3; 0x1598464 checks character
  // slot 4 against saved currentPoint. Operation 11100 awards slot 6 once.
  const characterPresents = Object.fromEntries(read('characterPresentInfo', [['id','long'], null,
    ['startAt','long'], ['endAt','long']]).map(({ id, ...row }) => [id, { ...row, characters: [], items: [] }]));
  for (const { eventId, ...character } of read('characterPresentCharacterInfo', [['id','long'],
    ['eventId','long'], ['characterId','int'], null, ['requiredPoint','int'], null, ['rewardItemId','int']])) {
    if (!characterPresents[eventId] || !characters[character.characterId] ||
        !Object.values(items).includes(character.rewardItemId)) throw new Error(`Invalid character-present reward ${character.id}`);
    characterPresents[eventId].characters.push(character);
  }
  //23d73b8 multiplies slot3 by the selected count and consumes that many
  // copies of the original slot2 item before saving CharacterPresentUseItem.
  for (const { eventId, ...item } of read('characterPresentItemInfo', [['id','long'], ['eventId','long'],
    ['itemId','int'], ['point','int']])) {
    if (!characterPresents[eventId] || item.point <= 0 || !Number.isSafeInteger(item.point) ||
        itemProfiles[item.itemId]?.table !== 'UserEventItem' || itemProfiles[item.itemId]?.idField !== 'eventItemId')
      throw new Error(`Invalid character-present item ${item.id}`);
    characterPresents[eventId].items.push(item);
  }
  // Native 0x2321a80 uses the first active event in original repository order;
  // 0x231ff24 reads slots 2/3 as the start-inclusive/end-exclusive window.
  // Slot 5 is the once-only, client-granted ticket amount (0x1cd1b94).
  const votes = Object.fromEntries(read('voteInfo', [['id','long'], ['title','string'],
    ['startAt','long'], ['endAt','long'], ['voteItemId','int'], ['defaultItemAmount','int']])
    .map(({ id, ...row }) => [id, { ...row, candidates: [] }]));
  for (const { eventId, ...candidate } of read('voteCharacterList', [['id','long'],
    ['eventId','long'], ['characterId','int'], ['order','int']])) {
    if (!votes[eventId]) throw new Error(`Invalid vote candidate event ${candidate.id}`);
    votes[eventId].candidates.push(candidate);
  }
  for (const [id, vote] of Object.entries(votes)) {
    if (!Object.values(items).includes(vote.voteItemId) || vote.defaultItemAmount < 0 ||
        !vote.candidates.length || new Set(vote.candidates.map(row => row.id)).size !== vote.candidates.length)
      throw new Error(`Invalid original voting event ${id}`);
  }
  const explorersByKey = Object.fromEntries(Object.values(loginExplorers).map(row => [row.key, row]));
  for (const { key, ...reward } of read('loginBonusExplorerContent', [['id','int'], ['key','string'],
    ['rank','int'], ['rewardKey','string'], ['amount','int']])) {
    if (!explorersByKey[key]) throw new Error(`Unknown treasure-hunt bonus ${key}`);
    explorersByKey[key].rewards.push(reward);
  }
  const eventBoxes = Object.fromEntries(read('eventBox', [['id','int'], null, ['key','string'],
    ['costKey','string'], ['cost','int'], null, ['startAt','long'], ['endAt','long'], null, null,
    ['bonusKey','string'], ['bonusEvery','int']]).map(({ id, ...row }) => [id, { ...row, steps: [] }]));
  const boxesByKey = Object.fromEntries(Object.values(eventBoxes).map(row => [row.key, row])), boxStepsByKey = {};
  for (const { boxKey, ...step } of read('eventBoxStep', [['id','int'], ['key','string'], ['boxKey','string'],
    ['index','int'], ['repeatable','int'], ['boostAfter','int'], ['boostEnabled','int']])) {
    if (!boxesByKey[boxKey] || boxStepsByKey[step.key]) throw new Error(`Invalid original event-box step ${step.key}`);
    step.contents = []; boxStepsByKey[step.key] = step; boxesByKey[boxKey].steps.push(step);
  }
  for (const box of Object.values(eventBoxes)) box.steps.sort((a, b) => a.index - b.index);
  // Native canReset (0x2412f28) checks slot 7 against slot 6. Content UI
  // reads slot 5 as the finite-stock flag; slot 8 retains the authored weight.
  for (const { stepKey, ...content } of read('eventBoxContent', [['id','int'], ['stepKey','string'],
    ['rewardType','int'], ['rewardKey','string'], ['amount','int'], ['limited','int'], ['limit','int'],
    ['requiredForReset','int'], ['weight','int']])) {
    if (!boxStepsByKey[stepKey]) throw new Error(`Unknown original event-box content step ${stepKey}`);
    boxStepsByKey[stepKey].contents.push(content);
  }
  const achievements = Object.fromEntries(read('achievement',
    [['id','long'], null, ['category','int'], null, null, null, null, null, null, null,
      null, null, null, ['startAt','long'], ['expireAt','long'], ['rewardType','int'],
      ['rewardKey','string'], ['rewardAmount','int']]).map(({ id, ...row }) => [id, row]));
  // Native2358578/2358dcc exempt condition602 from absolute active/expiry
  // dates. Keep the classification separate from existing reward captures.
  const achievementTimeBonuses = read('achievement', [['id','long'],null,['category','int'],null,['condition','int']])
    .filter(row => row.condition === 602).map(row => {
      if (row.category !== 1 || !achievements[row.id]) throw new Error('Invalid original login-time bonus');
      return row.id;
    });
  // Familia's daily home tab is not UserAchievement/category 1. Cell
  // 0x1aee2b0 resolves these IDs through DomainFamiliaAchievementRepository.
  const familiaDailyAchievements = read('familiaAchievement', [['id','long'], null, ['recordType','int'],
    ...Array(8).fill(null), ['startAt','long'], ['expireAt','long'], ...Array(6).fill(null), ['eventId','long']])
    .filter(row => row.eventId === 0 && [301,401].includes(row.recordType))
    .map(({ eventId, ...row }) => row);
  if (!familiaDailyAchievements.length || familiaDailyAchievements.some(row => row.id <= 0 || row.startAt < 0 ||
      row.expireAt < 0 || (row.expireAt && row.expireAt < row.startAt)))
    throw new Error('Invalid original Familia daily achievements');
  //2373fc8 resolves each response ID in familiaAchievement and reads original
  //long goal slot7, title slot5, expiry slot12 and reward slots13..15.
  //Keep the complete catalog separate: existing daily/capture exports unchanged.
  const gveInformationIds=read('gveInformation',[['id','long']]).map(row=>row.id);
  const familiaMissionAchievements=read('familiaAchievement',[['id','long'],null,['recordType','int'],null,null,
    ['name','string'],null,['requiredParam','long'],null,null,null,['startAt','long'],['expireAt','long'],
    ['rewardType','int'],['rewardKey','string'],['rewardAmount','int'],null,null,null,['eventId','long']]);
  if(!gveInformationIds.length || new Set(gveInformationIds).size!==gveInformationIds.length ||
      gveInformationIds.some(id=>!Number.isSafeInteger(id) || id<=0) ||
      new Set(familiaMissionAchievements.map(row=>row.id)).size!==familiaMissionAchievements.length ||
      familiaMissionAchievements.some(row=>!Number.isSafeInteger(row.id) || row.id<=0 ||
        ![101,201,301,401].includes(row.recordType) || !Number.isSafeInteger(row.requiredParam) || row.requiredParam<=0 ||
        !Number.isSafeInteger(row.startAt) || row.startAt<0 || !Number.isSafeInteger(row.expireAt) || row.expireAt<0 ||
        row.expireAt && row.expireAt<row.startAt || row.eventId && !gveInformationIds.includes(row.eventId) ||
        !row.name || !row.rewardKey || !Number.isSafeInteger(row.rewardType) || row.rewardType<=0 ||
        !Number.isSafeInteger(row.rewardAmount) || row.rewardAmount<=0 || row.rewardAmount>0x7fffffff))
    throw new Error('Invalid original Familia event mission catalog');
  // Completion dispatch (0x2450af4) follows stage -> episode (0x2450484)
  // -> adventure (0x245c964), then reads adventure slot 2. Stage slot 5 is
  // the battle/story kind, NOT this mode; ordinary bosses can have type 12.
  const adventureTypes = Object.fromEntries(read('adventure', [['id','long'], null, ['type','int']])
    .map(({ id, type }) => [id, type]));
  //246c0c4 matches communicationCharacter.slot1 against adventure.slot5;
  //247ea14 filters dated episodes only for adventure.slot11 values3/4.
  const adventureProgression = Object.fromEntries(read('adventure',
    [['id','long'],null,['type','int'],null,null,['label','string'],...Array(5).fill(null),['episodeType','int']])
    .map(({id,...row})=>[id,row]));
  //246a2f8 resolves the entry callback's authored slot1 key, NOT slot5 grouping.
  // Keep separate so existing clear/CP graph captures keep their original hashes.
  const adventureKeys = Object.fromEntries(read('adventure',[['id','long'],['key','string']])
    .map(({id,key})=>[id,key]));
  if (Object.values(adventureKeys).some(key=>typeof key!=='string' || !key) ||
      new Set(Object.values(adventureKeys)).size!==Object.keys(adventureKeys).length)
    throw new Error('Invalid original adventure entry identities');
  const pvbWindows = Object.fromEntries(read('adventure', [['id','long'], null, ['type','int'], null, null, null,
    ['window6','long'], ['window7','long'], ['window8','long'], ['window9','long']])
    .filter(row => row.type === 15).map(({ id, type, ...row }) => [id, row]));
  const familiaBattleWindows = Object.fromEntries(read('adventure', [['id','long'],null,['type','int'],null,null,null,
    ['window6','long'],['window7','long'],['window8','long'],['window9','long']])
    .filter(row=>[19,20,22,28].includes(row.type)).map(({id,...row})=>[id,row]));
  const gveEvents = Object.fromEntries(read('gveInformation', [['id','long'],['key','string'],['adventureId','long'],['name','string'],
    ['episodeId','long'],['staminaEnabled','bool'],
    ['weekday','int'],['slot7','int'],['slot8','int'],['slot9','int']])
    .map(({id,...row})=>{
      const window=familiaBattleWindows[row.adventureId];
      if(!window || ![19,20].includes(window.type) || window.window6<0 ||
          window.window7 && window.window7<window.window6 ||
          (window.type===19 ? !Number.isInteger(row.weekday) || row.weekday<1 || row.weekday>7 : row.weekday!==0) ||
          (window.type===19 ? row.staminaEnabled || row.episodeId<=0 : !row.staminaEnabled || row.episodeId!==0) ||
          ![row.slot7,row.slot8,row.slot9].every(n=>Number.isInteger(n) && n>=0))
        throw new Error('Invalid original GVE event window');
      return [id,{...row,dailySP:row.slot9,...window}];
    }));
  //14df658 joins type28 Adventure slots8/9;253f1e0/2547d74 read information slots6..9.
  const unionRaidInformationRows=read('unionRaidInformation',
    [['id','int'],['key','string'],['adventureId','long'],['name','string'],null,null,
      ['bossDailySP','int'],['normalInitialSP','int'],['normalMaximumSP','int'],['normalSeconds','int'],
      ...Array(16).fill(null),['defeatCountRewardGroupId','int']]),
    unionRaidEvents=Object.fromEntries(unionRaidInformationRows.map(({id,bossDailySP,normalInitialSP,normalMaximumSP,normalSeconds,
      defeatCountRewardGroupId,...row})=>{
      const window=familiaBattleWindows[row.adventureId];
      if(!window || window.type!==28 || window.window6<=0 || window.window7<=window.window6 ||
          window.window8<=0 || window.window9<=window.window8)
        throw new Error('Invalid original Union Raid Adventure calendar join');
      return [id,{...row,...window}];
    })),unionRaidAttemptRules=Object.fromEntries(unionRaidInformationRows.map(({id,bossDailySP,normalInitialSP,normalMaximumSP,normalSeconds})=>{
      if(![bossDailySP,normalInitialSP,normalMaximumSP,normalSeconds].every(value=>Number.isSafeInteger(value) && value>0 && value<=0x7fffffff) ||
          normalInitialSP>normalMaximumSP)
        throw new Error('Invalid original Union Raid attempt rules');
      return [id,{bossDailySP,normalInitialSP,normalMaximumSP,normalSeconds}];
    })),unionRaidDefeatCountRewardGroupByInformation=Object.fromEntries(unionRaidInformationRows
      .map(({id,defeatCountRewardGroupId})=>[id,defeatCountRewardGroupId]));
  //1515d58 uses the selected count directly for SP and ticket spending; do not guess a multiplier from another item slot.
  const unionRaidTickets=Object.fromEntries(['boss','normal'].flatMap(family=>{
    const name=family==='boss'?'unionRaidBossSpTicketItem':'unionRaidNormalSpTicketItem',
      table=family==='boss'?'UserUnionRaidBossSpTicketItem':'UserUnionRaidNormalSpTicketItem';
    return read(name,[['id','int'],['key','string']]).map(({id,key})=>[id,{family,table,key}]);
  }));
  const unionRaidDefeatRewards=read('unionRaidDefeatReward',[['id','int'],['key','string']]);
  if(!require('node:util').isDeepStrictEqual(unionRaidDefeatRewards,[{id:418000001,key:''}]))
    throw new Error('Invalid original Union Raid defeat-reward catalog');
  const unionRaidDefeatCountRewardGroups=read('unionRaidDefeatCountRewardGroup',[['id','int']]),
    unionRaidDefeatCountRewards=read('unionRaidDefeatCountReward',
      [['id','int'],['groupId','int'],['defeatCount','int'],['itemId','int'],['amount','int']]),
    expectedUnionRaidDefeatCountRewards=[
      [1,205000002,50000],[1,32000001,20],[2,295000001,2],[2,32000001,20],
      [3,98000001,1],[3,215000001,2],[4,205000002,50000],[4,32000001,20],
      [5,295000001,3],[5,32000001,20],[6,98000001,1],[6,215000003,2],
      [7,205000002,100000],[7,32000001,20],[8,295000001,3],[8,32000002,10],
      [9,99000001,2],[9,215000005,2],[10,205000002,100000],[10,32000002,20],
      [11,295000001,3],[11,32000002,20],[12,99000001,2],[12,215000001,5],
      [13,205000002,100000],[13,32000002,20],[14,295000001,3],[14,32000002,20],
      [15,99000001,2],[15,215000003,5],[16,205000002,200000],[16,32000003,10],
      [17,295000001,3],[17,32000003,20],[18,99000001,2],[18,215000005,5],
      [19,295000001,3],[19,32000003,20],[20,99000001,2],[20,32000003,20],
      [21,205000002,200000],[21,215000001,1],[21,215000003,1],[21,215000005,1],
    ].map(([defeatCount,itemId,amount],index)=>({id:417000001+index,groupId:418000001,defeatCount,itemId,amount}));
  if(!require('node:util').isDeepStrictEqual(unionRaidDefeatCountRewardGroups,[{id:418000001}]) ||
      unionRaidDefeatCountRewardGroupByInformation[413000001]!==418000001 ||
      !require('node:util').isDeepStrictEqual(unionRaidDefeatCountRewards,expectedUnionRaidDefeatCountRewards) ||
      unionRaidDefeatCountRewards.some(row=>!Object.values(items).includes(row.itemId)))
    throw new Error('Invalid original Union Raid defeat-count reward catalog or information join');
  //248841c resolves every status/log row through this catalog. Slot1 selects
  //the total/enemy stream, slot2 is its cumulative score threshold, and
  //types2..4 interpolate the enemy label into the authored message.
  const unionRaidLogGroups=read('unionRaidLogGroup',[['id','int']]),
    unionRaidLogs=read('unionRaidLog',[['id','int'],['type','int'],['score','int'],['message','string'],
      ['key','string'],['groupId','int']]),
    unionRaidLogScores=[500000,1000000,1500000,3000000,5000000,7500000,10000000,
      ...Array(3).fill([150000,300000,500000,1000000,1500000,2500000,3000000]).flat()];
  if(!require('node:util').isDeepStrictEqual(unionRaidLogGroups,[{id:432000001}]) ||
      unionRaidLogs.length!==28 || unionRaidLogs.some((row,index)=>row.id!==433000001+index ||
        row.type!==Math.floor(index/7)+1 || row.score!==unionRaidLogScores[index] || row.groupId!==432000001 ||
        row.key!=='' || row.message!==(row.type===1?'Total Score\nOver {0}!':'{1}\nTotal Score\nOver {0}!')))
    throw new Error('Invalid original Union Raid log catalog');
  //shortcut: only captured Presents support ticket acquisition; other rewards and event resets need their original producers.
  //25455e0/25451cc/2545468 bind slots4/5/6 to the original attempt rules.
  const guildRaidInformationRows=read('guildRaidInformation',
    [['id','long'],['key','string'],['adventureId','long'],['name','string'],
      ['dailySP','int'],['normalSPRecoveryLimit','int'],['normalSPCost','int']]);
  const guildRaidEvents=Object.fromEntries(guildRaidInformationRows
    .map(({id,dailySP,normalSPRecoveryLimit,normalSPCost,...row})=>{
      const window=familiaBattleWindows[row.adventureId];
      if(!window || window.type!==22 || window.window6<=0 || window.window7<=window.window6)
        throw new Error('Invalid original Familia raid event window');
      return [id,{...row,...window}];
    }));
  //Separate rules preserve existing event/stage hashes in retained training receipts.
  const guildRaidAttemptRules=Object.fromEntries(guildRaidInformationRows
    .map(({id,dailySP,normalSPRecoveryLimit,normalSPCost})=>{
      if(![dailySP,normalSPRecoveryLimit,normalSPCost].every(value=>Number.isSafeInteger(value) && value>0 && value<=0x7fffffff))
        throw new Error('Invalid original Familia raid attempt rules');
      return [id,{dailySP,normalSPRecoveryLimit,normalSPCost}];
    }));
  //246c564 reads slot7 as float32 for ordinary-SP recovery during Familia hours.
  //Separate projection leaves the existing event and attempt-capture hashes intact.
  const guildRaidStaminaMultipliers=Object.fromEntries(read('guildRaidInformation',
    [['id','long'],...Array(6).fill(null),['multiplier','float']]).map(({id,multiplier})=>{
      if(!guildRaidEvents[id] || !Number.isFinite(multiplier) || multiplier<=0)
        throw new Error('Invalid original Familia raid stamina multiplier');
      return [id,multiplier];
    }));
  //156d43c reads the five authored HP fields (FBS offsets14..1c, slots8..12)
  //and wire enemyIndex0..4.23a9ef0 imports HP as int32, while the UI sums int64.
  //Keep unrecovered selector columns named by slot, not guessed tier semantics.
  const guildRaidStageRows=read('guildRaidStage',
    [['id','long'],['guildRaidInformationId','long'],['slot2','int'],['slot3','int'],['slot4','long'],
      ['adventureStageId','long'],null,['name','string'],...Array.from({length:5},(_,i)=>[`hp${i}`,'int']),
      ['defeatRewardId','long']]);
  const guildRaidStages=Object.fromEntries(guildRaidStageRows
    .map(({id,defeatRewardId,hp0,hp1,hp2,hp3,hp4,...row})=>{
      if(!guildRaidEvents[row.guildRaidInformationId] || ![row.slot2,row.slot3,row.slot4].every(n=>Number.isSafeInteger(n) && n>=0) ||
          ![hp0,hp1,hp2,hp3,hp4].every(n=>Number.isSafeInteger(n) && n>=0 && n<=0x7fffffff) ||
          ![hp0,hp1,hp2,hp3,hp4].some(n=>n>0))
        throw new Error('Invalid original Familia raid stage/boss metadata');
      return [id,{...row,bossHp:[hp0,hp1,hp2,hp3,hp4]}];
    }));
  //23aa998 and157412c look up defeatRewardId:int64, then the five signed
  //int32 item/amount pairs at FBS offsets8..1a. Only positive pairs are granted.
  const guildRaidDefeatRewards=Object.fromEntries(read('guildRaidDefeatReward',
    [['id','long'],null,...Array.from({length:5},(_,i)=>[[`item${i}`,'int'],[`amount${i}`,'int']]).flat()])
    .map(row=>{
      const items=Array.from({length:5},(_,i)=>({itemId:row[`item${i}`],amount:row[`amount${i}`]}))
        .filter(item=>item.itemId>0 && item.amount>0);
      if(!Number.isSafeInteger(row.id) || row.id<=0 || items.some(item=>!itemProfiles[item.itemId]))
        throw new Error('Invalid original Familia raid defeat-reward items');
      return [row.id,{items}];
    }));
  //1570edc selects original stages;15704a0 reads FBS1e/slot13 and deduplicates rewards.
  //Separate links preserve existing stage-catalog hashes in captured training receipts.
  const guildRaidStageDefeatRewards=Object.fromEntries(guildRaidStageRows.map(({id,defeatRewardId})=>{
    if(!Number.isSafeInteger(defeatRewardId) || !guildRaidDefeatRewards[defeatRewardId])
      throw new Error('Invalid original Familia raid stage defeat-reward link');
    return [id,defeatRewardId];
  }));
  const episodeAdventures = Object.fromEntries(read('adventureEpisode', [['id','long'], null, ['adventureId','long']])
    .map(({ id, adventureId }) => [id, adventureId]));
  //245d164/247ec14 find the next episode by parent adventure and slot3 index.
  const episodeProgression = Object.fromEntries(read('adventureEpisode',
    [['id','long'],null,['adventureId','long'],['index','int']]).map(({id,...row})=>[id,row]));
  //246c428 reads adventureStage slot16 before loot, then applies the
  // float32 equipment multiplier and signed-int32 skip multiplication.
  const originalStages = read('adventureStage',
    [['id','long'], ['episodeId','long'], ...Array(3).fill(null), ['type','int'], ...Array(10).fill(null),
      ['experience','int'],null,['rewardType','int'], ['rewardKey','string'], ['rewardAmount','int'],
      ['sRewardType','int'],['sRewardKey','string'],['sRewardAmount','int']]);
  //1d16f04 reads slots22/23 for the separate S-clear reward;1d192c0
  //renders it only after three objectives are complete (states1 or2).
  //Keep this separate so existing stage/progression captures remain unchanged.
  const stageSRewards=Object.fromEntries(originalStages.map(({id,sRewardType,sRewardKey,sRewardAmount})=>
    [id,{rewardType:sRewardType,rewardKey:sRewardKey,rewardAmount:sRewardAmount}]));
  const stageExperience = Object.fromEntries(originalStages.map(({id,experience})=>[id,experience]));
  if (Object.values(stageExperience).some(value=>!Number.isSafeInteger(value) || value<0 || value>0x7fffffff))
    throw new Error('Original stage player experience requires recovery');
  //246c564 uses slot6 cost and the encrypted slot47 enable byte, not slot16 XP.
  const stageRaidStamina=Object.fromEntries(read('adventureStage',
    [['id','long'],...Array(5).fill(null),['stamina','int'],...Array(40).fill(null),['enabled','bool']])
    .map(({id,...row})=>{
      if(!Number.isSafeInteger(row.stamina) || row.stamina<0 || row.stamina>0x7fffffff ||
          typeof row.enabled!=='boolean' || !Object.hasOwn(stageExperience,id))
        throw new Error('Invalid original stage raid-stamina rules');
      return [id,row];
    }));
  //2452d30/2480344 select the next stage by its authored slot3 index in
  // the same episode, not by arithmetic on its ID.2452e28 reads slot14.
  const stageProgression = Object.fromEntries(read('adventureStage',
    [['id','long'],['episodeId','long'],null,['index','int'],['level','int'],...Array(9).fill(null),
      ['unlockCondition','int']]).map(({id,...row})=>[id,row]));
  //2452e28 condition9 reads the exact prerequisite stage through vtable0x50
  // (slot38), not an arithmetic normal-difficulty counterpart.
  const stageUnlocks = Object.fromEntries(read('adventureStage',
    [['id','long'],...Array(14).fill(null),['value','int'],...Array(22).fill(null),['targetId','long']])
    .map(({id,...row})=>[id,row]));
  //1d48dcc matches encrypted stage slot7; featureLock slots2/3 bind the
  //actual prerequisite stage key to the original system-flag key.
  const stageKeys=Object.fromEntries(read('adventureStage',
    [['id','long'],...Array(6).fill(null),['key','string']]).map(({id,key})=>[id,key]));
  const featureUnlocks=read('featureLock',[null,null,['stageKey','string'],['flagKey','string']]);
  // Retain authored empty/duplicate keys; consumers must resolve the actual
  // native first-match lookup, not require an invented archive-wide uniqueness.
  if (Object.values(stageKeys).some(key=>typeof key!=='string') ||
      featureUnlocks.some(row=>typeof row.stageKey!=='string' || typeof row.flagKey!=='string'))
    throw new Error('Invalid original stage/feature-unlock keys');
  const stages = Object.fromEntries(originalStages
    .map(({ id, episodeId, experience, sRewardType, sRewardKey, sRewardAmount, ...row }) => {
      const adventureType = adventureTypes[episodeAdventures[episodeId]];
      if (!Number.isSafeInteger(adventureType) || adventureType < 1 || adventureType > 28)
        throw new Error(`Unknown original adventure mode for stage ${id}`);
      return [id, { ...row, adventureType }];
    }));
  const adventureRaids=Object.fromEntries(read('adventureRaid', [['id','int'],['slot1','long'],['slot2','long'],
    ['startAt','long'],['endAt','long']]).map(({id,...row})=>[id,row]));
  const adventureRaidGroups=Object.fromEntries(read('adventureRaidGroup', [['id','int'],['name','string'],
    ['raidId','int'],['startAt','long'],['endAt','long']]).map(({id,...row})=>[id,row]));
  const adventureRaidParts=Object.fromEntries(read('adventureRaidPart', [['id','int'],['groupId','int'],['order','int'],
    ['hp','long'],['slot4','int'],['slot5','int'],['slot6','long'],['appearLwf','string'],['completeLwf','string']])
    .map(({id,...row})=>[id,row]));
  const adventureRaidPartStages=Object.fromEntries(read('adventureRaidPartStage', [['id','int'],['partId','int'],
    ['stageId','long'],['slot3','int'],['slot4','int'],['slot5','long']]).map(({id,...row})=>[id,row]));
  const adventureRaidPartStageRows=Object.values(adventureRaidPartStages);
  if(Object.keys(adventureRaids).length!==1 || Object.keys(adventureRaidGroups).length!==5 ||
      Object.keys(adventureRaidParts).length!==7 || Object.keys(adventureRaidPartStages).length!==45 ||
      Object.entries(adventureRaidGroups).some(([,row])=>!adventureRaids[row.raidId] || row.startAt<adventureRaids[row.raidId].startAt ||
        row.endAt>adventureRaids[row.raidId].endAt || row.startAt>row.endAt) ||
      Object.values(adventureRaidParts).some(row=>!adventureRaidGroups[row.groupId] || row.order<1 || row.hp<0 ||
        row.slot4<0 || row.slot5<0 || row.slot6<0 || typeof row.appearLwf!=='string' || typeof row.completeLwf!=='string') ||
      adventureRaidPartStageRows.some(row=>!adventureRaidParts[row.partId] || stages[row.stageId]?.adventureType!==17 ||
        row.slot3<0 || row.slot4<0 || row.slot5<=0) ||
      new Set(adventureRaidPartStageRows.map(row=>`${row.partId}:${row.stageId}`)).size!==adventureRaidPartStageRows.length ||
      Object.keys(adventureRaidParts).some(id=>!adventureRaidPartStageRows.some(row=>row.partId===Number(id))))
    throw new Error('Invalid original Adventure raid catalog');
  const stageTasks = Object.fromEntries(read('adventureStageTask',
    [['id','long'], ['stageId','long'], ...Array(9).fill(null), ['rewardType','int'], ['rewardKey','string'], ['rewardAmount','int']])
    .map(({ id, ...row }) => [id, row]));
  // 0x1c19ae0 selects base.slot1=1 (not Score.baseId), then scales its
  // S/A/B/C thresholds with float32 Score.slot3 and truncates toward zero.
  const pveBases = read('adventureStageScoreBase', [['id','long'], ['selector','int'],
    ['s','int'], ['a','int'], ['b','int'], ['c','int']]).filter(row => row.selector === 1);
  if (pveBases.length !== 1) throw new Error('Ambiguous original PVE score base');
  const pveScoreBase = pveBases[0];
  const pveScores = Object.fromEntries(read('adventureStageScore', [['id','long'], ['stageId','long'],
    ['baseId','long'], ['multiplier','float'], ...['c','b','a','s'].flatMap(rank =>
      [[`${rank}Type`,'int'], [`${rank}Key`,'string'], [`${rank}Amount`,'int']])])
    .map(({ id, stageId, baseId, multiplier, ...row }) => {
      if (stages[stageId]?.adventureType !== 12 || !Number.isFinite(multiplier) || multiplier <= 0)
        throw new Error(`Invalid original PVE score stage ${stageId}`);
      const rewards = Object.fromEntries(['c','b','a','s'].map(rank => [rank, {
        rewardType: row[`${rank}Type`], rewardKey: row[`${rank}Key`], rewardAmount: row[`${rank}Amount`],
        threshold: Math.trunc(Math.fround(Math.fround(pveScoreBase[rank]) * multiplier)),
      }]));
      return [stageId, { id, baseId, multiplier, rewards }];
    }));
  // Score slots16..21 are deliberately not assigned guessed formula meanings.
  const pvbEvents = Object.fromEntries(read('pvbInformation', [['id','long'], ['key','string'], ['adventureId','long'],
    ['slot3','int'], ['name','string'], ['art5','string'], ['art6','string']]).map(({ id, ...row }) => {
      const windows = pvbWindows[row.adventureId];
      if (!windows || windows.window6 < 0 || windows.window7 < windows.window6 || windows.window9 < windows.window7)
        throw new Error(`Invalid original PvB event windows ${id}`);
      return [id, { ...row, ...windows }];
    }));
  // Original listeners2123e78/21242e8/21269dc consume the event-key
  // cumulative, threshold-completion and active-event cumulative rules.
  const pvbEventKeys=new Set(Object.values(pvbEvents).map(row=>row.key));
  const pvbAchievementRules=Object.fromEntries(read('achievement', [['id','long'],null,['category','int'],null,
    ['conditionType','int'],null,null,null,null,['requiredParam','int'],['selector','string'],
    ['scoreThreshold','int'],null,['startAt','long'],['expireAt','long'],...Array(5).fill(null),['resetType','int']])
    .filter(row=>[1201,1202,1203].includes(row.conditionType)).map(({id,...row})=>{
      const dated=Number.isSafeInteger(row.startAt) && row.startAt>=0 && Number.isSafeInteger(row.expireAt) &&
        row.expireAt>=0 && (!row.expireAt || row.expireAt>=row.startAt),
        eventThreshold=row.conditionType===1201 && row.category===3 && pvbEventKeys.has(row.selector) &&
          row.requiredParam===1 && row.scoreThreshold>0,
        eventCumulative=row.conditionType===1202 && row.category===3 && pvbEventKeys.has(row.selector) &&
          row.requiredParam>0 && row.scoreThreshold===0,
        activeCumulative=row.conditionType===1203 && row.category===5 && row.selector==='' &&
          row.requiredParam===1 && row.scoreThreshold>0;
      if(!achievements[id] || row.resetType!==0 || !dated || !(eventThreshold || eventCumulative || activeCumulative))
        throw new Error(`Invalid original PvB achievement rule ${id}`);
      return [id,row];
    }));
  if(Object.values(pvbAchievementRules).filter(row=>row.conditionType===1201).length!==1377 ||
      Object.values(pvbAchievementRules).filter(row=>row.conditionType===1202).length!==2214 ||
      Object.values(pvbAchievementRules).filter(row=>row.conditionType===1203).length!==4)
    throw new Error('Incomplete original PvB achievement rules');
  const pvbStages = Object.fromEntries(read('pvbStage', [['id','long'], ['pvbId','long'], ['adventureStageId','long'],
    ['difficulty','int'], ['slot4','long'], ['slot5','int'], ['slot6','float']]).map(({ id, ...row }) => {
      if (!pvbEvents[row.pvbId] || stages[row.adventureStageId]?.adventureType !== 15 || row.difficulty < 1 || row.difficulty > 7)
        throw new Error(`Invalid original PvB stage ${id}`);
      return [id, row];
    }));
  const pvbSurvivalBonuses = read('pvbSurvivalBonusTable', [['id','long'], ['selector','long'],
    ['value','int'], ['slot3','int'], ['slot4','int']]);
  //217cc34 matches original GVE slot2 to the adventure stage. Retain raw
  //coefficient slots: their publisher formula has not been recovered.
  const gveStages = Object.fromEntries(read('gveStage', [['id','long'],['gveId','long'],['adventureStageId','long'],
    ['slot3','int'],['slot4','int'],['slot5','float'],['slot6','int'],['slot7','int'],['slot8','float'],['slot9','int']])
    .map(({id,...row})=>{
      if(!gveEvents[row.gveId] || stages[row.adventureStageId]?.adventureType!==gveEvents[row.gveId].type ||
          ![row.slot5,row.slot8].every(n=>Number.isFinite(n) && n>=0) ||
          ![row.slot6,row.slot7,row.slot9].every(n=>Number.isInteger(n) && n>=0))
        throw new Error('Invalid original GVE stage join/coefficient');
      return [id,row];
    }));
  const gveTurnBonuses=read('gveDefeatTurnBonus',
    [['id','long'],['selector','int'],['value','int'],['turnThreshold','int']]);
  const gveActionBonuses=read('gveActionCountBonus',
    [['id','long'],['selector','int'],['value','float'],['actionThreshold','int']]);
  const gveActionValues=new Map();
  for(const row of gveActionBonuses) {
    if(row.selector<=0 || row.actionThreshold<1) throw new Error('Invalid original GVE action bonus identity');
    const key=`${row.selector}:${row.actionThreshold}`,prior=gveActionValues.get(key);
    if(prior!==undefined && prior!==row.value) throw new Error('Conflicting original GVE action bonus duplicate');
    gveActionValues.set(key,row.value);
  }
  if(new Set(Object.values(gveStages).map(row=>row.adventureStageId)).size!==Object.keys(gveStages).length ||
      [...gveTurnBonuses,...gveActionBonuses].some(row=>!Number.isFinite(row.value) || row.value<0) ||
      Object.values(gveStages).some(row=>row.slot9!==0 && !gveActionBonuses.some(action=>action.selector===row.slot9)))
    throw new Error('Invalid original GVE scoring catalog');
  const pvbGrades = Object.fromEntries(read('pvbGrade', [['id','long'], ['key','string'], ['pvbId','long'],
    ['slot3','int'], ['slot4','int'], ['art','string']]).map(({ id, ...row }) => {
      if (!pvbEvents[row.pvbId] || row.slot3 < 1 || row.slot4 && row.slot4 < row.slot3)
        throw new Error(`Invalid original PvB grade ${id}`);
      return [id, row];
    }));
  //1c3a24c/1c3b230 filter long slot1 by season, int32 slots2/3
  //become the rank range;1c366d0 displays maxRank0 as an open-ended range.
  //Five int32 item-ID/count pairs slots4..13 resolve via raw24e3a5c.
  //Unknown slot0 stays absent; do not change existing scoring catalogs.
  const pvbRankingRewards=Object.fromEntries(['group','total'].map(kind=>{
    const name=kind==='group'?'pvbGroupRankingReward':'pvbTotalRankingReward',grouped={};
    const schema=[null,['pvbId','long'],['minRank','int'],['maxRank','int'],
      ...Array.from({length:5},(_,i)=>[[`itemId${i}`,'int'],[`amount${i}`,'int']]).flat()];
    for(const row of read(name,schema)) {
      if(!pvbEvents[row.pvbId] || !Number.isInteger(row.minRank) || row.minRank<1 || row.minRank>0x7fffffff ||
        !Number.isInteger(row.maxRank) || row.maxRank<0 || row.maxRank>0x7fffffff || row.maxRank && row.maxRank<row.minRank ||
        !Array.from({length:5},(_,i)=>i).every(i=>Number.isInteger(row[`itemId${i}`]) && row[`itemId${i}`]>=0 &&
          row[`itemId${i}`]<=0x7fffffff && Number.isInteger(row[`amount${i}`]) && row[`amount${i}`]>=0 && row[`amount${i}`]<=0x7fffffff &&
          Boolean(row[`itemId${i}`])===Boolean(row[`amount${i}`]) && (!row[`itemId${i}`] || itemProfiles[row[`itemId${i}`]])))
        throw new Error('Invalid original PvB rank prize range/items');
      (grouped[row.pvbId] ??= []).push({minRank:row.minRank,maxRank:row.maxRank,
        rewards:Array.from({length:5},(_,i)=>i).filter(i=>row[`itemId${i}`])
          .map(i=>({itemId:row[`itemId${i}`],amount:row[`amount${i}`]}))});
    }
    return [kind,grouped];
  }));
  if (new Set(Object.values(pvbStages).map(row => row.adventureStageId)).size !== Object.keys(pvbStages).length ||
      pvbSurvivalBonuses.some(row => row.slot3 < 0 || row.slot4 < row.slot3 || row.value < 0))
    throw new Error('Invalid original PvB joins/bonus intervals');
  // Summary callback0x25d2580 rebuilds only the requested event. Its stage
  // selector0x25d15e8 matches stage.slot1; difficulty.slot2 identifies the
  // adventureStageId consumed by0x25d00f4/0x25d015c. Export joins, not a
  // guessed score formula or server-authored rewards.
  const elementEventInfoIds = read('elementEventInformation', [['id','long']]).map(row => row.id);
  const elementEventStages = Object.fromEntries(read('elementEventStage',
    [['id','long'], ['infoId','long'], ['index','int'], ['name','string'], ['rewardGroupId','long'],
      ['startAt','long'], ['endAt','long'], ['key','string']]).map(({ id, ...row }) => [id, row]));
  const elementEventStageInfos = Object.fromEntries(Object.entries(elementEventStages).map(([id, row]) => [id, row.infoId]));
  const elementEventDifficulties = Object.fromEntries(read('elementEventStageDifficulty',
    [['id','long'], ['stageId','long'], ['adventureStageId','long']]).map(({ id, stageId, adventureStageId }) => {
      const infoId = elementEventStageInfos[stageId];
      if (!elementEventInfoIds.includes(infoId) || !stages[adventureStageId] ||
          ![26,27].includes(stages[adventureStageId].adventureType))
        throw new Error(`Invalid original element-event difficulty ${id}`);
      return [id, { infoId, adventureStageId }];
    }));
  // Raw slots are retained without claiming recovered publisher arithmetic.
  // The offline completion policy names its own uses of these authored values.
  const elementEventScoring = Object.fromEntries(read('elementEventStageDifficulty',
    [['id','long'], ['stageId','long'], ['adventureStageId','long'], ['difficulty','int'], ['slot4','int'],
      ['slot5','float'], ['slot6','int'], ['slot7','int'], ['slot8','float'], ['slot9','int'],
      ['slot10','int'], ['slot11','float']]).map(({ id, ...row }) => [id, row]));
  const elementEventTurnBonuses = read('elementEventDefeatTurnBonus',
    [['id','long'], ['selector','int'], ['value','int'], ['turnThreshold','int']]);
  const elementEventActionBonuses = read('elementEventActionCountBonus', []);
  if (elementEventActionBonuses.length) throw new Error('Unexpected original element action-bonus schema');
  if (new Set(Object.values(elementEventScoring).map(row => row.adventureStageId)).size !== Object.keys(elementEventScoring).length ||
      Object.values(elementEventStages).some(row => !elementEventInfoIds.includes(row.infoId) ||
        row.startAt < 0 || row.endAt < row.startAt)) throw new Error('Invalid original element completion joins/windows');
  //197c224 selects stage.long slot4 (rewardGroupId), NOT an element/stage/event ID,
  //against reward.long slot1.197b280 reads int32 rank slots2/3 and five
  //int32 item-ID/count pairs4..13 through the actual item registry raw24e3a5c.
  //Unknown slot0 stays absent; original row/pair order is retained.
  const elementRankingRewards={},rewardGroups=new Set(Object.values(elementEventStages).map(row=>row.rewardGroupId));
  for(const row of read('elementEventScoreRankingReward',[null,['rewardGroupId','long'],['minRank','int'],['maxRank','int'],
      ...Array.from({length:5},(_,i)=>[[`itemId${i}`,'int'],[`amount${i}`,'int']]).flat()])) {
    if(!rewardGroups.has(row.rewardGroupId) || !Number.isInteger(row.minRank) || row.minRank<1 || row.minRank>0x7fffffff ||
        !Number.isInteger(row.maxRank) || row.maxRank<0 || row.maxRank>0x7fffffff || row.maxRank && row.maxRank<row.minRank ||
        !Array.from({length:5},(_,i)=>i).every(i=>Number.isInteger(row[`itemId${i}`]) && row[`itemId${i}`]>=0 &&
          row[`itemId${i}`]<=0x7fffffff && Number.isInteger(row[`amount${i}`]) && row[`amount${i}`]>=0 && row[`amount${i}`]<=0x7fffffff &&
          Boolean(row[`itemId${i}`])===Boolean(row[`amount${i}`]) && (!row[`itemId${i}`] || itemProfiles[row[`itemId${i}`]])))
      throw new Error('Invalid original element rank prize selector/range/items');
    (elementRankingRewards[row.rewardGroupId] ??= []).push({minRank:row.minRank,maxRank:row.maxRank,
      rewards:Array.from({length:5},(_,i)=>i).filter(i=>row[`itemId${i}`])
        .map(i=>({itemId:row[`itemId${i}`],amount:row[`amount${i}`]}))});
  }
  if([...rewardGroups].some(id=>!elementRankingRewards[id]?.length)) throw new Error('Missing original element rank prize group');
  for(const tiers of Object.values(elementRankingRewards)) if(tiers.some((tier,i)=>!tier.rewards.length ||
      tier.minRank!==(i?tiers[i-1].maxRank+1:1) || (tier.maxRank===0)!==(i===tiers.length-1)))
    throw new Error('Invalid original element rank prize coverage');
  // DomainExpeditionStage::userData/changeState (0x2301e24, 0x2303164):
  // master initialState 0 starts at completionState 2; 2 starts locked at 1.
  const expeditionStages = Object.fromEntries(read('expeditionStage',
    [['id','int'], ...Array(5).fill(null), ['startAt','long'], ['endAt','long'],
      ['duration','int'], ['successRewardGroupId','int'], ['greatRewardGroupId','int'],
      ['failureRewardGroupId','int'], null, ['requiredStatus','int'], ['requiredLevel','int'],
      ['conditionGroupId','int'], ['initialState','int'], ['stageTextId','int'], null,
      ['additionalRewardGroupId','int']])
    .map(({ id, ...row }) => [id, row]));
  //2302b78/2302ea4/230afe0: slot2 is the requested state change,
  // slot3 the requirement type, slot4 its count or predecessor stage.
  // Retain empty arrays explicitly: an absent provider is not "no rules".
  const expeditionStageRequirements = Object.fromEntries(Object.keys(expeditionStages).map(id=>[id,[]]));
  for (const { id,stageId,...row } of read('expeditionStageRequirement',
    [['id','int'],['stageId','int'],['changeState','int'],['type','int'],['value','int']])) {
    if (!stageId) {
      if (Object.values(row).some(n=>n!==0)) throw new Error(`Unknown unused dispatch requirement ${id}`);
      continue;
    }
    if (!expeditionStages[stageId] || !((row.changeState===0 && row.type===2 && row.value>0) ||
        (row.changeState===2 && row.type===1 && expeditionStages[row.value])))
      throw new Error(`Original dispatch requirement requires recovery ${id}`);
    expeditionStageRequirements[stageId].push({ id,...row });
  }
  const expeditionConditions = {};
  for (const { groupId, ...row } of read('expeditionCondition',
    [['id','int'], ['groupId','int'], ['type','int'], ['characterId','int'], ['unknown4','int'],
      ['requiredStatus','int'], ['requiredLevel','int'], ['weight','int'], ['unknown8','int']]))
    (expeditionConditions[groupId] ??= []).push(row);
  const expeditionRewardGroups = Object.fromEntries(read('expeditionRewardGroup',
    [['id','int'], ['experience','int'], ['friendship','int'], ['unknown3','int'], ['unknown4','int']])
    .map(({ id, ...row }) => [id, { ...row, counts: [], rewards: [] }]));
  for (const { groupId, ...row } of read('expeditionRewardCount',
    [['id','int'], ['groupId','int'], ['weight','int'], ['count','long']])) {
    if (!expeditionRewardGroups[groupId]) throw new Error(`Unknown expedition count group ${groupId}`);
    expeditionRewardGroups[groupId].counts.push(row);
  }
  for (const { groupId, ...row } of read('expeditionReward',
    [['id','int'], ['groupId','int'], ['weight','int'], ['type','int'], ['rewardId','int'], ['amount','int']])) {
    if (!expeditionRewardGroups[groupId]) throw new Error(`Unknown expedition reward group ${groupId}`);
    expeditionRewardGroups[groupId].rewards.push(row);
  }
  const pcs = Object.fromEntries(read('pc', [['id','int'], ...Array(7).fill(null), ['key','string']])
    .map(({ id, key }) => [key, id]));
  // Candidate slot 2 is polymorphic: PC first (0x2321214), then character
  // (0x232130c). Costume elections must keep their original PC identities.
  const voteCandidateIds = new Set([...Object.values(pcs), ...Object.keys(characters).map(Number)]);
  for (const vote of Object.values(votes)) for (const candidate of vote.candidates)
    if (!voteCandidateIds.has(candidate.characterId)) throw new Error(`Unknown vote candidate ${candidate.id}`);
  // Familia's own-member refresh uses party 1 / slot 1, not the active party
  // (0x251f5bc). PC job order: 0x22da418; EXP group: 0x22cf5f8.
  const originalPcs = read('pc', Array.from({ length: 96 }, (_, i) =>
    i === 0 ? ['id','int'] : i === 7 ? ['characterKey','string'] : i >= 14 && i <= 19 ? [`job${i - 14}`,'int'] :
      i === 20 ? ['limitBreakJob','int'] : i >= 30 && i <= 39 ?
        [i%2 ? `abilityRank${(i-31)/2}` : `rankAbility${(i-30)/2}`,i%2 ? 'int' : 'long'] :
        i === 45 ? ['initialLevel','int'] : i === 46 ? ['initialJobRank','int'] :
        i === 47 ? ['levelUpType','int'] : i === 76 ? ['initialCostumeId','int'] : i === 90 ? ['heroSublimateGroup','int'] :
          i >= 93 ? [`extraAbility${i-93}`,'long'] : null));
  // Expedition request2308378 resolves pc.slot7 to DomainCharacter, not to a
  // second PC ID or CP level. Blank NPC/debug keys remain explicitly unmapped.
  const pcProfiles = Object.fromEntries(originalPcs.map(row => {
    const { id,characterKey,levelUpType,heroSublimateGroup,initialCostumeId } = row;
    if (characterKey && !characterIdsByKey[characterKey]) throw new Error(`Unknown original PC character ${id}`);
    //22ebe94 reads slot76 as int32; zero skips2505fc4's direct costume grant.
    if (initialCostumeId < 0 || initialCostumeId && !characterCostumes[initialCostumeId])
      throw new Error(`Unknown original PC initial costume ${id}`);
    //22dcdb8 gates five abilities by original job rank (22e5c10), not
    // currentJobIndex.20f0570 compacts positive slots93..95 in source order.
    return [id, { characterId:characterIdsByKey[characterKey] ?? 0,levelUpType,heroSublimateGroup,initialCostumeId,
      jobIds:Array.from({ length:6 },(_,i)=>row[`job${i}`]).filter(id=>id>0),
      rankAbilities:Array.from({ length:5 },(_,i)=>[row[`abilityRank${i}`],row[`rankAbility${i}`]]),
        extraAbilities:Array.from({ length:3 },(_,i)=>row[`extraAbility${i}`]).filter(id=>id>0) }];
  }));
  //22ebbbc reads vtable offsets0x5e/0x60 (slots45/46), NOT slots47/48.
  //22dffa4 ->22dfa18 maps the original starting rank to its ordered job.
  // Separate projection preserves every existing PC profile/capture value.
  const pcInitialStates=Object.fromEntries(originalPcs.map(row=>[row.id,
    {level:row.initialLevel,jobRank:row.initialJobRank}]));
  //22d8218 binds pcGuest.slot0 to179c9c4's step-group selector;22d8de8
  // matches slot1 to PC ID.22d8614 reads long window slots5/6. Unknown slots
  // and the unused step-row ID are deliberately not assigned guessed names.
  const pcGuests=read('pcGuest',[['id','int'],['pcId','int'],null,null,null,['startAt','long'],['endAt','long']]);
  const pcGuestLevelSteps=read('pcGuestLevelStep',[null,['guestId','int'],['level','int'],['totalExp','int'],['marker','int']]);
  if(pcGuests.some(row=>row.id<=0 || !pcProfiles[row.pcId]) ||
      new Set(pcGuests.map(row=>row.id)).size!==pcGuests.length ||
      pcGuestLevelSteps.some(row=>row.guestId<=0 || row.level<0 || row.totalExp<0))
    throw new Error('Original guest-PC identities/level fields require recovery');
  // Preserve original vector order: DomainPC binds the FIRST matching PC,
  // while179e258 independently sorts each selected step group by level DESC.
  // marker15 is the native permanent-ownership boundary, not a guessed prize.
  //22d01ac ARM64 instructions (the decompiler drops later PIC calls):
  // pc slots48..54,56 feed native kinds1,2,4,8,16,32,64,128 respectively.
  // Keep numeric kinds;128 is NOT included by dispatch total22d373c.
  const pcStatKinds = [1,2,4,8,16,32,64,128];
  const pcBaseStats = Object.fromEntries(read('pc', Array.from({ length:57 }, (_, i) =>
    i === 0 ? ['id','int'] : i >= 48 && i <= 54 ? [`kind${pcStatKinds[i-48]}`,'int'] :
      i === 56 ? ['kind128','int'] : null)).map(({ id,...values }) =>
    [id,Object.fromEntries(pcStatKinds.map(kind=>[kind,values[`kind${kind}`]]))]));
  // 0x22dd5c8 appends pc.slot20 as the extra board; it is not one of the
  // ordered normal rank jobs used by currentJobIndex and the level getter.
  const pcLimitBreakJobs = Object.fromEntries(originalPcs.filter(row => row.limitBreakJob > 0)
    .map(({ id, limitBreakJob }) => [id, limitBreakJob]));
  // Gift ExPC0x248cbb8 calls0x22e2148: vtable offset0xb8 is pc.slot90.
  // A nonzero original group enables hero ascension; no NPC eligibility guess.
  const pcHeroSublimateGroups = Object.fromEntries(originalPcs.filter(row => row.heroSublimateGroup > 0)
    .map(({ id, heroSublimateGroup }) => [id, heroSublimateGroup]));
  //1618674/1618e00 selects original group(slot1), level(slot7), including
  // level0 through the saved hero level.22d7058 adds slots8..14 to FLAT,
  // after percentage, in kind order1,64,2,4,8,16,32.
  const pcHeroSublimateSteps = {};
  for (const { group,level,...stats } of read('heroSublimateLevelStep', [null,['group','int'],
    ...Array(5).fill(null),['level','int'],...[1,64,2,4,8,16,32].map(kind=>[`kind${kind}`,'int'])]))
    (pcHeroSublimateSteps[group] ??= []).push([level,...[1,64,2,4,8,16,32].map(kind=>stats[`kind${kind}`])]);
  for (const [group,steps] of Object.entries(pcHeroSublimateSteps))
    if (steps.length !== 7 || steps.some((row,i)=>row[0] !== i || row.some(n=>
      !Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7fffffff)))
      throw new Error(`Original hero ascension stat steps require recovery for group ${group}`);
  if (originalPcs.some(pc=>!pcHeroSublimateSteps[pc.heroSublimateGroup]))
    throw new Error('Original hero ascension group join unavailable');
  // Equipment gift2000/248cbb8 resolves either the original long equipment ID
  // or giftParameterizedEquipment. Native258500c uses preset slots2..8;
  // normal2584ea0 uses equipment.slot36 for separate500 weapon/armour slots.
  const equipments = Object.fromEntries(read('equipment', Array.from({ length: 37 }, (_, i) =>
    i === 0 ? ['id','long'] : i === 1 ? ['key','string'] : i === 2 ? ['name','string'] : i === 4 ? ['kind','int'] :
      i === 6 ? ['rarity','int'] : i === 11 ? ['durability','int'] : i === 29 ? ['performance','int'] :
        i >= 30 && i <= 34 ? [`abilityId${i - 29}`,'long'] : i === 36 ? ['type','int'] : null))
    .map(({ id, ...row }) => [id, row]));
  const equipmentGiftPresets = Object.fromEntries(read('giftParameterizedEquipment',
    [['id','int'], ['key','string'], ['equipmentId','long'], ['evolveCount','int'],
      ...Array.from({ length: 5 }, (_, i) => [`abilityId${i + 1}`,'long'])])
    .map(({ id, ...row }) => [id, row]));
  // Expedition247afcc resolves equipment abilities, NOT PC skills. Owned
  // gear2597434 contributes saved abilityId1..5;259784c also contributes the
  // five fixed master slots30..34. Keep duplicates: the native sum does.
  const equipmentAbilities = Object.fromEntries(read('equipmentAbility',
    [['id','long'], ['name','string'], ['description','string'], ['type','int'], ['kind','int'], ['amount','int']])
    .map(({ id, ...row }) => [id, row]));
  //259c678/259c740 compare0x4000 (16384), NOT4096. amount selects
  // equipmentAbilityValuePcRarity.slot3;259c768 preserves source order.
  //259cab8 gates rank/level/ascension/limitbreak, and259cba0 expands
  // slots8/9/10 as mode/mask/amount, grouping by MASK, not by mode.
  const equipmentAbilityPcRaritySteps = read('equipmentAbilityValuePcRarity',
    [['id','long'],null,null,['groupId','int'],['jobRank','int'],['limitbreakCount','int'],
      ['level','int'],['heroSublimateLevel','int'],['mode','int'],['mask','int'],['amount','int']]);
  if (new Set(equipmentAbilityPcRaritySteps.map(row=>row.id)).size !== equipmentAbilityPcRaritySteps.length ||
      equipmentAbilityPcRaritySteps.some(row=>!Number.isSafeInteger(row.id) || row.id<=0 ||
        Object.entries(row).some(([key,n])=>key!=='id' && (!Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7fffffff))))
    throw new Error('Original conditional equipment ability data requires recovery');
  const equipmentEvolveAbilities = read('equipmentEvolveAbilityContent',
    [['id','long'], ['groupId','long'], ['abilityId','long']]);
  //22a378c/29bb2c0 load equipmentEvolve into the slot1 equipment-ID
  // index.20fdfbc returns its first slot2 rarity match;259539c reads slot5
  // ability group for each consecutive base+1..12 step, stopping at a gap.
  const equipmentEvolutions = read('equipmentEvolve',
    [['id','long'],['equipmentId','long'],['rarity','int'],null,null,['abilityGroupId','long']]);
  if (new Set(equipmentEvolutions.map(row=>row.id)).size!==equipmentEvolutions.length ||
      equipmentEvolutions.some(row=>!Number.isSafeInteger(row.id) || row.id<=0 || !equipments[row.equipmentId] ||
        !Number.isSafeInteger(row.rarity) || row.rarity<1 || row.rarity>0x7fffffff ||
        !Number.isSafeInteger(row.abilityGroupId) || row.abilityGroupId<0 || row.abilityGroupId &&
        !equipmentEvolveAbilities.some(ability=>ability.groupId===row.abilityGroupId)))
    throw new Error('Original equipment evolution ability joins require recovery');
  // Native2597a50 can add evolution abilities, but none in this frozen
  // archive has type1024. Reject a different export rather than omit boosts.
  if (equipmentEvolveAbilities.some(row => !equipmentAbilities[row.abilityId] ||
      equipmentAbilities[row.abilityId].type === 1024) ||
      Object.values(equipmentAbilities).some(row => row.type === 1024 &&
        (![1,2,4,8].includes(row.kind) || row.amount < 0)))
    throw new Error('Original equipment expedition-boost data requires recovery');
  const pcJobs = read('pcJob', Array.from({ length: 12 }, (_, i) =>
    i === 0 ? ['id','int'] : i === 4 ? ['rank','int'] : i === 11 ? ['groupId','int'] : null));
  const pcJobRanks = Object.fromEntries(pcJobs.map(({ id, rank }) => [id, rank]));
  // DomainPCJob constructor0x22c9910 selects slot11's panel group. Panel
  // readers0x22cb440/0x22cb49c use slot2's index for the saved bit; the
  // crystal modal0x148ef50 displays slot15 as its currency.gem price.
  const pcJobPanelGroups = Object.fromEntries(pcJobs.map(({ id, groupId }) => [id, groupId]));
  //22cdfcc reads mode/amount/mask from slots5/6/7.20f0058 gates a
  // weapon-dependent effect with slots8/9, not with the display type slot1.
  const pcAbilities = Object.fromEntries(read('pcAbility', [['id','long'],['type','int'],null,null,null,
    ['mode','int'],['amount','int'],['mask','int'],['condition','int'],['weaponMask','int']])
    .map(({ id,...row })=>[id,row]));
  const pcAbilityTypes = Object.fromEntries(Object.entries(pcAbilities).map(([id,row])=>[id,row.type]));
  if (Object.values(pcProfiles).some(pc=>pc.rankAbilities.some(([rank,id])=>rank<1 || rank>6 || id<0 || id && !pcAbilities[id]) ||
      pc.extraAbilities.some(id=>!pcAbilities[id]))) throw new Error('Original PC passive abilities unavailable');
  const originalPanels = read('pcAbilityPanel', Array.from({ length: 16 }, (_, i) =>
    i === 0 ? ['id','int'] : i === 1 ? ['groupId','int'] : i === 2 ? ['index','int'] :
      i === 3 ? ['abilityId','long'] : i === 15 ? ['irisCost','int'] : null));
  //22c97b8 consumes type51 placeholders in original row order, NOT panel
  // index order. Frozen IDs are strictly ascending; Object.values keeps it.
  if (originalPanels.some((row,i)=>i>0 && row.id<=originalPanels[i-1].id))
    throw new Error('Original ability-panel source order requires recovery');
  const pcAbilityPanels = Object.fromEntries(originalPanels
    .map(({ id, ...panel }) => [id, panel]));
  if (Object.values(pcAbilityPanels).some(panel => !Number.isSafeInteger(panel.groupId) || panel.groupId < 0 ||
      !Number.isSafeInteger(panel.index) || panel.index < 1 || panel.index > 25 ||
      !pcAbilityTypes[panel.abilityId] || !Number.isSafeInteger(panel.irisCost) || panel.irisCost <= 0))
    throw new Error('Invalid original ability-panel data');
  const pcJobMaxLevels = Object.fromEntries(read('pcJobRank', [null, ['rank','int'], ['level','int']])
    .map(({ rank, level }) => [rank, level]));
  const pcLevels = {};
  const pcLevelGrowth = {};
  //22cf1cc selects pc.slot47's growth group;22d01ac adds EACH original
  // step through the derived level, not just that level's increment.
  for (const { group, level, exp, ...growth } of read('pcLevelStep',
    [null, ['group','int'], ['level','int'], ['exp','int'], ...pcStatKinds.map(kind=>[`kind${kind}`,'int'])])) {
    (pcLevels[group] ??= []).push([level, exp]);
    (pcLevelGrowth[group] ??= []).push([level,...pcStatKinds.map(kind=>growth[`kind${kind}`])]);
  }
  // Preserve source iteration order: the native growth loop stops at the
  // first step above the current level. Do not repair a changed source order.
  for (const [group,steps] of Object.entries(pcLevelGrowth))
    if (steps.some((row,i)=>row[0] !== i+1 || row.length !== 9 ||
        row.some(n=>!Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7fffffff)))
      throw new Error(`Original PC stat growth requires recovery for group ${group}`);
  if (Object.entries(pcProfiles).some(([id,pc])=>!pcBaseStats[id] || !pcLevelGrowth[pc.levelUpType]))
    throw new Error('Original PC base/growth joins unavailable');
  for (const steps of Object.values(pcLevels)) steps.sort((a, b) => a[0] - b[0]);
  // PlayerStamina::max0x254857c reads original slot3 through0x1d31664.
  const playerLevelRows = read('playerLevelStep', [null, ['level','int'], ['exp','long'], ['maxSP','int']]);
  const playerLevels = playerLevelRows.map(({ level, exp }) => [level, exp]).sort((a, b) => a[0] - b[0]);
  const playerMaxSP = Object.fromEntries(playerLevelRows.map(({ level, maxSP }) => [level, maxSP]));
  if (playerLevels.length !== 999 || playerLevels.some(([level, exp], index) => level !== index+1 ||
      !Number.isSafeInteger(exp) || exp < 0 || index === 0 && exp !== 0 ||
      index > 0 && exp <= playerLevels[index-1][1] || !Number.isSafeInteger(playerMaxSP[level]) || playerMaxSP[level] < 0))
    throw new Error('Invalid original player level/experience thresholds');
  const familiaGodIds = read('familiaGod', [['id','int']]).map(row => row.id);
  const originalMessages=read('message', [['id','int'], ['key','string'], null, ['text','string']]);
  const adIrisMessage=originalMessages.find(row=>row.key==='home_shop_modal_shop_purchase_all_list_27');
  const adIrisAmount=Number(adIrisMessage?.text.match(/^Watch videos to earn (\d+) Iris\.$/)?.[1]);
  if(adIrisMessage?.id!==40320028 || adIrisAmount!==10 || !currencies['currency.gem'])
    throw new Error('Original daily advertisement Iris reward unavailable');
  const advertisementIrisReward={itemId:currencies['currency.gem'],amount:adIrisAmount,
    messageId:adIrisMessage.id,messageKey:adIrisMessage.key,messageText:adIrisMessage.text};
  const shootingRewardMessage=originalMessages.find(row=>row.key==='shooting_daily_ranking_score_reward_txt');
  if(shootingRewardMessage?.id!==40610001 || shootingRewardMessage.text!=='AIS WARS Rank {} Reward')
    throw new Error('Original shooting reward title unavailable');
  const familiaFirstRewardNotice = originalMessages.find(row => row.key === 'familia_error_first_reward_not_memer');
  // Keep authored rules outside serialPvp: existing battle catalogs must not
  //change merely because more original message evidence has been exported.
  const serialPvpMessages=Object.fromEntries(originalMessages.filter(row=>row.key.startsWith('serial_pvp_'))
    .map(({id,...row})=>[id,row]));
  if (!serialPvpMessages[40650029]?.text.includes('win all 5 battles') ||
      !serialPvpMessages[40650069]?.text.includes('5 wins in a row, or after losing once'))
    throw new Error('Original Abyss five-round/class-lock rule unavailable');
  if (familiaFirstRewardNotice?.id !== 40550237 || !familiaFirstRewardNotice.text.includes('4★ Guaranteed Ticket') ||
      !items['gacha_ticket.character_4']) throw new Error('Original Familia first-reward identity unavailable');
  // The archived message identifies the ticket, but the old server supplied
  // its quantity. One ticket per local player is an explicit offline policy.
  const familiaFirstReward = { itemId: items['gacha_ticket.character_4'], amount: 1,
    messageId: familiaFirstRewardNotice.id, messageKey: familiaFirstRewardNotice.key,
    messageText: familiaFirstRewardNotice.text, quantityPolicy: 'one ticket per local player' };
  const familiaStyleIds = read('familiaAtmosphere', [['id','int']]).map(row => row.id);
  //1572598 uses slots3/4 as daily hours;1572818/15728e0 use slot2 index
  //for secondary0's next-row fallback, wrapping to the authored index0.
  const familiaTimeRows=read('familiaActivityTime',
    [['id','int'],null,['index','int'],['startHour','int'],['endHour','int']]);
  const familiaTimeIds=familiaTimeRows.map(row=>row.id),
    familiaActivityTimes=Object.fromEntries(familiaTimeRows.map(({id,...row})=>[id,row]));
  if(new Set(familiaTimeRows.map(row=>row.index)).size!==familiaTimeRows.length ||
      !familiaTimeRows.some(row=>row.index===0) || familiaTimeRows.some(row=>
        !Number.isSafeInteger(row.index) || row.index<0 ||
        ![row.startHour,row.endHour].every(hour=>Number.isSafeInteger(hour) && hour>=0 && hour<24)))
    throw new Error('Invalid original Familia activity-time calendar');
  // 0x1aada28 multiplies column1 by the selected count; 0x243a168
  // subtracts today's saved count from column2 to obtain the daily remainder.
  const familiaValisDonations = Object.fromEntries(read('familiaValisDonation',
    [['id','int'], ['valis','int'], ['dailyLimit','int']]).map(({ id, ...row }) => [id, row]));
  if (Object.keys(familiaValisDonations).length !== 3 || Object.values(familiaValisDonations).some(row =>
      row.valis <= 0 || row.dailyLimit <= 0)) throw new Error('Invalid original Familia Valis donation data');
  const familiaDonationItems = Object.fromEntries(read('familiaDonationItem', Array.from({ length: 10 }, (_, i) =>
    i === 0 ? ['id','int'] : i === 7 ? ['contribution','int'] : i === 9 ? ['dailyLimit','int'] : null))
    .map(({ id, ...row }) => [id, row]));
  const familiaLevels = read('familiaLevelStep', [null,['level','int'],['points','long'],['rewardSkillPoint','int']])
    .sort((a, b) => a.level - b.level);
  if (Object.keys(familiaDonationItems).length !== 3 || Object.values(familiaDonationItems).some(row =>
      row.contribution <= 0 || row.dailyLimit <= 0) || !familiaLevels.length || familiaLevels[0].level !== 1 ||
      familiaLevels[0].points !== 0 || familiaLevels.some((row, i) => row.level !== i + 1 || row.points < 0 ||
        row.rewardSkillPoint < 0 || row.points < (familiaLevels[i - 1]?.points ?? 0)))
    throw new Error('Invalid original Familia donation data');
  // 0x231b120 reads authored defaults from familiaBgImage column4 and
  // familiaBGM column3. Defaults may be selected without a shop purchase.
  const familiaThemes = [
    ...read('familiaBgImage', [['id','long'], null, null, null, ['isDefault','int']]),
    ...read('familiaBGM', [['id','long'], null, null, ['isDefault','int']]),
  ];
  if (familiaThemes.some(row => ![0,1].includes(row.isDefault)))
    throw new Error('Invalid original Familia default theme flag');
  const familiaDefaults = new Set(familiaThemes.filter(row => row.isDefault).map(row => row.id));
  const familiaStamps = Object.fromEntries(read('familiaStamp',
    [['id','int'], ['art','string'], ['order','int'], ['isDefault','int']]).map(({ id, ...row }) => {
      if (![0,1].includes(row.isDefault) || !/^stamp\d+\.png$/.test(row.art) || row.order <= 0)
        throw new Error('Invalid original Familia stamp');
      return [id, { ...row, isDefault: Boolean(row.isDefault) }];
    }));
  if (Object.keys(familiaStamps).length !== 42) throw new Error('Incomplete original Familia stamps');
  const familiaShops = Object.fromEntries(read('familiaShop',
    [['id','long'], ['type','int'], ['rewardId','long'], null, null, ['price','int'], null,
      ['startAt','long'], ['endAt','long']]).map(({ id, ...row }) => [id,
        { ...row, isDefault: [2,3].includes(row.type) && familiaDefaults.has(row.rewardId) }]));
  if (Object.keys(familiaShops).length !== 41 || Object.values(familiaShops).some(row =>
    ![1,2,3].includes(row.type) || row.rewardId <= 0 || row.price <= 0 || row.startAt < 0 || row.endAt < 0))
    throw new Error('Invalid original Familia shop data');
  const familiaSkillGroups = Object.fromEntries(read('familiaSkillGroup',
    [['id','long'], ['name','string'], null, ['startAt','long']]).map(({ id, ...row }) => [id, row]));
  const familiaSkills = Object.fromEntries(read('familiaSkill',
    [['id','long'], ['groupId','long'], ['type','int'], ['level','int'], ['pcSkillId','int'],
      ['cost','int'], ['startAt','long']]).map(({ id, ...row }) => [id, row]));
  if (Object.keys(familiaSkillGroups).length !== 1 || Object.keys(familiaSkills).length !== 315 ||
      Object.values(familiaSkills).some(row => !familiaSkillGroups[row.groupId] ||
        ![1,2,3,4,5,6,7].includes(row.type) || row.level < 1 || row.level > 45 || row.pcSkillId <= 0 ||
        row.cost <= 0 || row.startAt < 0) ||
      [1,2,3,4,5,6,7].some(type => Object.values(familiaSkills).filter(row => row.type === type)
        .some((row, i) => row.level !== i + 1)))
    throw new Error('Invalid original Familia skill data');
  const guildVsGuild = Object.fromEntries(read('guildVsGuildInformation', [
    ['id','long'], null, null, null, null, null,
    ['preparationStartAt','long'], ['battleEndAt','long'], ['eventEndAt','long'],
    ['entryStartAt','long'], ['entryEndAt','long'], ['battleStartAt','long'], ['type','int'],
  ]).map(({ id, ...row }) => [id, row]));
  // The final archive's tournament row stores equal daily-grant/limit pairs.
  // Messages 40582661 and 40590136 identify the support/prediction resets as
  // daily; the paired field names are reconstructed from that source evidence.
  const guildVsGuildTournaments = Object.fromEntries(read('guildVsGuildTournament', [
    ['id','long'], ['gvgId','long'], ['dailySupporterTickets','int'], ['supporterTicketLimit','int'],
    ['dailyVoteTickets','int'], ['voteTicketLimit','int'], ['qualifyingGvgId','long'],
  ]).map(({ gvgId, ...row }) => [gvgId, row]));
  if (Object.keys(guildVsGuildTournaments).length !== 9 || Object.entries(guildVsGuildTournaments).some(([gvgId,row]) =>
    guildVsGuild[gvgId]?.type !== 1 || guildVsGuild[row.qualifyingGvgId]?.type !== 0 ||
    row.dailySupporterTickets !== 1 || row.supporterTicketLimit !== 1 ||
    row.dailyVoteTickets !== 5 || row.voteTicketLimit !== 5))
    throw new Error('Invalid original Guild War tournament ticket data');
  const shopProducts = Object.fromEntries(read('shopProduct',
    [['id','int'], null, null, null, ['priceType','int'], ['priceItemId','long'], ['price','int'],
      ['limitType','int'], ['limit','int'], ['rewardType','int'], ['rewardId','long'], ['amount','int'],
      ['startAt','long'], ['endAt','long'], ['shopId','int'], ['duration','long']])
    .map(({ id, ...row }) => [id, row]));
  const shopPacks = Object.fromEntries(read('shopPack', [['id','int'], ['key','string']])
    .map(({ id, key }) => [id, { key, contents: [] }]));
  for (const { packId, type, itemId, equipmentId, amount } of read('shopPackContent',
    [['id','int'], ['key','string'], ['type','int'], ['itemId','int'], ['amount','int'], ['packId','int'],
      ['name','string'], ['equipmentId','long']])) {
    if (!shopPacks[packId]) throw new Error(`Missing shop pack ${packId}`);
    shopPacks[packId].contents.push({ type, rewardId: type === 3 ? equipmentId : itemId, amount });
  }
  // DomainLottery getters (15.1.0, raw 0x25a580c..0x25a68a4) use these
  // FlatBuffer slots. Keep unidentified features gated, not silently discarded.
  const lotteries = Object.fromEntries(read('lottery', Array.from({ length: 59 }, (_, i) =>
    i === 2 ? null : [String(i), [4,5].includes(i) ? 'long' : 'int']))
    .map(row => [row[0], { startAt: row[4], endAt: row[5], groupId: row[7], ticketId: row[23],
      ...(row[41] === 3 ? { selectionGroupIds: [row[48],row[50],row[52]].filter(Boolean) } : {}),
      // 40 only enables the local New badge (0x25a6d64, LotteryNewIcon).
      special: ![0,2].includes(row[39]) || ![0,2].includes(row[41]) ||
        Object.keys(row).some(i => Number(i) >= 47 && Number(i) !== 54 && row[i] !== 0),
      buttons: [9,20,30].map((at, i) => ({ pickCount: row[at], consumeType: row[at+1],
        consumeAmount: row[at+2], limit: row[at+4],
        daily: row[i === 0 ? 14 : i === 1 ? 44 : 45] !== 0,
        fixedGroupId: i ? row[at+5] : 0, fixedCount: i ? row[at+6] : 0,
        stepUpGroupId: i === 1 && row[41] === 2 ? row[42] : i === 2 && row[39] === 2 ? row[43] : 0 })) }]));
  const lotteryStepUps = {};
  for (const { stepUpGroupId, ...step } of read('lotteryStepUpStep', [null, ['stepUpGroupId','int'],
    ['groupId','int'], ['fixedGroupId','int'], ['buttonType','int'], ['stepIndex','int'],
    ['consumeAmount','int'], ['pickCount','int'], ['fixedCount','int'], ['description','string'],
    ['lastStepFlag','int'], ['highlight','int']])) {
    const steps = lotteryStepUps[stepUpGroupId] ??= [];
    const old = steps.find(row => row.stepIndex === step.stepIndex);
    // The archive repeats group 450000303 identically under different row IDs.
    if (old && JSON.stringify(old) !== JSON.stringify(step)) throw new Error(`Conflicting lottery step ${stepUpGroupId}/${step.stepIndex}`);
    if (!old) steps.push(step);
  }
  for (const steps of Object.values(lotteryStepUps)) steps.sort((a, b) => a.stepIndex - b.stepIndex);
  const lotterySteps = {};
  for (const { lotteryId, ...step } of read('lotteryStep', [null,['lotteryId','int'],['count','int'],
    ['groupId','int'],['type','int']])) (lotterySteps[lotteryId] ??= []).push(step);
  const lotteryScratches = {};
  for (const { lotteryId, ...scratch } of read('lotteryScratch', [null,['lotteryId','int'],['buttonType','int'],
    ['count','int'],['scratchId','int'],['once','int']])) (lotteryScratches[lotteryId] ??= []).push(scratch);
  const lotteryWeights = Object.fromEntries(read('lotteryWeightGroup', [['id','int'],['weight','int']])
    .map(({ id, weight }) => [id, weight]));
  const lotteryPools = {};
  for (const row of read('lotteryCharacter', [null,['groupId','int'],['pcId','int'],['weightId','int']])) {
    (lotteryPools[row.groupId] ??= {})[row.weightId] ??= [];
    lotteryPools[row.groupId][row.weightId].push(row.pcId);
  }
  const selectLineupWeights = Object.fromEntries(read('selectLineupLotteryGroup',
    [['id','int'],['weightId','int']]).map(row => [row.id, row.weightId]));
  const selectLineupPools = {};
  for (const row of read('selectLineupLotteryCharacter', [null,['groupId','int'],['pcId','int'],null]))
    (selectLineupPools[row.groupId] ??= []).push(row.pcId);
  const specialLotteries = new Set([
    ...read('lotteryStep', [null,['lotteryId','int']]),
    ...read('lotteryScratch', [null,['lotteryId','int']]),
  ].map(row => row.lotteryId));
  for (const id of specialLotteries) if (lotteries[id]) lotteries[id].special = true;
  const lotteryTicketRows = read('gachaTicket', [['id','int'], ['key','string'], ['name','string'],
    null, ['duration','long']]);
  const lotteryTickets = Object.fromEntries(lotteryTicketRows.map(({ id, duration }) => [id, duration]));
  const subscriptionTickets = Object.fromEntries(read('subscriptionTicket', [['id','int'], ['key','string'],
    ['name','string'], ['description','string'], ['duration','long'], ['exchangeCount','int']])
    .map(({ id, ...row }) => [id, row]));
  // Preserve the archived plans and both daily variants without treating
  // unknown slot3/slot5 values as purchase or trial entitlement flags.
  const subscriptions = Object.fromEntries(read('subscription', [['id','int'], ['productId','string'],
    ['name','string'], ['slot3','int'], ['tier','int'], ['description','string'],
    ['missionShopId','int'], ['exchangeShopId','int'], ['startAt','long'], ['endAt','long']])
    .map(({ id, ...row }) => [id, { ...row, bonusItems: [], extendBonusItems: [] }]));
  // Skip tickets are a separate native class, not an ordinary amount/cumulative
  // inventory. Export metadata here without registering a guessed item profile.
  const skipTickets = Object.fromEntries(read('skipTicket', [['id','int'], ['key','string'], ['name','string'],
    ['description','string'], ['slot4','int'], ['slot5','int'], ['slot6','int']])
    .map(({ id, ...row }) => [id, row]));
  const subscriptionItemNames = Object.fromEntries([
    ...currencyRows.map(row => [row.id, row.name]), ...lotteryTicketRows.map(row => [row.id, row.name]),
    ...Object.entries(subscriptionTickets).map(([id,row]) => [id,row.name]),
    ...Object.entries(skipTickets).map(([id,row]) => [id,row.name]),
  ]);
  for (const { subscriptionId, ...row } of read('subscriptionItem', [['id','int'], ['subscriptionId','int'],
    ['type','int'], ['itemId','int'], ['amount','int'], ['slot5','int']])) {
    if (!subscriptions[subscriptionId] || !subscriptionItemNames[row.itemId] || row.amount <= 0)
      throw new Error('Invalid original subscription bonus join');
    subscriptions[subscriptionId].bonusItems.push({ ...row, name: subscriptionItemNames[row.itemId] });
  }
  for (const { subscriptionId, ...row } of read('subscriptionExtendItem', [['id','int'], ['subscriptionId','int'],
    ['type','int'], ['itemId','int'], ['amount','int']])) {
    if (!subscriptions[subscriptionId] || !subscriptionItemNames[row.itemId] || row.amount <= 0)
      throw new Error('Invalid original subscription renewal join');
    subscriptions[subscriptionId].extendBonusItems.push({ ...row, name: subscriptionItemNames[row.itemId] });
  }
  const subscriptionDisplays = Object.fromEntries(read('subscriptionDisplay',
    [['id','int'], ['type','int'], ['key','string']]).map(({ id, ...row }) => [id, row]));
  // AdScratch26100/23f0734 is separate from gacha Scratch18000. Availability
  // 23f4e4c reads long start/end slots5/6, with an inclusive finite end.
  const adScratches = Object.fromEntries(read('adScratch', [['id','int'], ['key','string'], ['name','string'],
    ['slot3','int'], ['description','string'], ['startAt','long'], ['endAt','long']])
    .map(({ id, ...row }) => [id, { ...row, steps: [] }]));
  const adScratchSteps = new Map();
  for (const { id, scratchId, index } of read('adScratchStep', [['id','int'], null, ['scratchId','int'], ['index','int']])) {
    if (!adScratches[scratchId]) throw new Error('Unknown original ad scratch step owner');
    const step = { id, index, contents: [] }; adScratchSteps.set(id, step); adScratches[scratchId].steps.push(step);
  }
  for (const { id, stepId, ...row } of read('adScratchContent', [['id','int'], null, ['stepId','int'],
    ['rewardType','int'], ['rewardKey','string'], ['amount','int'], ['special','int']])) {
    if (!adScratchSteps.has(stepId) || !items[row.rewardKey] || ![0,1].includes(row.special) || row.amount <= 0)
      throw new Error('Invalid original ad scratch reward');
    adScratchSteps.get(stepId).contents.push({ id, ...row, itemId: items[row.rewardKey] });
  }
  for (const scratch of Object.values(adScratches)) scratch.steps.sort((a,b) => a.index - b.index);
  // Scratch18000 uses its own card/step/prize tables, not AdScratch26100.
  // Preserve slot3 until its native semantics are recovered.
  const scratches = Object.fromEntries(read('scratch', [['id','int'], ['key','string'], ['name','string'],
    ['slot3','int'], ['description','string']]).map(({ id, ...row }) => [id, { ...row, steps: [] }]));
  const scratchSteps = new Map();
  for (const { id, scratchId, index } of read('scratchStep', [['id','int'], null, ['scratchId','int'], ['index','int']])) {
    if (!scratches[scratchId]) throw new Error('Unknown original gacha scratch step owner');
    const step = { id, index, contents: [] }; scratchSteps.set(id, step); scratches[scratchId].steps.push(step);
  }
  for (const { id, stepId, ...row } of read('scratchContent', [['id','int'], null, ['stepId','int'],
    ['rewardType','int'], ['rewardKey','string'], ['amount','int'], ['special','int']])) {
    if (!scratchSteps.has(stepId) || !items[row.rewardKey] || ![0,1].includes(row.special) || row.amount <= 0)
      throw new Error('Invalid original gacha scratch reward');
    scratchSteps.get(stepId).contents.push({ id, ...row, itemId: items[row.rewardKey] });
  }
  for (const scratch of Object.values(scratches)) scratch.steps.sort((a,b) => a.index - b.index);
  const bonds = Object.fromEntries(read('limitBreakItem', [['id','int'],null,['pcKey','string']])
    .filter(row => pcs[row.pcKey]).map(row => [pcs[row.pcKey], row.id]));
  // Under Telskyura is not the ordinary PvP or Serial PvP contract. Retain
  // every authored numeric slot; untranslated slots are NOT assigned guessed
  // cost/rating/reward semantics. The original CPU IDs also are not user IDs.
  const slotSchema = types => types.map((type,index) => [index === 0 ? 'id' : `slot${index}`,type]);
  // War Game's friend view needs original identities, not guessed season
  // windows, scoring or prizes.1713fbc/1735958 read long slot0.
  const pvpInformationIds=read('pvpInformation',[['id','long']]).map(row=>row.id);
  const pvpGradeIds=read('pvpGrade',[['id','long']]).map(row=>row.id);
  for(const ids of [pvpInformationIds,pvpGradeIds])
    if(!ids.length || ids.some(id=>!Number.isSafeInteger(id) || id<=0) || new Set(ids).size!==ids.length)
      throw new Error('Invalid original War Game identities');
  //13bcf2c selects the first original season using long slot1 and
  // time slots3/4.1c42e20 filters grade.slot1 (long),2121cd8 reads key slot2,
  //1c510dc reads display/art slots3/8;235ae6c compares int32 order slot9.
  //1c41068 reads int32 top/bottom rank slots5/6;1c47584 reads int32 slot7
  // into home_arena_ranking_score_border. Slot4 remains unidentified/absent.
  // Neither IDs nor UI defaults establish
  // a publisher initial-grade, matchmaking or scoring algorithm.
  const pvp={
    information:Object.fromEntries(read('pvpInformation',[['id','long'],['slot1','long'],null,
      ['startAt','long'],['endAt','long']]).map(({id,...row})=>[id,row])),
    grades:Object.fromEntries(read('pvpGrade',[['id','long'],['groupId','long'],['key','string'],
      ['name','string'],null,['minRank','int'],['maxRank','int'],['scoreBorder','int'],
      ['art','string'],['order','int']]).map(({id,...row})=>[id,row])),
  };
  const badPvpInfo=Object.entries(pvp.information).find(([,row])=>!Number.isSafeInteger(row.slot1) || row.slot1<0 ||
      !Number.isSafeInteger(row.startAt) || row.startAt<0 || !Number.isSafeInteger(row.endAt) ||
      row.endAt<0 || row.startAt && row.endAt && row.endAt<row.startAt),
    badPvpGrade=Object.entries(pvp.grades).find(([,row])=>!Number.isSafeInteger(row.groupId) || row.groupId<=0 ||
      !row.key || !row.name || !row.art || !Number.isInteger(row.order) || row.order<0 ||
      !['minRank','maxRank','scoreBorder'].every(key=>Number.isInteger(row[key]) && row[key]>=0 && row[key]<=0x7fffffff));
  if(badPvpInfo || badPvpGrade)
    throw new Error(`Invalid original War Game metadata: ${JSON.stringify(badPvpInfo ?? badPvpGrade)}`);
  //1c5c740 passes information.slot0 to1c5ca10/1c41a2c;1c42960 then
  //1c42e20 compares that selector with grade.slot1. No ID arithmetic.
  if(Object.values(pvp.grades).some(row=>!pvp.information[row.groupId]) ||
      pvpInformationIds.some(id=>!Object.values(pvp.grades).some(row=>row.groupId===id)))
    throw new Error('Invalid original War Game season/grade join');
  //23595e4 original ASM reads int32 slot4; type903 tails to235ae6c.
  //That condition looks up string slot10 in the original grade keys and
  //compares highestGradeId group/order.2358958 reads required int32 slot9.
  //23582a0 reads reset int32 slot20: category3/reset0 cannot reset.
  //Keep this outside pvp/achievements to preserve existing battle/reward hashes.
  const pvpGradeKeys=new Map(Object.entries(pvp.grades).map(([id,row])=>[row.key,{id:Number(id),...row}]));
  if(pvpGradeKeys.size!==pvpGradeIds.length) throw new Error('Duplicate original War Game grade key');
  const warGameAchievements=Object.fromEntries(read('achievement',[['id','long'],null,null,null,
    ['conditionType','int'],null,null,null,null,['requiredParam','int'],['gradeKey','string'],
    ...Array(9).fill(null),['resetType','int']])
    .filter(row=>row.conditionType===903).map(({id,requiredParam,gradeKey,resetType})=>{
      const grade=pvpGradeKeys.get(gradeKey);
      if(!achievements[id] || !grade || !Number.isInteger(requiredParam) || requiredParam<=0 || requiredParam>0x7fffffff ||
        !Number.isInteger(resetType) || resetType<0 || resetType>0x7fffffff)
        throw new Error('Invalid original War Game grade mission');
      return [id,{pvpId:grade.groupId,gradeId:grade.id,requiredParam,resetType}];
    }));
  //29ba4f0->29acd20 names pvpRankingGradeReward.1c42264 filters
  //long slot1 season;1c41068 reads long slot2 grade and int32 slots3..6
  //as two item-ID/quantity pairs.1c41760 resolves IDs in the item registry.
  //Slot0 identity is unused by that flow; do not guess its width/meaning.
  //Keep rewards outside pvp so existing immutable battle hashes stay valid.
  const warGameSeasonRewardRows=read('pvpRankingGradeReward',[null,['pvpId','long'],['gradeId','long'],
    ['itemId1','int'],['amount1','int'],['itemId2','int'],['amount2','int']]);
  if(new Set(warGameSeasonRewardRows.map(row=>row.gradeId)).size!==warGameSeasonRewardRows.length)
    throw new Error('Duplicate original War Game grade-prize row');
  const warGameSeasonRewards=Object.fromEntries(warGameSeasonRewardRows.map(row=>{
    if(pvp.grades[row.gradeId]?.groupId!==row.pvpId || ![1,2].every(i=>
      Number.isInteger(row[`itemId${i}`]) && row[`itemId${i}`]>=0 && row[`itemId${i}`]<=0x7fffffff &&
      Number.isInteger(row[`amount${i}`]) && row[`amount${i}`]>=0 && row[`amount${i}`]<=0x7fffffff &&
      Boolean(row[`itemId${i}`])===Boolean(row[`amount${i}`])))
      throw new Error('Invalid original War Game grade-prize join/items');
    return [row.gradeId,{pvpId:row.pvpId,rewards:[1,2].filter(i=>row[`itemId${i}`])
      .map(i=>({itemId:row[`itemId${i}`],amount:row[`amount${i}`]}))}];
  }));
  const underPvpSources = {
    underPvpInformation: ['long','string','string',...Array(9).fill('long'),'int','string','string',
      ...Array(4).fill('int'),'long','long','int','int','long'],
    underPvpGrade: ['long','long','string','string','int','int','string',...Array(9).fill('int')],
    underPvpRule: ['long',...Array(6).fill('int'),'string','long'],
    underPvpTutorialDummyPartyGroup: ['long','long','long','int','long'],
    underPvpMatchingCondition: ['long','long','long',...Array(32).fill('int')],
    underPvpRankingGradeReward: ['long'], // Final archive deliberately has zero rows.
    underPvpGroupRankingReward: ['long','long',...Array(12).fill('int')],
    underPvpRankBadge: ['long','long','int','int','string','int'],
    underPvpStaminaTicket: ['int','string','string','string','int','int','int','long','int','string'],
    underPvpRevengeTicket: ['int','string','string','string','int','int'],
    dummyUnderPvpUserProfile: ['long','string'],
    dummyUnderPvpPc: ['long',...Array(27).fill('int')],
    dummyUnderPvpPartySlot: ['long','long','long'],
    dummyUnderPvpParty: ['long','long','long','int','int',...Array(6).fill('long')],
  };
  const underPvp = Object.fromEntries(Object.entries(underPvpSources).map(([name,types]) => {
    const rows = read(name,slotSchema(types));
    if (rows.some(row => !Number.isSafeInteger(row.id) || row.id <= 0) || new Set(rows.map(row=>row.id)).size !== rows.length)
      throw new Error(`Invalid original ${name} IDs`);
    return [name,Object.fromEntries(rows.map(({ id,...row })=>[id,row]))];
  }));
  if (Object.values(underPvp.dummyUnderPvpPc).some(row => !pcProfiles[row.slot1]) ||
      Object.values(underPvp.dummyUnderPvpPartySlot).some(row =>
        !underPvp.dummyUnderPvpPc[row.slot1] || row.slot2 && !underPvp.dummyUnderPvpPc[row.slot2]) ||
      Object.values(underPvp.dummyUnderPvpParty).some(row => !underPvp.underPvpGrade[row.slot2] ||
        row.slot1 !== underPvp.underPvpGrade[row.slot2].slot1 ||
        [5,6,7,8,9,10].some(slot=>!underPvp.dummyUnderPvpPartySlot[row[`slot${slot}`]])) ||
      Object.values(underPvp.underPvpTutorialDummyPartyGroup).some(row =>
        !underPvp.dummyUnderPvpParty[row.slot4] || !underPvp.underPvpGrade[row.slot2] ||
        row.slot1 !== underPvp.dummyUnderPvpParty[row.slot4].slot1) ||
      Object.values(underPvp.underPvpInformation).some(row => !underPvp.underPvpRule[row.slot3] ||
        !underPvp.underPvpGrade[row.slot23] || row.slot8 >= row.slot9 || row.slot10 >= row.slot11))
    throw new Error('Invalid original Under Telskyura season/grade/CPU joins');
  // Telskyura Abyss is Serial PvP, not Record Buster or Under Telskyura.
  // Keep original slots and explicit float fields; do not rename unknown
  // conditions into invented cost, matchmaking or reward semantics.
  const serialPvpSources={
    serialPvpInformation:['long','string','string',...Array(4).fill('long'),'string','string',...Array(9).fill('long'),'int'],
    serialPvpGrade:['long','int','int','string','string','string','int','float'],
    serialPvpRule:['long',...Array(7).fill('int'),'string','long'],
    serialPvpEntryCondition:['long','long','int','string'],
    serialPvpMatchingCondition:['long','long','long',...Array(31).fill('int')],
    serialPvpRankBadge:['long','long','int','int','string','int'],
    serialPvpRankingRewardGroup:['long','long','int','int'],
    serialPvpRankingRewardItem:['long','long','int','int'],
    serialPvpSpTicketItem:['int',...Array(4).fill('string'),...Array(4).fill('int'),'string','int'],
    serialPvpScoreCalculation:['long','float','int','int','float',...Array(11).fill('int')],
    serialPvpScoreBonus:['long',...Array(4).fill('int')],
    serialPvpScoreBonusFamilia:['long','int','int'],
    serialPvpScoreTurnBonus:['long','int','int','int'],
    serialPvpScoreFinalTurnBonus:['long','int','int','int'],
    serialPvpScoreMission:['long','int','int','int','int','string',...Array(4).fill('int')],
  };
  const serialPvp=Object.fromEntries(Object.entries(serialPvpSources).map(([name,types])=>{
    const values=read(name,slotSchema(types));
    if (values.some(row=>!Number.isSafeInteger(row.id) || row.id<=0) || new Set(values.map(row=>row.id)).size!==values.length)
      throw new Error(`Invalid original ${name} IDs`);
    return [name,Object.fromEntries(values.map(({id,...row})=>[id,row]))];
  }));
  // DomainSystemFlag: long ID and encrypted default/min/max/readonly
  // (1697db8 decrypts readonly's eight-byte block to one byte).
  // Keep this outside serialPvp to preserve old captures.
  const flagRows=read('systemFlag',[['id','long'],['key','string'],null,
    ['defaultValue','int'],['minimum','int'],['maximum','int'],['readonly','bool']]);
  if(flagRows.some(row=>!Number.isSafeInteger(row.id) || row.id<=0 || !row.key ||
      row.minimum>row.defaultValue || row.defaultValue>row.maximum) ||
      new Set(flagRows.map(row=>row.id)).size!==flagRows.length || new Set(flagRows.map(row=>row.key)).size!==flagRows.length)
    throw new Error('Invalid original system-flag identities/ranges');
  const systemFlags=Object.fromEntries(flagRows.map(({id,...row})=>[id,row]));
  //2501050/2504420 use the long ID. Slots16..19 stay raw: only the
  //rank-based type2/9 branches have recovered acquisition semantics.
  const titleBadges=Object.fromEntries(read('titleBadge',[['id','long'],...Array(15).fill(null),
    ['slot16','int'],['slot17','long'],['slot18','int'],['slot19','int']]).map(({id,...row})=>[id,row]));
  if (Object.values(serialPvp.serialPvpInformation).some(row=>!serialPvp.serialPvpRule[row.slot9] ||
      !serialPvp.serialPvpScoreCalculation[row.slot12] || !serialPvp.serialPvpScoreBonus[row.slot13] ||
      !serialPvp.serialPvpSpTicketItem[row.slot18] || row.slot16 && !serialPvp.serialPvpInformation[row.slot16] ||
      // Original seasons29..50 contain zero-width disabled 2030 windows.
      // Preserve them verbatim; never manufacture an active period.
      row.slot3>row.slot4 || row.slot5>row.slot6) ||
      Object.values(serialPvp.serialPvpMatchingCondition).some(row=>!serialPvp.serialPvpGrade[row.slot2]) ||
      Object.values(serialPvp.serialPvpRankingRewardItem).some(row=>!serialPvp.serialPvpRankingRewardGroup[row.slot1]))
    throw new Error('Invalid original Telskyura Abyss season/rule/score/ticket/grade/reward joins');
  //2573e48 binds the owned ticketId;25746e0 reads recovery from slot10.
  // Reuse the already decoded original rows, keeping legacy serial catalogs unchanged.
  for(const [id,row] of Object.entries(serialPvp.serialPvpSpTicketItem)) {
    const [key,value]=registerItem('serialPvpSpTicketItem',Number(id),row.slot1);
    if(Object.hasOwn(items,key)) throw new Error(`Duplicate original item key ${key}`);
    items[key]=value;
  }
  // Native DropItem::executeLottery retains three ordered slots per row and
  // draws against 10000; one authored row has a negative slot, so keep it raw.
  const battleDropPools=Object.fromEntries(read('dropItem', [['id','int'],null,
    ...Array.from({length:3},(_,i)=>[[`key${i}`,'string'],[`amount${i}`,'int'],[`rate${i}`,'int']]).flat()])
    .map(({id,...row})=>{
      const slots=Array.from({length:3},(_,i)=>{
        const key=row[`key${i}`];
        if(key && !items[key]) throw new Error(`Unknown original battle-drop item ${key}`);
        return [items[key]??0,row[`amount${i}`],row[`rate${i}`]];
      });
      if(slots.reduce((sum,slot)=>sum+slot[2],0)>10000)
        throw new Error(`Original battle-drop rate sum exceeds native limit: ${id}`);
      return [id,slots];
    }));
  const battleEnemyParties={};
  for(const row of read('enemyParty', [['id','int'],['partyKey','int'],...Array(30).fill(null),
    ...Array.from({length:5},(_,i)=>[`drop${i}`,'int'])]))
    (battleEnemyParties[row.partyKey]??=[]).push([row.id,...Array.from({length:5},(_,i)=>row[`drop${i}`])]);
  const battleEncounters={};
  for(const row of read('adventureEncounter', [['id','long'],['stageId','long'],null,null,null,['partyKey','int']]))
    (battleEncounters[row.stageId]??=[]).push([row.id,row.partyKey]);
  return { version: 1, clientVersion: '15.1.0', sources, characters, communicationCharacters, characterCostumes, communicationVoices, cpItems, dpItems, dpLevels, consumes, currencies, items, itemProfiles, achievements, achievementTimeBonuses, stages, stageSRewards, stageExperience, stageRaidStamina, stageProgression, adventureProgression, adventureKeys, episodeProgression, stageUnlocks, stageTasks, pveScoreBase, pveScores,
    pvbEvents, pvbAchievementRules, pvbStages, pvbSurvivalBonuses, pvbGrades, pvbRankingRewards, gveEvents, gveStages, gveTurnBonuses, gveActionBonuses,
    guildRaidEvents, guildRaidStages, guildRaidDefeatRewards, guildRaidStageDefeatRewards, guildRaidAttemptRules, guildRaidStaminaMultipliers,
    unionRaidEvents,unionRaidAttemptRules,unionRaidTickets,unionRaidDefeatRewards,
    unionRaidDefeatCountRewardGroupByInformation,unionRaidDefeatCountRewardGroups,unionRaidDefeatCountRewards,
    unionRaidLogGroups,unionRaidLogs,
    adventureRaids, adventureRaidGroups, adventureRaidParts, adventureRaidPartStages,
    elementEventInfoIds, elementEventDifficulties, elementEventStages, elementEventScoring, elementEventTurnBonuses, elementEventActionBonuses, elementRankingRewards,
    expeditionStages, expeditionStageRequirements, expeditionConditions, expeditionRewardGroups, eventBoxes, loginExplorers, characterPresents, votes, shootingGames, shootingPcIds, shootingDailyRewards, takarakujiInfos, takarakujiItems, takarakujiItemIds, pcs, memorias, memoriaLevels, shopProducts, shopPacks,
    lotteries, lotteryStepUps, lotterySteps, lotteryScratches, lotteryWeights, lotteryPools,
    selectLineupWeights, selectLineupPools, lotteryTickets, subscriptionTickets, subscriptions, subscriptionDisplays, skipTickets,
    bonds, adScratches, scratches, advertisementIrisReward, shootingRewardMessage,
    pcProfiles, pcInitialStates, pcGuests, pcGuestLevelSteps, pcLimitBreakJobs, pcHeroSublimateGroups, pcHeroSublimateSteps, equipments, equipmentGiftPresets, equipmentAbilities, equipmentAbilityPcRaritySteps, equipmentEvolveAbilities, equipmentEvolutions, pcJobRanks, pcJobPanelGroups, pcAbilityTypes, pcAbilities, pcAbilityPanels,
    pcJobMaxLevels, pcLevels, pcBaseStats, pcLevelGrowth, playerLevels, playerMaxSP, familiaGodIds, familiaStyleIds, familiaTimeIds, familiaActivityTimes,
    familiaFirstReward, familiaValisDonations, familiaDonationItems, familiaLevels, familiaShops, familiaStamps, familiaDailyAchievements, familiaMissionAchievements, gveInformationIds, familiaSkillGroups, familiaSkills,
    guildVsGuild, guildVsGuildTournaments, underPvp, serialPvp, serialPvpMessages, systemFlags, titleBadges, keyItems, stageKeys, featureUnlocks, pvpInformationIds, pvpGradeIds, pvp, warGameAchievements, warGameSeasonRewards,
    battleDropPools,battleEnemyParties,battleEncounters };
}

module.exports = { nativeMasterConfig, decodeFile, decodeBlock, decodeNumber, decodeTable, rows, field,
  encodeFile, encodeBlock, encodeNumber, gameplayData };
if (require.main === module) {
  const [contents, config, output, binary] = process.argv.slice(2);
  if (!contents || !config || !output || config==='--native' && !binary)
    throw new Error('Usage: node decode_master_data.cjs CONTENTS --native OUTPUT_JSON ORIGINAL_ARM64_SO (or CONTENTS CONFIG_JSON OUTPUT_JSON)');
  const data = gameplayData(contents, config==='--native' ? nativeMasterConfig(binary) : JSON.parse(fs.readFileSync(config, 'utf8')));
  fs.writeFileSync(output, JSON.stringify(data) + '\n');
  console.log(`Decoded ${Object.keys(data.characters).length} characters from ${Object.keys(data.sources).length} original master tables`);
}
