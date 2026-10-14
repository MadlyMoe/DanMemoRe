"""Recover singleton versus collection pull shapes from EU 15.1.0 ARM64."""
import hashlib
import json
from pathlib import Path
import struct
import sys
from inventory_client_routes import sections, signed


def inventory(binary, names):
    blob = binary.read_bytes()
    text = sections(blob)['.text']
    def word(at):
        return struct.unpack_from('<I', blob, text['offset'] + at - text['address'])[0]
    by_name = {name[4:].lower(): name for name in names}
    by_name.update({'explorerstates': 'UserExplorerState', 'equipmentinventory': 'UserEquipment',
        'equipmentrecipe': 'UserEquipmentRecipeState', 'elementeventrecords': 'UserElementEventRecord',
        'shootinggameinfo': 'UserShootingGame', 'userguestevent': 'UserGuestEvent'})
    result = {}
    for at in range(0x27f0fec, 0x27ff14c, 4):
        instruction = word(at)
        if instruction & 0x9f00001f != 0x90000003:
            continue
        add = word(at + 4)
        if add & 0xffc003ff != 0x91000063:
            continue
        address = (at & ~0xfff) + (signed(((instruction >> 29) & 3) | ((instruction >> 5 & 0x7ffff) << 2), 21) << 12)
        address += (add >> 10) & 0xfff
        end = blob.find(b'\0', address)
        key = blob[address:end].decode('ascii', errors='ignore')
        if key.lower() not in by_name:
            continue
        branch = next((pos for pos in range(at + 8, at + 40, 4) if word(pos) & 0xfe00001f == 0x34000000), None)
        if branch is None:
            continue
        target = branch + 4 if word(branch) & 0x1000000 else branch + (signed((word(branch) >> 5) & 0x7ffff, 19) << 2)
        # Singleton dispatch directly passes the stored row to its deserializer;
        # collection dispatch clears/iterates a vector of shared row pointers.
        singleton = word(target) & 0xffc003ff == 0xf9400260
        result[by_name[key.lower()]] = {'shape': 'object' if singleton else 'array',
            'nativeKey': key, 'dispatch': hex(target)}
    if set(result) != set(names):
        raise ValueError(f'Unmapped tables: {sorted(set(names) - set(result))}')
    return {'version': 1, 'clientVersion': '15.1.0', 'nativeSha256': hashlib.sha256(blob).hexdigest(),
        'tables': dict(sorted(result.items()))}


if __name__ == '__main__':
    binary, seed, output = map(Path, sys.argv[1:])
    result = inventory(binary, json.loads(seed.read_text())['dataTokens'])
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('Singleton pull tables:', ', '.join(name for name, row in result['tables'].items() if row['shape'] == 'object'))
