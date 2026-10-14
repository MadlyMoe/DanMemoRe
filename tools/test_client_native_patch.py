"""DEFERRED / NOT RUN until all packets are implemented; not native acceptance."""
from pathlib import Path
import struct

from offline_client import patch_native_client


def conditional_target(address, word):
    immediate = (word >> 5) & 0x7ffff
    if immediate & 0x40000:
        immediate -= 0x80000
    return address + immediate * 4


def main():
    root = Path(__file__).resolve().parent.parent
    original = (root / ".work/arm64-original/lib/arm64-v8a/libapp.so").read_bytes()
    patched = patch_native_client(original, "arm64-v8a")
    assert len(patched) == len(original)
    assert original[0x25D0300:0x25D0304] == bytes.fromhex("c17e4093")
    assert patched[0x25D0300:0x25D0304] == bytes.fromhex("e10316aa")
    copy_marker = 0x153F050
    copy_words = struct.unpack_from('<8I',patched,copy_marker)
    assert copy_words[:2] == (0xA9BE7BFD,0xF9000BE0) # Save frame/link and exact userdata slot pointer X0.
    assert copy_words[3:] == (0xF9400BE0,0x52800028,0x39014008,0xA8C27BFD,0xD65F03C0)
    assert original[0x2371F70:0x2371F74] == bytes.fromhex("65f31394")
    assert patched[0x286ED64:0x286ED68] == original[0x286ED64:0x286ED68] == bytes.fromhex("60010054")
    gve_replay = 0x153FF80
    gve_replay_words = struct.unpack_from('<26I',patched,gve_replay)
    assert original[gve_replay:gve_replay+136] == bytes(136)
    assert gve_replay_words[:9] == (0xA9B97BFD,0xA90107E0,0xA9020FE2,0xA90317E4,0xA90423E7,0xAD0287E0,
        0xF9405FE0,0xF9400000,0x10000241) # Preserve result args/Q0-Q1; read only caller root at original SP+48.
    assert gve_replay_words[10] == 0xAA1F03E1
    assert gve_replay_words[12:18] == (0x7100041F,0x5280002A,0x1A9F014A,0xF94013E9,0x3901A92A,0xADC287E0)
    assert gve_replay_words[18:] == (0xA94423E7,0xA94317E4,0xA9420FE2,0xA94107E0,
        0xA8C77BFD,0x2A1703E6,0xD65F03C0,0xD503201F)
    assert patched[gve_replay+104:gve_replay+136].rstrip(b'\0') == b'offlineGvePartyApplied'
    assert original[0x246FB70:0x246FB74] == bytes.fromhex('e603172a') # Original MOV W6,W23 daily-high argument.
    gve_gate = 0x1540008
    gve_gate_words = struct.unpack_from('<4I',patched,gve_gate)
    assert original[gve_gate:gve_gate+16] == bytes(16)
    assert conditional_target(gve_gate,gve_gate_words[0]) == 0x1451590 and gve_gate_words[0] & 31 == 9
    assert gve_gate_words[1] == 0x3941A909 # Read only private result padding +6a.
    assert conditional_target(gve_gate+8,gve_gate_words[2]) == 0x1451590 and gve_gate_words[2] & 31 == 9
    assert original[0x145152C:0x1451530] == bytes.fromhex('29030034') # Original high-flag CBZ.
    prefix = 0x153F030
    words = struct.unpack_from('<6I',patched,prefix)
    assert words[0:2] == (0xA9BE7BFD,0xA90107E0) # Preserve frame/link and both parser arguments.
    assert words[3:5] == (0xA94107E0,0xA8C27BFD)
    scratch_gain = 0x153F070
    scratch_words = struct.unpack_from('<3I',patched,scratch_gain)
    assert original[scratch_gain:scratch_gain+12] == bytes(12)
    assert scratch_words == (0x34000041,0xD61F0100,0xD65F03C0) # CBZ W1 -> RET; other quantities BR X8 with original arguments/link.
    zero_target = scratch_gain + (((scratch_words[0] >> 5) & 0x7FFFF) * 4)
    assert zero_target == scratch_gain+8 and scratch_words[0] & 31 == 1
    event_box_counter = 0x16234D0
    counter_words = struct.unpack_from('<14I',patched,event_box_counter)
    assert original[event_box_counter:event_box_counter+88] == bytes(88)
    assert counter_words[:5] == (0xA9BE7BFD,0xA90107E0,0xF94017E0,0xF9400000,0x10000141)
    assert counter_words[6:13] == (0xAA1F03E1,counter_words[7],0x2A0003E9,0xA94107E0,0x34000049,0x51000521,0xA8C27BFD)
    assert event_box_counter+40+(((counter_words[10]>>5)&0x7FFFF)*4) == event_box_counter+48
    assert patched[event_box_counter+56:event_box_counter+88] == b'offlineEventBoxCounterControl\x00'.ljust(32,b'\x00')
    event_box_bonus = 0x1623560
    bonus_words = struct.unpack_from('<17I',patched,event_box_bonus)
    assert original[event_box_bonus:event_box_bonus+100] == bytes(100)
    assert bonus_words[:6] == (0xA9BD7BFD,0xA90107E0,0xA90227E2,0xF9401FE0,0xF9400000,0x10000181)
    assert bonus_words[7:17] == (0xAA1F03E1,bonus_words[8],0x2A0003EA,0xA94227E2,0xA94107E0,
        0x3500006A,0xA8C37BFD,0xD61F0120,0xA8C37BFD,0xD65F03C0)
    assert event_box_bonus+48+(((bonus_words[12]>>5)&0x7FFFF)*4) == event_box_bonus+60
    assert patched[event_box_bonus+68:event_box_bonus+100] == b'offlineEventBoxBonusApplied\x00'.ljust(32,b'\x00')
    event_box_item = 0x16235D0
    item_words = struct.unpack_from('<25I',patched,event_box_item)
    assert original[event_box_item:event_box_item+132] == bytes(132)
    assert item_words[:5] == (0xA9BC7BFD,0xA90107E0,0xA90223E2,0x910203E0,0x100002A1) # Caller row at old SP+40 is shim SP+80.
    assert item_words[6:11] == (0xAA1F03E1,item_words[7],0x2A0003E9,0xA94223E2,0xA94107E0)
    assert conditional_target(event_box_item+44,item_words[11]) == event_box_item+80 and item_words[11]&31 == 9
    assert item_words[12] == 0x3100053F
    assert conditional_target(event_box_item+52,item_words[13]) == event_box_item+92 and item_words[13]&15 == 0
    assert item_words[14:] == (0x51000524,0x528A0003,0x72A00023,0x52800025,0xA8C47BFD,0xD61F0100,
        0x2A1F03E3,0xA8C47BFD,0xD61F0100,0xA8C47BFD,0xD65F03C0)
    assert patched[event_box_item+100:event_box_item+132] == b'offlineEventBoxLifetimeControl\x00'.ljust(32,b'\x00')
    event_box_common = 0x1623660
    common_words = struct.unpack_from('<11I',patched,event_box_common)
    assert original[event_box_common:event_box_common+44] == bytes(44)
    assert common_words[:6] == (0x2A0103F3,0x2A0103F7,0xB9009FFF,0x528A0009,0x72A00029,0x6B09007F) # X8 retains the TLS canary for24d8874.
    assert conditional_target(event_box_common+24,common_words[6]) == event_box_common+32 and common_words[6]&15 == 0
    assert common_words[8:10] == (0x2A0403F7,0xB9009FE5)
    event_box_item_gate = 0x1623690
    item_gate_words = struct.unpack_from('<5I',patched,event_box_item_gate)
    assert original[event_box_item_gate:event_box_item_gate+20] == bytes(20)
    assert item_gate_words[0] == 0xB9409FE8
    assert conditional_target(event_box_item_gate+4,item_gate_words[1]) == event_box_item_gate+12 and item_gate_words[1]&31 == 8
    assert item_gate_words[3] == 0x321C07E0 # Preserve the original MOV W0,#0x30 event allocation argument.
    for offset,opcode in [(0x240CD18,'00013fd6'),(0x240CFCC,'6b1d0094'),(0x240D0DC,'20013fd6'),(0x240D260,'00013fd6')]:
        assert original[offset:offset+4] == bytes.fromhex(opcode)
    for offset,opcode in [(0x24D8870,'f303012a'),(0x24D88FC,'7f060071'),(0x24D890C,'e103132a'),(0x24D8918,'e0071c32')]:
        assert original[offset:offset+4] == bytes.fromhex(opcode)
    assert original[0x24BE31C:0x24BE320] == bytes.fromhex('00013fd6')
    assert patched[0x24BE308:0x24BE31C] == original[0x24BE308:0x24BE31C] # Preserve native item lookup, X8, quantity W1 and signature W2.
    assert patched[0x24BE320:0x24BE47C] == original[0x24BE320:0x24BE47C] # Preserve cleanup, absolute saves and exception/unwind path.
    assert original[0x243AEAC:0x243AEB0] == bytes.fromhex('00013fd6')
    assert patched[0x243AC68:0x243AEAC] == original[0x243AC68:0x243AEAC] # Preserve consumedValis parsing, affordability, row/X8 and quantity/signature W1/W2.
    assert patched[0x243AEB0:0x243B150] == original[0x243AEB0:0x243B150] # Original absolute donation count/date/import/reference cleanup remain.
    assert patched[0x2439D30:0x2439E20] == original[0x2439D30:0x2439E20] # Assign original absolute count and int64 date through their setters.
    assert patched[0x2871068:0x2871250] == original[0x2871068:0x2871250] # Equal saved count/date skip native dirty writes; no new counter hooks.
    familia_callback = 0x153F2E0
    familia_words = struct.unpack_from('<36I',patched,familia_callback)
    assert original[familia_callback:familia_callback+208] == bytes(208)
    familia_page = ((familia_words[0]>>29)&3) | (((familia_words[0]>>5)&0x7FFFF)<<2)
    if familia_page & 0x100000: familia_page -= 0x200000
    assert (familia_callback&~0xFFF)+familia_page*0x1000+0x320 == 0x2572320
    assert familia_words[1:4] == (0x910C8129,0xEB0903DF,0x54000040) # Match original caller LR before touching its stack/JSON, including zero quantity.
    assert familia_callback+12+(((familia_words[3]>>5)&0x7FFFF)*4) == familia_callback+20
    assert familia_words[5:11] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0xAA0203F4,0xB90013E1,0x9102A3E0)
    assert 0xE0-0x58-0x10 == 0x78 and 0x30+0x78 == 0xA8
    assert ((familia_words[10]>>10)&0xFFF) == 0xA8 and ((familia_words[9]>>10)&0xFFF)*4 == 0x10
    assert familia_words[11:15] == (0x34000061,0x10000301,0x14000002,0x100003C1)
    assert familia_callback+44+(((familia_words[11]>>5)&0x7FFFF)*4) == familia_callback+56
    assert familia_callback+52+(familia_words[13]&0x3FFFFFF)*4 == familia_callback+60
    assert familia_callback+48+(((familia_words[12]>>5)&0x7FFFF)*4)+((familia_words[12]>>29)&3) == familia_callback+144
    assert familia_callback+56+(((familia_words[14]>>5)&0x7FFFF)*4)+((familia_words[14]>>29)&3) == familia_callback+176
    assert familia_words[16] == 0xAA1F03E1
    assert familia_words[18:27] == (0xB94013E9,0x340000A9,0x7100041F,0x540000C1,0x2A1F03E9,
        0x14000004,0x7100001F,0x5400004D,0x2A0003E9)
    for index,target in [(19,24),(21,27),(23,27),(25,27),(31,34)]:
        assert familia_callback+index*4+(((familia_words[index]>>5)&0x7FFFF)*4 if index!=23 else
            (familia_words[index]&0x3FFFFFF)*4) == familia_callback+target*4
    assert familia_words[27:33] == (0xAA1303E0,0xAA1403E2,0xA9427BFD,0xA8C353F3,0x34000069,0x2A0903E1)
    assert familia_words[34:36] == (0xD65F03C0,0xD503201F)
    assert patched[familia_callback+144:familia_callback+176] == b'offlineDonationCounterApplied\x00'.ljust(32,b'\x00')
    assert patched[familia_callback+176:familia_callback+208] == b'offlineDonationCounterQuantity\x00'.ljust(32,b'\x00')
    assert original[0x25722C4:0x25722C8] == bytes.fromhex('00013fd6')
    assert original[0x257231C:0x2572320] == bytes.fromhex('05fbff97')
    assert patched[0x2572068:0x25722C4] == original[0x2572068:0x25722C4] # Original itemId/amount parsing, lookup, affordability, row and debit/signature arguments.
    assert patched[0x25722C8:0x257231C] == original[0x25722C8:0x257231C] # Original AppTime provider/cleanup and X0/W1/X2 callback arguments.
    assert patched[0x2572320:0x2572444] == original[0x2572320:0x2572444] # Item/JSON cleanup, canary and unwind remain.
    familia_count = 0x153F3B0
    count_words = struct.unpack_from('<28I',patched,familia_count)
    assert original[familia_count:familia_count+144] == bytes(144)
    count_page = ((count_words[0]>>29)&3) | (((count_words[0]>>5)&0x7FFFF)<<2)
    if count_page & 0x100000: count_page -= 0x200000
    assert (familia_count&~0xFFF)+count_page*0x1000+0xF80 == 0x2570F80
    outer_page = ((count_words[5]>>29)&3) | (((count_words[5]>>5)&0x7FFFF)<<2)
    if outer_page & 0x100000: outer_page -= 0x200000
    assert (familia_count&~0xFFF)+outer_page*0x1000+0x320 == 0x2572320
    assert count_words[1:9] == (0x913E0129,0xEB0903DF,0x540002A1,0xF9402FEA,
        count_words[5],0x910C8129,0xEB09015F,0x54000201)
    assert familia_count+12+(((count_words[3]>>5)&0x7FFFF)*4) == familia_count+96
    assert familia_count+32+(((count_words[8]>>5)&0x7FFFF)*4) == familia_count+96
    assert count_words[9:15] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0x910423E0,0x100001C1)
    assert 0x60+0x78+0x30 == 0x108 and ((count_words[13]>>10)&0xFFF) == 0x108
    assert ((count_words[4]>>10)&0xFFF)*8 == 0x58 # Saved outer caller LR in original helper frame.
    assert familia_count+56+(((count_words[14]>>5)&0x7FFFF)*4)+((count_words[14]>>29)&3) == familia_count+112
    assert count_words[16:24] == (0xAA1F03E1, count_words[17],0x7100041F,0xAA1303E0,
        0x2A1403E1,0xA9427BFD,0xA8C353F3,0x54000040)
    assert familia_count+92+(((count_words[23]>>5)&0x7FFFF)*4) == familia_count+100
    assert count_words[25:28] == (0xD65F03C0,0xD503201F,0xD503201F)
    assert patched[familia_count+112:familia_count+144] == b'offlineDonationCountApplied\x00'.ljust(32,b'\x00')
    assert original[0x2570F7C:0x2570F80] == bytes.fromhex('b3030c94')
    assert patched[0x2570F30:0x2570F7C] == original[0x2570F30:0x2570F7C]
    assert original[0x2570D9C:0x2570DA8] == bytes.fromhex('602240f9e1031f2a29040c94')
    assert original[0x2570D60:0x2570D64] == bytes.fromhex('680600b4')
    assert original[0x2570E2C:0x2570E30] == bytes.fromhex('f3031f2a') # Missing nested row returns zero.
    assert patched[0x2570D3C:0x2570EE0] == original[0x2570D3C:0x2570EE0] # Preserve old-day reset and missing-row zero paths.
    familia_date = 0x153F440
    date_words = struct.unpack_from('<28I',patched,familia_date)
    assert original[familia_date:familia_date+144] == bytes(144)
    date_page = ((date_words[0]>>29)&3) | (((date_words[0]>>5)&0x7FFFF)<<2)
    if date_page & 0x100000: date_page -= 0x200000
    assert (familia_date&~0xFFF)+date_page*0x1000+0xF8C == 0x2570F8C
    date_outer_page = ((date_words[5]>>29)&3) | (((date_words[5]>>5)&0x7FFFF)<<2)
    if date_outer_page & 0x100000: date_outer_page -= 0x200000
    assert (familia_date&~0xFFF)+date_outer_page*0x1000+0x320 == 0x2572320
    assert date_words[1:9] == (0x913E3129,0xEB0903DF,0x540002A1,0xF9402FEA,
        date_words[5],0x910C8129,0xEB09015F,0x54000201)
    assert familia_date+12+(((date_words[3]>>5)&0x7FFFF)*4) == familia_date+96
    assert familia_date+32+(((date_words[8]>>5)&0x7FFFF)*4) == familia_date+96
    assert date_words[9:15] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0xAA0103F4,0x910423E0,0x100001C1)
    assert 0x60+0x78+0x30 == 0x108 and ((date_words[13]>>10)&0xFFF) == 0x108
    assert familia_date+56+(((date_words[14]>>5)&0x7FFFF)*4)+((date_words[14]>>29)&3) == familia_date+112
    assert date_words[16:24] == (0xAA1F03E1,date_words[17],0x7100041F,0xAA1303E0,
        0xAA1403E1,0xA9427BFD,0xA8C353F3,0x54000040)
    assert familia_date+92+(((date_words[23]>>5)&0x7FFFF)*4) == familia_date+100
    assert date_words[25:28] == (0xD65F03C0,0xD503201F,0xD503201F)
    assert patched[familia_date+112:familia_date+144] == b'offlineDonationDateApplied\x00'.ljust(32,b'\x00')
    assert original[0x2570F88:0x2570F8C] == bytes.fromhex('f2030c94')
    assert patched[0x2570F80:0x2570F88] == original[0x2570F80:0x2570F88]
    assert patched[0x2570F8C:0x2571034] == original[0x2570F8C:0x2571034] # Original cleanup and unwind remain.
    assert patched[0x2871E48:0x2871F50] == original[0x2871E48:0x2871F50] # Original equality-guarded scalar setter remains.
    assert patched[0x2871F50:0x2871F54] == original[0x2871F50:0x2871F54]
    casino_gain = 0x153F07C
    casino_words = struct.unpack_from('<3I',patched,casino_gain)
    assert original[casino_gain:casino_gain+12] == bytes(12)
    assert casino_words[0] == 0xB4000041 and casino_words[2] == 0xD65F03C0 # CBZ X1 -> RET; int64 nonzero medals tail-call the original adder.
    assert casino_gain+(((casino_words[0] >> 5) & 0x7FFFF)*4) == casino_gain+8
    assert original[0x236271C:0x2362720] == bytes.fromhex('1b740294')
    assert patched[0x23626E0:0x236271C] == original[0x23626E0:0x236271C] # Keep parsing, singleton lookup, int64 X1 quantity and W2 signature.
    assert patched[0x2362720:0x2362740] == original[0x2362720:0x2362740]
    assert original[0x248D5EC:0x248D5F0] == bytes.fromhex('67c8fd97')
    assert patched[0x248D5D0:0x248D5EC] == original[0x248D5D0:0x248D5EC] # Keep Present root number, singleton and signature setup.
    assert patched[0x248D5F0:0x248D610] == original[0x248D5F0:0x248D610]
    assert patched[0x23FF788:0x23FF86C] == original[0x23FF788:0x23FF86C] # Positive/negative medal arithmetic, caps, signatures and errors remain original.
    stage_xp = 0x153F090
    xp_words = struct.unpack_from('<12I',patched,stage_xp)
    assert original[stage_xp:stage_xp+80] == bytes(80)
    assert xp_words[:4] == (0xA9BE7BFD,0xA90107E0,0xF94002A0,0x10000121) # Save frame/link/arguments; root JSON is original common X21.
    assert xp_words[5] == 0xAA1F03E1 # Absent field/default0 is NOT an applied1.
    assert xp_words[7:11] == (0x7100041F,0xA94107E0,0x1A8103E1,0xA8C27BFD) # CMP1, restore original stage/count, CSEL W1=0 only EQ, restore frame/link.
    assert stage_xp+12+(((xp_words[3]>>5)&0x7ffff)<<2)+((xp_words[3]>>29)&3) == stage_xp+48
    assert patched[stage_xp+48:stage_xp+80] == b'offlineStageXpApplied\x00'.ljust(32,b'\x00')
    stage_skip_guards = 0x153F4D0
    guard_words = struct.unpack_from('<6I',patched,stage_skip_guards)
    assert original[stage_skip_guards:stage_skip_guards+96] == bytes(96)
    assert guard_words[:2] == (0x36000056,0xD65F03C0) # W22 bit0 skips the combined ticket call.
    assert guard_words[3:5] == (0x36080056,0xD65F03C0) # W22 bit1 skips only the SP tail call.
    for index,target in ((2,0x234AFC8),(5,0x2541098)):
        branch=guard_words[index]&0x3ffffff
        if branch&0x2000000: branch-=0x4000000
        assert stage_skip_guards+index*4+branch*4 == target
    assert patched[stage_skip_guards+24:stage_skip_guards+96] == original[stage_skip_guards+24:stage_skip_guards+96]
    stage_skip = 0x16233D0
    skip_words = struct.unpack_from('<36I',patched,stage_skip)
    assert original[stage_skip:stage_skip+240] == bytes(240)
    assert skip_words[:6] == (0xA9BC7BFD,0xA90107E0,0xA9020FE2,0xF9001BF6,0x2A1F03F6,0xF94002A0)
    for index,target in ((6,stage_skip+144),(13,stage_skip+176),(20,stage_skip+208)):
        delta=(((skip_words[index]>>5)&0x7ffff)<<2)+((skip_words[index]>>29)&3)
        assert stage_skip+index*4+delta == target
    assert skip_words[10] == 0x7100041F
    assert stage_skip+44+(((skip_words[11]>>5)&0x7ffff)<<2) == stage_skip+124
    assert skip_words[17:19] == (0x7100041F,0x1A9F17F6) # Ticket marker is exact int1, not truthy.
    assert skip_words[24:27] == (0x7100041F,0x1A9F17E0,0x2A0006D6) # Exact SP marker becomes W22 bit1.
    assert skip_words[27:29] == (0xA9420FE2,0xA94107E0)
    assert skip_words[30:36] == (0x14000003,0xA9420FE2,0xA94107E0,0xF9401BF6,0xA8C47BFD,0xD65F03C0)
    assert patched[stage_skip+144:stage_skip+176] == b'offlineStageSkipApplied\x00'.ljust(32,b'\x00')
    assert patched[stage_skip+176:stage_skip+208] == b'offlineStageSkipTicketsApplied\x00'.ljust(32,b'\x00')
    assert patched[stage_skip+208:stage_skip+240] == b'offlineStageSkipSpApplied\x00'.ljust(32,b'\x00')
    skip_tail = skip_words[29]&0x3ffffff
    if skip_tail&0x2000000: skip_tail-=0x4000000
    assert stage_skip+116+skip_tail*4 == 0x246C4A0 # Selective path calls the original helper once.
    ticket_call = struct.unpack_from('<I',patched,0x246C4C8)[0]&0x3ffffff
    if ticket_call&0x2000000: ticket_call-=0x4000000
    sp_call = struct.unpack_from('<I',patched,0x246C4FC)[0]&0x3ffffff
    if sp_call&0x2000000: sp_call-=0x4000000
    skip_call = struct.unpack_from('<I',patched,0x246C6BC)[0]&0x3ffffff
    if skip_call&0x2000000: skip_call-=0x4000000
    assert original[0x246C4C8:0x246C4CC] == bytes.fromhex('c07afb97')
    assert original[0x246C4FC:0x246C500] == bytes.fromhex('e7520314')
    assert 0x246C4C8+ticket_call*4 == stage_skip_guards
    assert 0x246C4FC+sp_call*4 == stage_skip_guards+12
    assert original[0x246C6BC:0x246C6C0] == bytes.fromhex('79ffff97')
    assert 0x246C6BC+skip_call*4 == stage_skip
    assert patched[0x246C4A0:0x246C4C8] == original[0x246C4A0:0x246C4C8]
    assert patched[0x246C4CC:0x246C4FC] == original[0x246C4CC:0x246C4FC]
    assert patched[0x246C500:0x246C6BC] == original[0x246C500:0x246C6BC]
    assert patched[0x246C6A0:0x246C6BC] == original[0x246C6A0:0x246C6BC]
    assert patched[0x246C6C0:0x246C6D0] == original[0x246C6C0:0x246C6D0]
    assert original[0x246C6D0:0x246C6D4] == bytes.fromhex('56ffff97')
    assert patched[0x246C6C4:0x246C6D0] == original[0x246C6C4:0x246C6D0] # Keep common W19 count and exact original domain argument.
    assert patched[0x246C6D4:0x246DB5C] == original[0x246C6D4:0x246DB5C] # Other gains, objectives, clear/unlock/events/cleanup unchanged.
    assert patched[0x246C428:0x246C4A0] == original[0x246C428:0x246C4A0] # Original cache initialization/float32/signed quantity remains.
    assert patched[0x2540B54:0x2540E78] == original[0x2540B54:0x2540E78] # Original EXP/level/SP events, errors and overflow behavior remain.
    expedition_xp = 0x16231B0
    expedition_xp_words = struct.unpack_from('<29I',patched,expedition_xp)
    assert original[expedition_xp:expedition_xp+256] == bytes(256)
    assert expedition_xp_words[:5] == (0xD10083FF,0xA9017BFD,0x910003FD,0xF94002A0,0x10000321) # Private32-byte frame and retained root X21 only.
    assert expedition_xp_words[6] == expedition_xp_words[15] == expedition_xp_words[21] == 0xAA1F03E1
    assert expedition_xp_words[8:12] == (0x7100041F,0x1A9703F7,0x1A97C017,0xB90003F7) # Exact1 zeros W23; a receipt-bound value above1 overrides it.
    assert expedition_xp_words[12:14] == (0xF94002A0,0x10000301)
    assert expedition_xp_words[17:20] == (0xB90033E0,0xF94002A0,0x10000341) # Party at original SP+10; then parse complete stage marker.
    assert expedition_xp_words[23:28] == (0xB90023E0,0xB94003E0,0xA9417BFD,0x910083FF,0x7100041F) # Stage at unused original SP+0; restore count/frame/compare.
    for index,target in [(4,expedition_xp+116),(13,expedition_xp+148),(19,expedition_xp+180)]:
        assert expedition_xp+index*4+(((expedition_xp_words[index]>>5)&0x7ffff)<<2)+((expedition_xp_words[index]>>29)&3) == target
    assert patched[expedition_xp+116:expedition_xp+148] == b'offlineExpeditionXpApplied\x00'.ljust(32,b'\x00')
    assert patched[expedition_xp+148:expedition_xp+180] == b'offlineExpeditionPartyApplied\x00'.ljust(32,b'\x00')
    assert patched[expedition_xp+180:expedition_xp+212] == b'offlineExpeditionStageApplied\x00'.ljust(32,b'\x00')
    expedition_party_gate=expedition_xp+212; party_words=struct.unpack_from('<6I',patched,expedition_party_gate)
    assert party_words[:4] == (0xB94013E8,0x7100051F,0x54000041,0xD65F03C0) # Exact1 returns; absent/other reaches original deletion.
    assert party_words[5] == 0xD503201F
    expedition_stage_gate=expedition_xp+236; stage_words=struct.unpack_from('<5I',patched,expedition_stage_gate)
    assert stage_words[:3] == (0xB94003E8,0x7100051F,0x54000041) # Exact1 skips the complete stage mutation pair; absent/other tail-calls stageFinish.
    assert original[0x2308EE0:0x2308EE4] == bytes.fromhex('1f040071')
    assert patched[0x2308E08:0x2308EE0] == original[0x2308E08:0x2308EE0]
    assert original[0x2309274:0x2309278] == bytes.fromhex('5a2d0094')
    assert original[0x2309284:0x2309288] == bytes.fromhex('cbe3ff97')
    assert patched[0x2308EE4:0x2309274] == original[0x2308EE4:0x2309274]
    assert patched[0x2309278:0x2309284] == original[0x2309278:0x2309284]
    assert patched[0x2309288:0x2309498] == original[0x2309288:0x2309498] # Iris/items/friendship/expiry/save/ACK stay original.
    stage_cp = 0x153F0E0
    cp_words = struct.unpack_from('<20I',patched,stage_cp)
    assert original[stage_cp:stage_cp+112] == bytes(112)
    assert original[0x23E6CB8:0x23E6CBC] == bytes.fromhex('402c0054')
    assert cp_words[0] == cp_words[6] == cp_words[16] == 0x54000040 # Changed level enters original fanout; stage caller/marker controls the equal path.
    assert cp_words[2] == 0xF9404FE9 # Original CP-frame saved caller LR at SP+98, not the most recent nested call LR.
    assert cp_words[4:6] == (0x9139E14A,0xEB0A013F) # Caller address+e78 and CMP X9,X10.
    caller_page = ((cp_words[3]>>29)&3) | (((cp_words[3]>>5)&0x7FFFF)<<2)
    if caller_page & 0x100000: caller_page -= 0x200000
    assert ((stage_cp+12)&~0xFFF)+caller_page*0x1000+0xE78 == 0x246CE78
    assert cp_words[8:11] == (0xA9BE7BFD,0x9104C3E0,0x10000141) # Frame/link; original common friendship JSON = new SP+130.
    assert 0x20+0xA0+0x70 == 0x130
    assert stage_cp+40+(((cp_words[10]>>5)&0x7FFFF)<<2)+((cp_words[10]>>29)&3) == stage_cp+80
    assert cp_words[12] == 0xAA1F03E1 and cp_words[14:17] == (0x7100041F,0xA8C27BFD,0x54000040)
    assert patched[stage_cp+80:stage_cp+112] == b'offlineStageCpLevelPending\x00'.ljust(32,b'\x00')
    assert cp_words[19] == 0xD503201F
    dispatch_cp = 0x16232B0
    dispatch_cp_words = struct.unpack_from('<16I',patched,dispatch_cp)
    assert original[dispatch_cp:dispatch_cp+96] == bytes(96)
    dispatch_page = ((dispatch_cp_words[0]>>29)&3) | (((dispatch_cp_words[0]>>5)&0x7FFFF)<<2)
    if dispatch_page & 0x100000: dispatch_page -= 0x200000
    assert (dispatch_cp&~0xFFF)+dispatch_page*0x1000+0x220 == 0x2309220
    assert dispatch_cp_words[1:4] == (0x9108814A,0xEB0A013F,0x54000040) # Exact operation21000 setter return address, then local parse path.
    assert conditional_target(dispatch_cp+12,dispatch_cp_words[3]) == dispatch_cp+20
    assert dispatch_cp_words[5:8] == (0xA9BE7BFD,0x910363E0,0x10000121) # Frame/link; current entry JSON = new SP+d8.
    assert 0x20+0xA0+0x18 == 0xD8
    assert dispatch_cp+28+(((dispatch_cp_words[7]>>5)&0x7FFFF)<<2)+((dispatch_cp_words[7]>>29)&3) == dispatch_cp+64
    assert dispatch_cp_words[9] == 0xAA1F03E1 and dispatch_cp_words[11:14] == (0x7100041F,0xA8C27BFD,0x54000040)
    assert conditional_target(dispatch_cp+52,dispatch_cp_words[13]) == dispatch_cp+60
    assert patched[dispatch_cp+64:dispatch_cp+96] == b'offlineExpeditionCpLevelPending\x00'
    dispatch_call=struct.unpack_from('<I',original,0x230921C)[0]
    dispatch_call_imm=dispatch_call&0x03FFFFFF
    if dispatch_call_imm&0x02000000: dispatch_call_imm-=0x04000000
    assert dispatch_call&0xFC000000==0x94000000 and 0x230921C+dispatch_call_imm*4==0x23E6B08
    assert 0x230921C+4 == 0x2309220
    friendship_cp = 0x1623310
    friendship_cp_words = struct.unpack_from('<16I',patched,friendship_cp)
    assert original[friendship_cp:friendship_cp+96] == bytes(96)
    friendship_page = ((friendship_cp_words[0]>>29)&3) | (((friendship_cp_words[0]>>5)&0x7FFFF)<<2)
    if friendship_page & 0x100000: friendship_page -= 0x200000
    assert (friendship_cp&~0xFFF)+friendship_page*0x1000+0x7D0 == 0x23EB7D0
    assert friendship_cp_words[1:4] == (0x911F414A,0xEB0A013F,0x54000040)
    assert conditional_target(friendship_cp+12,friendship_cp_words[3]) == friendship_cp+20
    assert friendship_cp_words[5:8] == (0xA9BE7BFD,0x910343E0,0x10000121) # Current11000 row = new SP+d0.
    assert 0x20+0xA0+0x10 == 0xD0
    assert friendship_cp+28+(((friendship_cp_words[7]>>5)&0x7FFFF)<<2)+((friendship_cp_words[7]>>29)&3) == friendship_cp+64
    assert friendship_cp_words[9] == 0xAA1F03E1 and friendship_cp_words[11:14] == (0x7100041F,0xA8C27BFD,0x54000040)
    assert conditional_target(friendship_cp+52,friendship_cp_words[13]) == friendship_cp+60
    assert patched[friendship_cp+64:friendship_cp+96] == b'offlineFriendshipCpLevelPending\x00'
    friendship_call=struct.unpack_from('<I',original,0x23EB7CC)[0]
    friendship_call_imm=friendship_call&0x03FFFFFF
    if friendship_call_imm&0x02000000: friendship_call_imm-=0x04000000
    assert friendship_call&0xFC000000==0x94000000 and 0x23EB7CC+friendship_call_imm*4==0x23E6B08
    assert 0x23EB7CC+4 == 0x23EB7D0
    friendship_item = 0x1623370
    friendship_item_words = struct.unpack_from('<12I',patched,friendship_item)
    assert original[friendship_item:friendship_item+96] == bytes(96)
    assert friendship_item_words[0] == 0x54000041 and conditional_target(friendship_item,friendship_item_words[0]) == friendship_item+8
    assert friendship_item_words[2:4] == (0xF9400260,0x10000121) # Root JSON in X19; marker string at cave+48.
    assert friendship_item+12+(((friendship_item_words[3]>>5)&0x7FFFF)<<2)+((friendship_item_words[3]>>29)&3) == friendship_item+48
    assert friendship_item_words[5] == 0xAA1F03E1 and friendship_item_words[7:9] == (0x7100041F,0x54000041)
    assert conditional_target(friendship_item+32,friendship_item_words[8]) == friendship_item+40
    assert patched[friendship_item+48:friendship_item+96] == b'offlineFriendshipItemApplied\x00'.ljust(48,b'\x00')
    assert original[0x23EB2C8:0x23EB2CC] == bytes.fromhex('20150054') # Missing itemId retains the original skip branch.
    assert patched[0x23E6B08:0x23E6CB8] == original[0x23E6B08:0x23E6CB8] # Original hero/points/clamp/protected setter/level calculation remain.
    assert patched[0x23E6CBC:0x23E7564] == original[0x23E6CBC:0x23E7564] # Original stats/refill/event/quest/voice/cleanup remain.
    stage_counts,stage_json,stage_cumulative,stage_last_date = 0x153F150,0x153F1D0,0x153F1E0,0x153F260
    pvb_counts,pvb_last_date,pvb_cumulative,pvb_score_event = 0x153F530,0x153F5B0,0x153F630,0x153F6C0
    gve_counts,gve_last_date,gve_cumulative = 0x1623030,0x16230B0,0x1623130
    counts_words = struct.unpack_from('<24I',patched,stage_counts)
    pvb_count_words = struct.unpack_from('<24I',patched,pvb_counts)
    gve_count_words = struct.unpack_from('<24I',patched,gve_counts)
    json_words = struct.unpack_from('<4I',patched,stage_json)
    assert original[stage_counts:stage_counts+128] == bytes(128) and original[stage_json:stage_json+16] == bytes(16)
    assert original[pvb_counts:pvb_counts+128] == bytes(128)
    assert original[gve_counts:gve_counts+128] == bytes(128)
    assert original[0x246C58C:0x246C590] == bytes.fromhex('f50300aa')
    assert original[0x245197C:0x2451980] == bytes.fromhex('d9030094')
    assert json_words[:2] == (0xAA0003F5,0xF900B7E0) # Keep MOV X21,X0 and retain root JSON at commonSP+168 before X21 is reused.
    assert ((json_words[1]>>10)&0xFFF)*8 == 0x168 and json_words[1]&31 == 0
    assert json_words[3] == 0xD503201F
    assert counts_words[0] == 0xF940BFE9 and ((counts_words[0]>>10)&0xFFF)*8 == 0x178 # Clear-frame original saved caller LR.
    counts_page = ((counts_words[1]>>29)&3) | (((counts_words[1]>>5)&0x7FFFF)<<2)
    if counts_page & 0x100000: counts_page -= 0x200000
    assert ((stage_counts+4)&~0xFFF)+counts_page*0x1000+0x4A0 == 0x246D4A0
    assert counts_words[2:5] == (0x9112814A,0xEB0A013F,0x54000040)
    assert stage_counts+16+(((counts_words[4]>>5)&0x7FFFF)*4) == stage_counts+24 # Exact common caller parses its retained JSON.
    assert pvb_count_words[0] == 0xF940BFE9 and ((pvb_count_words[0]>>10)&0xFFF)*8 == 0x178
    pvb_count_page = ((pvb_count_words[1]>>29)&3) | (((pvb_count_words[1]>>5)&0x7FFFF)<<2)
    if pvb_count_page & 0x100000: pvb_count_page -= 0x200000
    assert ((pvb_counts+4)&~0xFFF)+pvb_count_page*0x1000+0x3C == 0x246F03C
    assert pvb_count_words[2:5] == (0x9100F14A,0xEB0A013F,0x54000040)
    assert conditional_target(pvb_counts+16,pvb_count_words[4]) == pvb_counts+24
    assert pvb_count_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF94123E0,0xF9400000,0x10000181)
    assert 0x30+0x180+0x90 == 0x240 and ((pvb_count_words[10]>>10)&0xFFF)*8 == 0x240
    assert pvb_counts+48+(((pvb_count_words[12]>>5)&0x7FFFF)<<2)+((pvb_count_words[12]>>29)&3) == pvb_counts+96
    assert patched[pvb_counts+96:pvb_counts+128] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert pvb_count_words[14] == 0xAA1F03E1 and pvb_count_words[16] == 0x7100041F
    assert conditional_target(pvb_counts+68,pvb_count_words[17]) == stage_counts+84
    assert gve_count_words[0] == 0xF940BFE9 and ((gve_count_words[0]>>10)&0xFFF)*8 == 0x178
    gve_count_page = ((gve_count_words[1]>>29)&3) | (((gve_count_words[1]>>5)&0x7FFFF)<<2)
    if gve_count_page & 0x100000: gve_count_page -= 0x200000
    assert ((gve_counts+4)&~0xFFF)+gve_count_page*0x1000+0xC78 == 0x246FC78
    assert gve_count_words[2:5] == (0x9131E14A,0xEB0A013F,0x54000040)
    assert conditional_target(gve_counts+16,gve_count_words[4]) == gve_counts+24
    assert gve_count_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF940FFE0,0xF9400000,0x10000181)
    assert 0x30+0x180+0x48 == 0x1F8 and ((gve_count_words[10]>>10)&0xFFF)*8 == 0x1F8
    assert gve_counts+48+(((gve_count_words[12]>>5)&0x7FFFF)<<2)+((gve_count_words[12]>>29)&3) == gve_counts+96
    assert patched[gve_counts+96:gve_counts+128] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert gve_count_words[14] == 0xAA1F03E1 and gve_count_words[16] == 0x7100041F
    assert conditional_target(gve_counts+68,gve_count_words[17]) == stage_counts+84
    assert counts_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF9418FE0,0xF9400000,0x10000181)
    assert 0x30+0x180+0x168 == 0x318 and ((counts_words[10]>>10)&0xFFF)*8 == 0x318
    assert stage_counts+48+(((counts_words[12]>>5)&0x7FFFF)<<2)+((counts_words[12]>>29)&3) == stage_counts+96
    assert patched[stage_counts+96:stage_counts+128] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert counts_words[14] == 0xAA1F03E1 and counts_words[16:20] == (0x7100041F,0x54000080,0xAA1303E0,0x2A1403E1)
    assert stage_counts+68+(((counts_words[17]>>5)&0x7FFFF)*4) == stage_counts+84 # Exact1 skips both additions, not the clear routine.
    assert counts_words[21:] == (0xA9427BFD,0xA8C353F3,0xD65F03C0) # Restore frame/link/callee-saved original stage and count.
    assert patched[0x2451924:0x245197C] == original[0x2451924:0x245197C] # Preserve stage lookup/state setter/original event count W21.
    cumulative_words = struct.unpack_from('<24I',patched,stage_cumulative)
    pvb_cumulative_words = struct.unpack_from('<28I',patched,pvb_cumulative)
    gve_cumulative_words = struct.unpack_from('<24I',patched,gve_cumulative)
    pvb_score_event_words = struct.unpack_from('<14I',patched,pvb_score_event)
    assert original[stage_cumulative:stage_cumulative+128] == bytes(128)
    assert original[pvb_cumulative:pvb_cumulative+144] == bytes(144)
    assert original[gve_cumulative:gve_cumulative+128] == bytes(128)
    assert original[pvb_score_event:pvb_score_event+88] == bytes(88)
    assert original[0x246F008:0x246F00C] == bytes.fromhex('30010094')
    assert original[0x245293C:0x2452940] == bytes.fromhex('78500894')
    assert cumulative_words[0] == 0xF94027E9 and ((cumulative_words[0]>>10)&0xFFF)*8 == 0x48 # Original helper saved LR, not the cumulative-setter return address.
    cumulative_page = ((cumulative_words[1]>>29)&3) | (((cumulative_words[1]>>5)&0x7FFFF)<<2)
    if cumulative_page & 0x100000: cumulative_page -= 0x200000
    assert ((stage_cumulative+4)&~0xFFF)+cumulative_page*0x1000+0x1A4 == stage_counts+84
    assert cumulative_words[2:4] == (0x9106914A,0xEB0A013F)
    assert conditional_target(stage_cumulative+16,cumulative_words[4]) == pvb_cumulative
    assert pvb_cumulative_words[0] == 0xF940FFE9 and ((pvb_cumulative_words[0]>>10)&0xFFF)*8 == 0x1F8
    pvb_cumulative_common_page = ((pvb_cumulative_words[1]>>29)&3) | (((pvb_cumulative_words[1]>>5)&0x7FFFF)<<2)
    if pvb_cumulative_common_page & 0x100000: pvb_cumulative_common_page -= 0x200000
    assert (pvb_cumulative&~0xFFF)+pvb_cumulative_common_page*0x1000+0x4A0 == 0x246D4A0
    assert conditional_target(pvb_cumulative+16,pvb_cumulative_words[4]) == stage_cumulative+24
    pvb_cumulative_page = ((pvb_cumulative_words[5]>>29)&3) | (((pvb_cumulative_words[5]>>5)&0x7FFFF)<<2)
    if pvb_cumulative_page & 0x100000: pvb_cumulative_page -= 0x200000
    assert ((pvb_cumulative+20)&~0xFFF)+pvb_cumulative_page*0x1000+0x3C == 0x246F03C
    assert pvb_cumulative_words[6:9] == (0x9100F14A,0xEB0A013F,0x54000040)
    assert conditional_target(pvb_cumulative+32,pvb_cumulative_words[8]) == pvb_cumulative+40
    assert pvb_cumulative_words[10:17] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF94163E0,0xF9400000,0x10000181)
    assert 0x30+0x50+0x30+0x180+0x90 == 0x2C0 and ((pvb_cumulative_words[14]>>10)&0xFFF)*8 == 0x2C0
    assert pvb_cumulative+64+(((pvb_cumulative_words[16]>>5)&0x7FFFF)<<2)+((pvb_cumulative_words[16]>>29)&3) == pvb_cumulative+112
    assert patched[pvb_cumulative+112:pvb_cumulative+144] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert pvb_cumulative_words[18] == 0xAA1F03E1 and pvb_cumulative_words[20] == 0x7100081F
    assert conditional_target(pvb_cumulative+84,pvb_cumulative_words[21]) == stage_cumulative+84
    assert gve_cumulative_words[0] == 0xF940FFE9 and ((gve_cumulative_words[0]>>10)&0xFFF)*8 == 0x1F8
    gve_cumulative_page = ((gve_cumulative_words[1]>>29)&3) | (((gve_cumulative_words[1]>>5)&0x7FFFF)<<2)
    if gve_cumulative_page & 0x100000: gve_cumulative_page -= 0x200000
    assert ((gve_cumulative+4)&~0xFFF)+gve_cumulative_page*0x1000+0xC78 == 0x246FC78
    assert gve_cumulative_words[2:5] == (0x9131E14A,0xEB0A013F,0x54000040)
    assert conditional_target(gve_cumulative+16,gve_cumulative_words[4]) == gve_cumulative+24
    assert gve_cumulative_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF9413FE0,0xF9400000,0x10000181)
    assert 0x30+0x50+0x30+0x180+0x48 == 0x278 and ((gve_cumulative_words[10]>>10)&0xFFF)*8 == 0x278
    assert gve_cumulative+48+(((gve_cumulative_words[12]>>5)&0x7FFFF)<<2)+((gve_cumulative_words[12]>>29)&3) == gve_cumulative+96
    assert patched[gve_cumulative+96:gve_cumulative+128] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert gve_cumulative_words[14] == 0xAA1F03E1 and gve_cumulative_words[16] == 0x7100081F
    assert conditional_target(gve_cumulative+68,gve_cumulative_words[17]) == stage_cumulative+84
    assert pvb_score_event_words[:5] == (0xA9BE7BFD,0xF9000BE0,0xF9405BE0,0xF9400000,0x10000141)
    assert ((pvb_score_event_words[2]>>10)&0xFFF)*8 == 0xB0 # New SP20 + exact callback root at caller SP90.
    assert pvb_score_event+16+(((pvb_score_event_words[4]>>5)&0x7FFFF)<<2)+((pvb_score_event_words[4]>>29)&3) == pvb_score_event+56
    assert patched[pvb_score_event+56:pvb_score_event+88] == b'offlinePvbScoreEventApplied\x00'.ljust(32,b'\x00')
    assert pvb_score_event_words[6] == 0xAA1F03E1 and pvb_score_event_words[8:12] == (0x7100041F,0xF9400BE0,0xA8C27BFD,0x54000040)
    assert conditional_target(pvb_score_event+44,pvb_score_event_words[11]) == pvb_score_event+52
    assert pvb_score_event_words[13] == 0xD65F03C0
    assert patched[0x246EFF0:0x246F008] == original[0x246EFF0:0x246F008] # Event allocation and score clamp remain original.
    assert patched[0x246F00C:0x246F038] == original[0x246F00C:0x246F038] # Event cleanup and direct clear remain original.
    assert cumulative_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0x2A0103F4,0xF941CFE0,0xF9400000,0x10000181)
    assert 0x30+0x50+0x30+0x180+0x168 == 0x398 and ((cumulative_words[10]>>10)&0xFFF)*8 == 0x398
    assert stage_cumulative+48+(((cumulative_words[12]>>5)&0x7FFFF)<<2)+((cumulative_words[12]>>29)&3) == stage_cumulative+96
    assert patched[stage_cumulative+96:stage_cumulative+128] == b'offlineStageClearCountsApplied\x00'.ljust(32,b'\x00')
    assert cumulative_words[14] == 0xAA1F03E1 and cumulative_words[16:20] == (0x7100081F,0x54000080,0xAA1303E0,0x2A1403E1)
    assert stage_cumulative+68+(((cumulative_words[17]>>5)&0x7FFFF)*4) == stage_cumulative+84 # Exact2 skips only cumulative; daily still uses the original helper.
    assert cumulative_words[21:] == (0xA9427BFD,0xA8C353F3,0xD65F03C0)
    last_date_words = struct.unpack_from('<24I',patched,stage_last_date)
    pvb_date_words = struct.unpack_from('<24I',patched,pvb_last_date)
    gve_date_words = struct.unpack_from('<24I',patched,gve_last_date)
    assert original[stage_last_date:stage_last_date+128] == bytes(128)
    assert original[pvb_last_date:pvb_last_date+128] == bytes(128)
    assert original[gve_last_date:gve_last_date+128] == bytes(128)
    assert original[0x2451998:0x245199C] == bytes.fromhex('8d530894')
    assert last_date_words[0] == 0xF940BFE9 and ((last_date_words[0]>>10)&0xFFF)*8 == 0x178
    last_date_page = ((last_date_words[1]>>29)&3) | (((last_date_words[1]>>5)&0x7FFFF)<<2)
    if last_date_page & 0x100000: last_date_page -= 0x200000
    assert ((stage_last_date+4)&~0xFFF)+last_date_page*0x1000+0x4A0 == 0x246D4A0
    assert last_date_words[2:5] == (0x9112814A,0xEB0A013F,0x54000040)
    assert stage_last_date+16+(((last_date_words[4]>>5)&0x7FFFF)*4) == stage_last_date+24
    assert pvb_date_words[0] == 0xF940BFE9 and ((pvb_date_words[0]>>10)&0xFFF)*8 == 0x178
    pvb_date_page = ((pvb_date_words[1]>>29)&3) | (((pvb_date_words[1]>>5)&0x7FFFF)<<2)
    if pvb_date_page & 0x100000: pvb_date_page -= 0x200000
    assert ((pvb_last_date+4)&~0xFFF)+pvb_date_page*0x1000+0x3C == 0x246F03C
    assert pvb_date_words[2:5] == (0x9100F14A,0xEB0A013F,0x54000040)
    assert conditional_target(pvb_last_date+16,pvb_date_words[4]) == pvb_last_date+24
    assert pvb_date_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0xAA0103F4,0xF94123E0,0xF9400000,0x10000181)
    assert ((pvb_date_words[10]>>10)&0xFFF)*8 == 0x240
    assert pvb_last_date+48+(((pvb_date_words[12]>>5)&0x7FFFF)<<2)+((pvb_date_words[12]>>29)&3) == pvb_last_date+96
    assert patched[pvb_last_date+96:pvb_last_date+128] == b'offlineStageLastDateApplied\x00'.ljust(32,b'\x00')
    assert pvb_date_words[14] == 0xAA1F03E1 and pvb_date_words[16] == 0x7100041F
    assert conditional_target(pvb_last_date+68,pvb_date_words[17]) == stage_last_date+84
    assert gve_date_words[0] == 0xF940BFE9 and ((gve_date_words[0]>>10)&0xFFF)*8 == 0x178
    gve_date_page = ((gve_date_words[1]>>29)&3) | (((gve_date_words[1]>>5)&0x7FFFF)<<2)
    if gve_date_page & 0x100000: gve_date_page -= 0x200000
    assert ((gve_last_date+4)&~0xFFF)+gve_date_page*0x1000+0xC78 == 0x246FC78
    assert gve_date_words[2:5] == (0x9131E14A,0xEB0A013F,0x54000040)
    assert conditional_target(gve_last_date+16,gve_date_words[4]) == gve_last_date+24
    assert gve_date_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0xAA0103F4,0xF940FFE0,0xF9400000,0x10000181)
    assert ((gve_date_words[10]>>10)&0xFFF)*8 == 0x1F8
    assert gve_last_date+48+(((gve_date_words[12]>>5)&0x7FFFF)<<2)+((gve_date_words[12]>>29)&3) == gve_last_date+96
    assert patched[gve_last_date+96:gve_last_date+128] == b'offlineStageLastDateApplied\x00'.ljust(32,b'\x00')
    assert gve_date_words[14] == 0xAA1F03E1 and gve_date_words[16] == 0x7100041F
    assert conditional_target(gve_last_date+68,gve_date_words[17]) == stage_last_date+84
    assert last_date_words[6:13] == (0xA9BD53F3,0xA9027BFD,0xAA0003F3,0xAA0103F4,0xF9418FE0,0xF9400000,0x10000181)
    assert ((last_date_words[10]>>10)&0xFFF)*8 == 0x318
    assert stage_last_date+48+(((last_date_words[12]>>5)&0x7FFFF)<<2)+((last_date_words[12]>>29)&3) == stage_last_date+96
    assert patched[stage_last_date+96:stage_last_date+128] == b'offlineStageLastDateApplied\x00'.ljust(32,b'\x00')
    assert last_date_words[14] == 0xAA1F03E1 and last_date_words[16:20] == (0x7100041F,0x54000080,0xAA1303E0,0xAA1403E1) # Preserve the original int64 date X1, not W1.
    assert stage_last_date+68+(((last_date_words[17]>>5)&0x7FFFF)*4) == stage_last_date+84
    assert last_date_words[21:] == (0xA9427BFD,0xA8C353F3,0xD65F03C0)
    assert patched[0x2451980:0x2451998] == original[0x2451980:0x2451998] # Original time service/wrapper allocation remain.
    assert patched[0x245199C:0x245293C] == original[0x245199C:0x245293C] # FIRST reads live LAST/sets original date; events/features/story/helper construction remain.
    assert patched[0x26667CC:0x26668AC] == original[0x26667CC:0x26668AC] # Original int64 LAST protected setter is unchanged.
    assert patched[0x2452940:0x24529FC] == original[0x2452940:0x24529FC] # Daily setter, reference cleanup, canary and unwind unchanged.
    assert patched[0x246C590:0x246C6D0] == original[0x246C590:0x246C6D0]
    assert patched[0x246D2C8:0x246D4A0] == original[0x246D2C8:0x246D4A0] # Reused X21 and top-level call remain original.
    # WRITTEN ONLY: exact clean-import caller scopes and accepted-pull-only dirty/flush path.
    union_init,union_info,union_boss,union_normal,union_marker,union_flush = (
        0x153F720,0x153F730,0x153F750,0x153F770,0x153F790,0x153F860)
    init_words = struct.unpack_from('<4I',patched,union_init)
    assert init_words[:3] == (0xF9007FFF,0xF90103FF,0xF90107FF) # Original F8 store; private pull flag/pointer at SP200/208.
    marker_words = struct.unpack_from('<44I',patched,union_marker)
    flush_words = struct.unpack_from('<32I',patched,union_flush)
    for start,continuation,caller,dirty,clear in [
        (union_info,0x25FAC28,0x27F298C,0x8A0,0x3922827F),
        (union_boss,0x281151C,0x27FE6FC,0x158,0x3905627F),
        (union_normal,0x2811924,0x27FE854,0x158,0x3905627F)]:
        entry = struct.unpack_from('<8I',patched,start)
        assert entry[0] == clear and entry[7] == 0xD503201F
        for index,target,register in [(1,continuation,11),(4,caller,13)]:
            page = ((entry[index]>>29)&3) | (((entry[index]>>5)&0x7FFFF)<<2)
            if page & 0x100000: page -= 0x200000
            assert entry[index]&31 == register
            assert ((start+index*4)&~0xFFF)+page*0x1000+((entry[index+1]>>10)&0xFFF) == target
        assert entry[3]&31 == 12 and (entry[3]>>5)&31 == 19 and (entry[3]>>10)&0xFFF == dirty
    assert marker_words[:5] == (0xF94007A9,0xEB0D013F,0x54000521,0xF94003AA,0xF9400549)
    pull_page = ((marker_words[5]>>29)&3) | (((marker_words[5]>>5)&0x7FFFF)<<2)
    if pull_page & 0x100000: pull_page -= 0x200000
    assert ((union_marker+20)&~0xFFF)+pull_page*0x1000+((marker_words[6]>>10)&0xFFF) == 0x20BCD24
    for index in [2,8]: assert conditional_target(union_marker+index*4,marker_words[index]) == union_marker+172
    assert marker_words[9:16] == (0xF940014A,0xD102814A,0xA9BA7BE0,0xA90133EB,0xF90013EA,0x9100C3E0,0x100003A1)
    assert 0x2A0-0xA0 == 0x200 and 0x200+0x80 == 0x280
    assert marker_words[17:19] == (0xF94003E0,0x9100C3E1) # Preserve imported map and inline marker CString.
    for index in [20,25,28]: assert conditional_target(union_marker+index*4,marker_words[index]) == union_marker+164
    assert marker_words[21:25] == (0xB9402808,0x7100091F,0x54000060,0x71000D1F) # Only unsigned/signed integer variants2/3.
    assert conditional_target(union_marker+92,marker_words[23]) == union_marker+104
    assert marker_words[26:28] == (0xF9401808,0xF100051F) # Exact int64 representation of1; not bool/string or another integer.
    assert marker_words[29:36] == (0xF94013EA,0xF9400FEC,0xB9400148,0x35000088,0xF900054C,0x52800028,0x14000005)
    assert conditional_target(union_marker+128,marker_words[32]) == union_marker+144
    assert marker_words[36:41] == (0xF9400549,0xEB0C013F,0x54000060,0x52800048,0xB9000148)
    assert conditional_target(union_marker+152,marker_words[38]) == union_marker+164 # Same pointer retains state; conflicts set2, never last-wins.
    assert marker_words[41:] == (0xA94133EB,0xA8C67BE0,0xD61F0160)
    assert not any(word&0xFFC00000 == 0x39000000 for word in marker_words) # No row dirty-byte store during import.
    assert patched[union_marker+176:union_marker+208] == b'offlineUnionTicketUse\x00'.ljust(32,b'\x00')
    assert len(b'offlineUnionTicketUse') <= 22 # Fixed inline CString needs no heap cleanup.
    assert flush_words[:2] == (0xA9B87BFD,0xA90153F3)
    for index in [3,6,8]: assert conditional_target(union_flush+index*4,flush_words[index]) == union_flush+116
    assert flush_words[4:8] == (0xB94283E8,0x7100051F,0x540002E1,0xF94147E9)
    assert ((flush_words[4]>>10)&0xFFF)*4 == 0x280 and ((flush_words[7]>>10)&0xFFF)*8 == 0x288
    assert flush_words[9:13] == (0x52800028,0x39000128,0xF90143FF,0xF90147FF) # Success marks one row, then clears per-pull intent before queueing.
    assert flush_words[14:17] == (0xAA0003F3,0x910083E0,0x10000201)
    assert flush_words[18:26] == (0xA9047FFF,0xF9002BFF,0xAA1303E0,0x910083E1,0x2A1F03E2,0x2A1F03E3,0x2A1F03E4,0x910103E5)
    assert flush_words[29:] == (0xA94153F3,0xA8C87BFD,0xD65F03C0)
    assert patched[union_flush+128:union_flush+144] == b'ItemUsed\x00'.ljust(16,b'\x00')
    for low,high in [(0x25F9748,0x25FAC24),(0x25FAC28,0x25FAC54),
        (0x28111EC,0x2811518),(0x281151C,0x28115F4),(0x28115F4,0x2811920),
        (0x2811924,0x28119EC),(0x20C0D88,0x20C19EC),(0x27FE690,0x27FE9B0)]:
        assert patched[low:high] == original[low:high] # Original setters/import/add/serialize/save/ACK paths remain.
    # WRITTEN ONLY: original per-PC map/owned current-job getter, never the limit-break getter or a new grant.
    lottery_board = 0x153F900
    board_words = struct.unpack_from('<48I',patched,lottery_board)
    assert original[lottery_board:lottery_board+224] == bytes(224)
    assert original[0x22F024C:0x22F0250] == bytes.fromhex('280500b5')
    assert board_words[:8] == (0xB4000568,0xA9BB7BFD,0xA90153F3,0xF90013E8,0xA90407E0,0x910003FD,0x9101E3E0,0x10000521)
    assert conditional_target(lottery_board,board_words[0]) == lottery_board+172 and board_words[0]&31 == 8
    assert ((board_words[6]>>10)&0xFFF) == 0x50+0x28 # Original copied per-PC JSON map at caller SP28.
    assert lottery_board+28+(((board_words[7]>>5)&0x7FFFF)<<2)+((board_words[7]>>29)&3) == lottery_board+192
    assert patched[lottery_board+192:lottery_board+224] == b'offlinePcBoardRecovery\x00'.ljust(32,b'\x00')
    assert board_words[9:17] == (0x79400009,0x12000D29,0x51001529,0x7100053F,0x54000328,0xF9400409,0xF100053F,0x540002C1)
    for index in [13,16,20,25,31]:
        assert conditional_target(lottery_board+index*4,board_words[index]) == lottery_board+152
    assert board_words[13]&15 == 8 and board_words[16]&15 == 1 # Only signed/unsigned integer tags5/6 with exact int64 value1.
    assert board_words[17:23] == (0xF94013E0,0x3940C009,0x7100053F,0x54000241,0x9100C3E8,0xA9037FFF)
    assert ((board_words[18]>>10)&0xFFF) == 0x30 and ((board_words[21]>>10)&0xFFF) == 0x30
    assert board_words[24:37] == (0xF9401FF4,0xB40001B4,0x91002293,0xC85FFE69,0xD100052A,0xC80BFE6A,
        0x35FFFFAB,0xB50000E9,0xF9400288,0xAA1403E0,0xF9400908,0xD63F0100,0xAA1403E0)
    assert conditional_target(lottery_board+120,board_words[30]) == lottery_board+108 # Original shared-control release retry.
    assert board_words[38:42] == (0xF94013E8,0xA94407E0,0xA94153F3,0xA8C57BFD)
    assert board_words[44:] == (0xD503201F,)*4
    for low,high in [(0x22F0170,0x22F024C),(0x22F0250,0x22F0660),(0x22DED68,0x22DFFA8)]:
        assert patched[low:high] == original[low:high] # Original lookup/constructor/character/bond/getter/save paths unchanged.
    # WRITTEN ONLY: conditional original outfit/story helpers precede the independent lazy-board guard.
    lottery_constructor = 0x153FA00
    constructor_words = struct.unpack_from('<48I',patched,lottery_constructor)
    assert original[lottery_constructor:lottery_constructor+224] == bytes(224)
    assert constructor_words[:8] == (0xB4000528,0xA9BB7BFD,0xA90153F3,0xF90013E8,0xA90407E0,0x910003FD,0x9101E3E0,0x10000521)
    assert conditional_target(lottery_constructor,constructor_words[0]) == lottery_constructor+164
    assert lottery_constructor+28+(((constructor_words[7]>>5)&0x7FFFF)<<2)+((constructor_words[7]>>29)&3) == lottery_constructor+192
    assert patched[lottery_constructor+192:lottery_constructor+224] == b'offlinePcConstructorRecovery\x00'.ljust(32,b'\x00')
    assert constructor_words[9:17] == (0x79400009,0x12000D29,0x51001529,0x7100053F,0x54000308,0xF9400409,0xF100053F,0x540002A1)
    for index in [13,16,20,25]:
        assert conditional_target(lottery_constructor+index*4,constructor_words[index]) == lottery_constructor+148
    assert constructor_words[17:24] == (0xF94013E0,0x3940C009,0x7100053F,0x54000221,0xF9400400,0x52801381,0x2A1F03E2)
    assert ((constructor_words[22]>>5)&0xFFFF) == 0x9C # Original PC master slot76, default0.
    assert constructor_words[25:27] == (0x34000180,0xB9002BE0) and constructor_words[28] == 0x9100A3E1
    assert ((constructor_words[26]>>10)&0xFFF)*4 == 0x28 and ((constructor_words[28]>>10)&0xFFF) == 0x28
    assert constructor_words[31:36] == (0xF94013E9,0xB9402929,0xF9001BF7,0xB9003BE9,0x9100C3E1)
    assert ((constructor_words[32]>>10)&0xFFF)*4 == 0x28 and constructor_words[33]&31 == 23 # Actual PC ID and caller's original key vtable.
    assert constructor_words[37:41] == (0xF94013E8,0xA94407E0,0xA94153F3,0xA8C57BFD)
    assert constructor_words[42:] == (0xD503201F,)*6
    for low,high in [(0x22EBBBC,0x22EBFB4),(0x2505FC4,0x250612C),(0x2507B58,0x2507C48),
        (0x2473D9C,0x2473EC4),(0x2450EF4,0x2450F4C),(0x2451204,0x245128C)]:
        assert patched[low:high] == original[low:high] # No constructor, conditional setter, signature or native reward checks bypassed.
    # WRITTEN ONLY: live completed gacha/stage callbacks suppress a repeat, not verifier generation or actual server ACK.
    replay_receipt,replay_string = 0x153FB00,0x153FD00
    receipt_words = struct.unpack_from('<60I',patched,replay_receipt)
    string_words = struct.unpack_from('<28I',patched,replay_string)
    assert original[replay_receipt:replay_receipt+240] == bytes(240)
    assert original[replay_string:replay_string+112] == bytes(112)
    assert original[0x206A360:0x206A364] == bytes.fromhex('00013fd6')
    assert receipt_words[:8] == (0xB9400B09,0x510FA12A,0x7100055F,0x540000A9,0x5282710A,0x6B0A013F,0x54000681,0xD503201F)
    gacha_base,gacha_range,stage_type=(receipt_words[1]>>10)&0xFFF,(receipt_words[2]>>10)&0xFFF,(receipt_words[4]>>5)&0xFFFF
    assert (gacha_base,gacha_range,stage_type)==(1000,1,5000)
    for operation_type in [-0x80000000,-1,0,999,1000,1001,1002,2000,4999,5000,5001,6000,9000,0x7FFFFFFF]:
        assert (((operation_type-gacha_base)&0xFFFFFFFF)<=gacha_range or operation_type==stage_type)==(operation_type in [1000,1001,5000])
    assert conditional_target(replay_receipt+12,receipt_words[3]) == replay_receipt+32 # Unsigned gacha range enters the same receipt guard.
    assert conditional_target(replay_receipt+24,receipt_words[6]) == replay_receipt+232 # Other types tail-call original X8 without a frame.
    assert receipt_words[8:15] == (0xA9BB7BFD,0xA90153F3,0xA90207E0,0xA9030FE2,0xA90423E4,0x910003FD,0xAA1803F4)
    assert receipt_words[15:23] == (0xF940028A,0xF100015F,0x5400044D,0xF94033E9,0xF9401133,0xB40003F3,0xF9401269,0xEB09015F)
    assert ((receipt_words[18]>>10)&0xFFF)*8 == 0x50+0x10 # Original processor pointer in caller SP10.
    assert ((receipt_words[19]>>10)&0xFFF)*8 == 0x18+8 # ID-keyed processed tree, not the type-handler registry.
    assert conditional_target(replay_receipt+92,receipt_words[23]) == replay_receipt+104
    assert conditional_target(replay_receipt+96,receipt_words[24]) == replay_receipt+112
    for index in [17,20,32,36,40,44,48]:
        assert conditional_target(replay_receipt+index*4,receipt_words[index]) == replay_receipt+204
    assert receipt_words[26] == 0xF9400273 and receipt_words[28] == 0xF9400673 # Signed-ID left/right search.
    assert receipt_words[30:42] == (0xF9401669,0xEB0A013F,0x54000261,0xB9403269,0xB9400A8A,0x6B0A013F,
        0x540001E1,0xB9406269,0xB9403A8A,0x6B0A013F,0x54000161,0x91012260)
    assert ((receipt_words[34]>>10)&0xFFF)*4==8 and ((receipt_words[34]>>5)&31)==20 # Compare cached type to the actual incoming type.
    assert receipt_words[42] == 0x91008281 and receipt_words[45:47] == (0x9101A260,0x91010281)
    assert receipt_words[49:53] == (0x52800029,0x14000002,0x2A1F03E9,0xA94423E4)
    assert receipt_words[53:] == (0xA9430FE2,0xA94207E0,0xA94153F3,0xA8C57BFD,0x35000049,0xD61F0100,0xD65F03C0)
    assert conditional_target(replay_receipt+228,receipt_words[57]) == replay_receipt+236
    assert string_words[:11] == (0x39400008,0x360002C8,0x39400029,0x36000289,0xF9400408,0xF9400429,
        0xEB09011F,0x54000201,0xB40001E8,0xF104011F,0x540001A8)
    for index in [1,3,7,8,10,13,14,18]:
        assert conditional_target(replay_string+index*4,string_words[index]) == replay_string+92
    assert all(((string_words[index]>>19)&31)==0 for index in [1,3]) # Only the standard libc++ long-string flag.
    assert string_words[11:20] == (0xF940080A,0xF940082B,0xB400014A,0xB400012B,
        0x3840154C,0x3840156D,0x6B0D019F,0x540000A1,0xF1000508)
    assert conditional_target(replay_string+80,string_words[20]) == replay_string+60
    assert string_words[21:] == (0x52800020,0xD65F03C0,0x2A1F03E0,0xD65F03C0,0xD503201F,0xD503201F,0xD503201F)
    for low,high in [(0x2069E14,0x206A360),(0x206A364,0x206B460),(0x206B464,0x206B578),
        (0x206BA78,0x206BDA0),(0x20BD948,0x20BD958),(0x22EFDB8,0x22EFDC4),(0x22F2044,0x22F2168)]:
        assert patched[low:high] == original[low:high] # Original parsing, signing, receipt insertion/removal, result callback and server ACK flow stay intact.
    # WRITTEN ONLY: resume only the exact marked original gainedPCs occurrence; control5 skips its saved duplicate bond.
    stage_pc_resume=0x153FD80
    stage_pc_effects=0x153FEC0
    resume_words=struct.unpack_from('<68I',patched,stage_pc_resume)
    pc_effect_words=struct.unpack_from('<48I',patched,stage_pc_effects)
    stage_character_words=struct.unpack_from('<11I',patched,0x246C968)
    assert original[stage_pc_resume:stage_pc_resume+304]==bytes(304)
    assert original[stage_pc_effects:stage_pc_effects+192]==bytes(192)
    assert original[0x246C880:0x246C884]==bytes.fromhex('c0010036')
    assert patched[stage_pc_resume+272:stage_pc_resume+304]==b'offlineStagePcResumes\x00'.ljust(32,b'\x00')
    assert resume_words[:5]==(0x360007C0,0xA9BD7BFD,0xA90153F3,0xF94002A0,0x10000801)
    assert stage_pc_resume+4*4+(((resume_words[4]>>5)&0x7FFFF)<<2)==stage_pc_resume+272
    assert resume_words[6:9]==(0x79400008,0x12000D08,0x7100091F)
    assert resume_words[10]==0xF9400413 and resume_words[12]==0xF94073E8
    assert ((resume_words[12]>>10)&0xFFF)*8==0x30+0xB0 # Preserve original array iterator owner.
    assert resume_words[14:17]==(0x79400109,0x12000D29,0x7100093F)
    assert resume_words[18]==0xF9400508 and resume_words[20:23]==(0xA9402909,0xF9407BEB,0xEB09017F)
    assert ((resume_words[21]>>10)&0xFFF)*8==0x30+0xB0+0x10 # Original array iterator uses +10, not object iterator +8.
    assert resume_words[24]==0xEB0A017F and resume_words[26:33]==(0xCB090174,0xF2400E9F,0x540003E1,0xCB09014A,0xA9402668,0xCB080129,0xEB0A013F)
    assert resume_words[35:40]==(0x8B140108,0x79400109,0x12000D29,0x51001529,0x7100053F)
    assert resume_words[41:45]==(0xF9400509,0xD1000534,0xF100129F,0x54000262) # Exact signed/unsigned int64 one through five, not bool/string/float.
    for control in [-1,0,1,2,3,4,5,0x7FFFFFFF,0xFFFFFFFFFFFFFFFF]:
        assert (((control-1)&0xFFFFFFFFFFFFFFFF)<=4)==(control in [1,2,3,4,5])
    assert resume_words[46:49]==(0x9102E3E8,0xD102C3A1,0x2A1F03E2)
    assert ((resume_words[46]>>10)&0xFFF)==0x30+0x88 # Original result shared-pair slot owns later cleanup.
    assert ((resume_words[47]>>10)&0xFFF)==0xB0 and ((resume_words[47]>>5)&31)==29 # Original PC key, unchanged frame pointer.
    assert resume_words[50:52]==(0xF9405FE8,0xB40000A8)
    assert resume_words[53:55]==(0xA94153F3,0xA8C37BFD)
    for index in [9,11,13,17,19,23,25,28,33,34,40]:
        assert conditional_target(stage_pc_resume+index*4,resume_words[index])==stage_pc_resume+236
    assert conditional_target(stage_pc_resume+44*4,resume_words[44])==stage_pc_resume+252
    # TBZ has a 14-bit displacement; no extra frame exists on the original absent-PC path.
    assert ((resume_words[0]>>5)&0x3FFF)*4==248 and ((resume_words[0]>>19)&31)==0
    assert conditional_target(stage_pc_resume+204,resume_words[51])==stage_pc_resume+224
    assert resume_words[56:58]==resume_words[59:61]==(0xA94153F3,0xA8C37BFD)
    assert resume_words[63:66]==(0x54FFFF81,0xA94153F3,0xA8C37BFD)
    assert conditional_target(stage_pc_resume+63*4,resume_words[63])==stage_pc_resume+236
    assert resume_words[67]==0xD503201F
    assert pc_effect_words[:11]==(0x340005B4,0x3940C109,0x7100053F,0x54000541,0xA9BC7BFD,0xA90153F3,
        0xF9001BE8,0x36000274,0xAA0803E0,0x910083E8,0xA9027FFF)
    assert conditional_target(stage_pc_effects,pc_effect_words[0])==stage_pc_effects+180 # Control1 has no remaining effects.
    assert conditional_target(stage_pc_effects+12,pc_effect_words[3])==stage_pc_effects+180 # Only actual kind1.
    assert conditional_target(stage_pc_effects+28,pc_effect_words[7])==stage_pc_effects+104 and ((pc_effect_words[7]>>19)&31)==0
    assert pc_effect_words[12:25]==(0xF94017F3,0xB40001B3,0x9100226A,0xC85FFD49,0xD100052B,0xC80CFD4B,
        0x35FFFFAC,0xB50000E9,0xF9400268,0xAA1303E0,0xF9400908,0xD63F0100,0xAA1303E0)
    assert conditional_target(stage_pc_effects+52,pc_effect_words[13])==stage_pc_effects+104
    assert conditional_target(stage_pc_effects+72,pc_effect_words[18])==stage_pc_effects+60
    assert conditional_target(stage_pc_effects+76,pc_effect_words[19])==stage_pc_effects+104
    assert conditional_target(stage_pc_effects+104,pc_effect_words[26])==stage_pc_effects+172 and ((pc_effect_words[26]>>19)&31)==1
    assert pc_effect_words[27:31]==(0xF9401BF3,0xF9400660,0x52801381,0x2A1F03E2)
    assert pc_effect_words[32:34]==(0x34000160,0xB9003BE0) and pc_effect_words[35]==0x9100E3E1
    assert pc_effect_words[38:42]==(0xF90013FA,0xB9402A69,0xB9002BE9,0x910083E1)
    assert conditional_target(stage_pc_effects+128,pc_effect_words[32])==stage_pc_effects+172 # No authored costume means neither helper runs.
    assert pc_effect_words[43:]==(0xA94153F3,0xA8C47BFD,0xD65F03C0,0xD503201F,0xD503201F)
    assert stage_character_words[1:3]==(0x910183E8,0x9101C3E1) and stage_character_words[4]==0xF94033E0
    assert conditional_target(0x246C97C,stage_character_words[5])==0x246C994
    assert conditional_target(0x246C984,stage_character_words[7])==0x246C994 and ((stage_character_words[7]>>19)&31)==0
    assert stage_character_words[8:10]==(0xF94033E0,0x52800041) # Original lazy character state setter receives state2.
    for low,high in [(0x246C800,0x246C880),(0x246C884,0x246CC40),(0x22EB268,0x22EC21C),
        (0x13E4300,0x13E43D0),(0x13E43D0,0x13E44D8),(0x22DED68,0x22DF69C),(0x22DFE60,0x22DFFA4)]:
        assert patched[low:high]==original[low:high] # Original predicate/getter, character/communication, actual duplicate bonds and shared cleanup stay.
    for address,word,target,opcode in [(prefix+8,words[2],0x20BBCA4,0x94000000),
        (prefix+20,words[5],0x2069E14,0x14000000),
        (0x209C038,struct.unpack_from('<I',patched,0x209C038)[0],prefix,0x94000000),
        (copy_marker+8,copy_words[2],0x286ED04,0x94000000),
        (0x2371F70,struct.unpack_from('<I',patched,0x2371F70)[0],copy_marker,0x94000000),
        (gve_replay+36,gve_replay_words[9],0x13B1F5C,0x94000000),
        (gve_replay+44,gve_replay_words[11],0x13B28D0,0x94000000),
        (0x246FB70,struct.unpack_from('<I',patched,0x246FB70)[0],gve_replay,0x94000000),
        (gve_gate+12,gve_gate_words[3],0x1451530,0x14000000),
        (0x145152C,struct.unpack_from('<I',patched,0x145152C)[0],gve_gate,0x14000000),
        (event_box_counter+20,counter_words[5],0x13B1F5C,0x94000000),
        (event_box_counter+28,counter_words[7],0x13B28D0,0x94000000),
        (event_box_counter+52,counter_words[13],0x2414578,0x14000000),
        (event_box_bonus+24,bonus_words[6],0x13B1F5C,0x94000000),
        (event_box_bonus+32,bonus_words[8],0x13B28D0,0x94000000),
        (event_box_item+20,item_words[5],0x13B1F5C,0x94000000),
        (event_box_item+28,item_words[7],0x13B28D0,0x94000000),
        (event_box_common+28,common_words[7],0x24D8874,0x14000000),
        (event_box_common+40,common_words[10],0x24D8874,0x14000000),
        (event_box_item_gate+8,item_gate_words[2],0x24D89EC,0x14000000),
        (event_box_item_gate+16,item_gate_words[4],0x24D891C,0x14000000),
        (0x240CD18,struct.unpack_from('<I',patched,0x240CD18)[0],scratch_gain,0x94000000),
        (0x240CFCC,struct.unpack_from('<I',patched,0x240CFCC)[0],event_box_counter,0x94000000),
        (0x240D0DC,struct.unpack_from('<I',patched,0x240D0DC)[0],event_box_bonus,0x94000000),
        (0x240D260,struct.unpack_from('<I',patched,0x240D260)[0],event_box_item,0x94000000),
        (0x24D8870,struct.unpack_from('<I',patched,0x24D8870)[0],event_box_common,0x14000000),
        (0x24D8918,struct.unpack_from('<I',patched,0x24D8918)[0],event_box_item_gate,0x14000000),
        (0x24BE31C,struct.unpack_from('<I',patched,0x24BE31C)[0],scratch_gain,0x94000000),
        (0x243AEAC,struct.unpack_from('<I',patched,0x243AEAC)[0],scratch_gain,0x94000000),
        (0x25722C4,struct.unpack_from('<I',patched,0x25722C4)[0],scratch_gain,0x94000000),
        (familia_callback+16,familia_words[4],0x2570F30,0x14000000),
        (familia_callback+60,familia_words[15],0x13B1F5C,0x94000000),
        (familia_callback+68,familia_words[17],0x13B28D0,0x94000000),
        (familia_callback+132,familia_words[33],0x2570F30,0x14000000),
        (0x257231C,struct.unpack_from('<I',patched,0x257231C)[0],familia_callback,0x94000000),
        (familia_count+60,count_words[15],0x13B1F5C,0x94000000),
        (familia_count+68,count_words[17],0x13B28D0,0x94000000),
        (familia_count+96,count_words[24],0x2871E48,0x14000000),
        (0x2570F7C,struct.unpack_from('<I',patched,0x2570F7C)[0],familia_count,0x94000000),
        (familia_date+60,date_words[15],0x13B1F5C,0x94000000),
        (familia_date+68,date_words[17],0x13B28D0,0x94000000),
        (familia_date+96,date_words[24],0x2871F50,0x14000000),
        (0x2570F88,struct.unpack_from('<I',patched,0x2570F88)[0],familia_date,0x94000000),
        (casino_gain+4,casino_words[1],0x23FF788,0x14000000),
        (0x236271C,struct.unpack_from('<I',patched,0x236271C)[0],casino_gain,0x94000000),
        (0x248D5EC,struct.unpack_from('<I',patched,0x248D5EC)[0],casino_gain,0x94000000),
        (stage_xp+16,xp_words[4],0x13B1F5C,0x94000000),
        (stage_xp+24,xp_words[6],0x13B28D0,0x94000000),
        (stage_xp+44,xp_words[11],0x246C428,0x14000000),
        (0x246C6D0,struct.unpack_from('<I',patched,0x246C6D0)[0],stage_xp,0x94000000),
        (expedition_xp+20,expedition_xp_words[5],0x13B1F5C,0x94000000),
        (expedition_xp+28,expedition_xp_words[7],0x13B28D0,0x94000000),
        (expedition_xp+56,expedition_xp_words[14],0x13B1F5C,0x94000000),
        (expedition_xp+64,expedition_xp_words[16],0x13B28D0,0x94000000),
        (expedition_xp+80,expedition_xp_words[20],0x13B1F5C,0x94000000),
        (expedition_xp+88,expedition_xp_words[22],0x13B28D0,0x94000000),
        (expedition_xp+112,expedition_xp_words[28],0x2308EE4,0x14000000),
        (expedition_party_gate+16,party_words[4],0x23147DC,0x14000000),
        (expedition_stage_gate+12,stage_words[3],0x2309294,0x14000000),
        (expedition_stage_gate+16,stage_words[4],0x23021B0,0x14000000),
        (0x2308EE0,struct.unpack_from('<I',patched,0x2308EE0)[0],expedition_xp,0x14000000),
        (0x2309274,struct.unpack_from('<I',patched,0x2309274)[0],expedition_party_gate,0x94000000),
        (0x2309284,struct.unpack_from('<I',patched,0x2309284)[0],expedition_stage_gate,0x94000000),
        (stage_cp+4,cp_words[1],0x23E6CBC,0x14000000),
        (stage_cp+28,cp_words[7],dispatch_cp,0x14000000),
        (stage_cp+44,cp_words[11],0x13B1F5C,0x94000000),
        (stage_cp+52,cp_words[13],0x13B28D0,0x94000000),
        (stage_cp+68,cp_words[17],0x23E7240,0x14000000),
        (stage_cp+72,cp_words[18],0x23E6CBC,0x14000000),
        (dispatch_cp+16,dispatch_cp_words[4],friendship_cp,0x14000000),
        (dispatch_cp+32,dispatch_cp_words[8],0x13B1F5C,0x94000000),
        (dispatch_cp+40,dispatch_cp_words[10],0x13B28D0,0x94000000),
        (dispatch_cp+56,dispatch_cp_words[14],0x23E7240,0x14000000),
        (dispatch_cp+60,dispatch_cp_words[15],0x23E6CBC,0x14000000),
        (friendship_cp+16,friendship_cp_words[4],0x23E7240,0x14000000),
        (friendship_cp+32,friendship_cp_words[8],0x13B1F5C,0x94000000),
        (friendship_cp+40,friendship_cp_words[10],0x13B28D0,0x94000000),
        (friendship_cp+56,friendship_cp_words[14],0x23E7240,0x14000000),
        (friendship_cp+60,friendship_cp_words[15],0x23E6CBC,0x14000000),
        (friendship_item+4,friendship_item_words[1],0x23EB56C,0x14000000),
        (friendship_item+16,friendship_item_words[4],0x13B1F5C,0x94000000),
        (friendship_item+24,friendship_item_words[6],0x13B28D0,0x94000000),
        (friendship_item+36,friendship_item_words[9],0x23EB56C,0x14000000),
        (friendship_item+40,friendship_item_words[10],0x23EB2CC,0x14000000),
        (0x23EB2C8,struct.unpack_from('<I',patched,0x23EB2C8)[0],friendship_item,0x14000000),
        (0x23E6CB8,struct.unpack_from('<I',patched,0x23E6CB8)[0],stage_cp,0x14000000),
        (stage_json+8,json_words[2],0x246C590,0x14000000),
        (0x246C58C,struct.unpack_from('<I',patched,0x246C58C)[0],stage_json,0x14000000),
        (stage_counts+20,counts_words[5],pvb_counts,0x14000000),
        (stage_counts+52,counts_words[13],0x13B1F5C,0x94000000),
        (stage_counts+60,counts_words[15],0x13B28D0,0x94000000),
        (stage_counts+80,counts_words[20],0x24528E0,0x94000000),
        (pvb_counts+20,pvb_count_words[5],gve_counts,0x14000000),
        (pvb_counts+52,pvb_count_words[13],0x13B1F5C,0x94000000),
        (pvb_counts+60,pvb_count_words[15],0x13B28D0,0x94000000),
        (pvb_counts+72,pvb_count_words[18],stage_counts+72,0x14000000),
        (gve_counts+20,gve_count_words[5],0x24528E0,0x14000000),
        (gve_counts+52,gve_count_words[13],0x13B1F5C,0x94000000),
        (gve_counts+60,gve_count_words[15],0x13B28D0,0x94000000),
        (gve_counts+72,gve_count_words[18],stage_counts+72,0x14000000),
        (0x245197C,struct.unpack_from('<I',patched,0x245197C)[0],stage_counts,0x94000000),
        (stage_cumulative+20,cumulative_words[5],0x2666B1C,0x14000000),
        (stage_cumulative+52,cumulative_words[13],0x13B1F5C,0x94000000),
        (stage_cumulative+60,cumulative_words[15],0x13B28D0,0x94000000),
        (stage_cumulative+80,cumulative_words[20],0x2666B1C,0x94000000),
        (pvb_cumulative+36,pvb_cumulative_words[9],gve_cumulative,0x14000000),
        (pvb_cumulative+68,pvb_cumulative_words[17],0x13B1F5C,0x94000000),
        (pvb_cumulative+76,pvb_cumulative_words[19],0x13B28D0,0x94000000),
        (pvb_cumulative+88,pvb_cumulative_words[22],stage_cumulative+72,0x14000000),
        (gve_cumulative+20,gve_cumulative_words[5],0x2666B1C,0x14000000),
        (gve_cumulative+52,gve_cumulative_words[13],0x13B1F5C,0x94000000),
        (gve_cumulative+60,gve_cumulative_words[15],0x13B28D0,0x94000000),
        (gve_cumulative+72,gve_cumulative_words[18],stage_cumulative+72,0x14000000),
        (0x245293C,struct.unpack_from('<I',patched,0x245293C)[0],stage_cumulative,0x94000000),
        (stage_last_date+20,last_date_words[5],pvb_last_date,0x14000000),
        (stage_last_date+52,last_date_words[13],0x13B1F5C,0x94000000),
        (stage_last_date+60,last_date_words[15],0x13B28D0,0x94000000),
        (stage_last_date+80,last_date_words[20],0x26667CC,0x94000000),
        (pvb_last_date+20,pvb_date_words[5],gve_last_date,0x14000000),
        (pvb_last_date+52,pvb_date_words[13],0x13B1F5C,0x94000000),
        (pvb_last_date+60,pvb_date_words[15],0x13B28D0,0x94000000),
        (pvb_last_date+72,pvb_date_words[18],stage_last_date+72,0x14000000),
        (gve_last_date+20,gve_date_words[5],0x26667CC,0x14000000),
        (gve_last_date+52,gve_date_words[13],0x13B1F5C,0x94000000),
        (gve_last_date+60,gve_date_words[15],0x13B28D0,0x94000000),
        (gve_last_date+72,gve_date_words[18],stage_last_date+72,0x14000000),
        (0x2451998,struct.unpack_from('<I',patched,0x2451998)[0],stage_last_date,0x94000000),
        (pvb_score_event+20,pvb_score_event_words[5],0x13B1F5C,0x94000000),
        (pvb_score_event+28,pvb_score_event_words[7],0x13B28D0,0x94000000),
        (pvb_score_event+48,pvb_score_event_words[12],0x246F4C8,0x14000000),
        (0x246F008,struct.unpack_from('<I',patched,0x246F008)[0],pvb_score_event,0x94000000),
        (union_init+12,init_words[3],0x20BCB78,0x14000000),
        (union_info+24,struct.unpack_from('<I',patched,union_info+24)[0],union_marker,0x14000000),
        (union_boss+24,struct.unpack_from('<I',patched,union_boss+24)[0],union_marker,0x14000000),
        (union_normal+24,struct.unpack_from('<I',patched,union_normal+24)[0],union_marker,0x14000000),
        (union_marker+64,marker_words[16],0x139BA20,0x94000000),
        (union_marker+76,marker_words[19],0x28B7C0C,0x94000000),
        (union_flush+8,flush_words[2],0x20C839C,0x94000000),
        (union_flush+52,flush_words[13],0x20BAD74,0x94000000),
        (union_flush+68,flush_words[17],0x139BA20,0x94000000),
        (union_flush+104,flush_words[26],0x20C0D88,0x94000000),
        (union_flush+112,flush_words[28],0x13A39C4,0x94000000),
        (0x20BCB74,struct.unpack_from('<I',patched,0x20BCB74)[0],union_init,0x14000000),
        (0x25FAC24,struct.unpack_from('<I',patched,0x25FAC24)[0],union_info,0x14000000),
        (0x2811518,struct.unpack_from('<I',patched,0x2811518)[0],union_boss,0x14000000),
        (0x2811920,struct.unpack_from('<I',patched,0x2811920)[0],union_normal,0x14000000),
        (0x20BD150,struct.unpack_from('<I',patched,0x20BD150)[0],union_flush,0x94000000),
        (lottery_board+32,board_words[8],0x13B1F5C,0x94000000),
        (lottery_board+92,board_words[23],0x22DED68,0x94000000),
        (lottery_board+148,board_words[37],0xD68330,0x94000000),
        (lottery_board+168,board_words[42],0x22F02F0,0x14000000),
        (lottery_board+172,board_words[43],0x22F0250,0x14000000),
        (lottery_constructor+32,constructor_words[8],0x13B1F5C,0x94000000),
        (lottery_constructor+96,constructor_words[24],0x139C3AC,0x94000000),
        (lottery_constructor+108,constructor_words[27],0x2504C48,0x94000000),
        (lottery_constructor+116,constructor_words[29],0x2505FC4,0x94000000),
        (lottery_constructor+120,constructor_words[30],0x2469080,0x94000000),
        (lottery_constructor+144,constructor_words[36],0x2473D9C,0x94000000),
        (lottery_constructor+164,constructor_words[41],lottery_board,0x14000000),
        (0x22F024C,struct.unpack_from('<I',patched,0x22F024C)[0],lottery_constructor,0x14000000),
        (0x206A360,struct.unpack_from('<I',patched,0x206A360)[0],replay_receipt,0x94000000),
        (replay_receipt+100,receipt_words[25],replay_receipt+120,0x14000000),
        (replay_receipt+108,receipt_words[27],replay_receipt+80,0x14000000),
        (replay_receipt+116,receipt_words[29],replay_receipt+80,0x14000000),
        (replay_receipt+172,receipt_words[43],replay_string,0x94000000),
        (replay_receipt+188,receipt_words[47],replay_string,0x94000000),
        (replay_receipt+200,receipt_words[50],replay_receipt+208,0x14000000),
        (0x246C880,struct.unpack_from('<I',patched,0x246C880)[0],stage_pc_resume,0x14000000),
        (stage_pc_resume+20,resume_words[5],0x13B1F5C,0x94000000),
        (stage_pc_resume+180,resume_words[45],0x22EB268,0x94000000),
        (stage_pc_resume+196,resume_words[49],0x22EBA54,0x94000000),
        (stage_pc_resume+208,resume_words[52],stage_pc_effects,0x94000000),
        (stage_pc_resume+220,resume_words[55],0x246C8D0,0x14000000),
        (stage_pc_resume+232,resume_words[58],0x246C8B8,0x14000000),
        (stage_pc_resume+244,resume_words[61],0x246C884,0x14000000),
        (stage_pc_resume+248,resume_words[62],0x246C8B8,0x14000000),
        (stage_pc_resume+264,resume_words[66],0x246CC2C,0x14000000),
        (stage_pc_effects+44,pc_effect_words[11],0x22DED68,0x94000000),
        (stage_pc_effects+100,pc_effect_words[25],0xD68330,0x94000000),
        (stage_pc_effects+124,pc_effect_words[31],0x139C3AC,0x94000000),
        (stage_pc_effects+136,pc_effect_words[34],0x2504C48,0x94000000),
        (stage_pc_effects+144,pc_effect_words[36],0x2505FC4,0x94000000),
        (stage_pc_effects+148,pc_effect_words[37],0x2469080,0x94000000),
        (stage_pc_effects+168,pc_effect_words[42],0x2473D9C,0x94000000),
        (0x246C968,stage_character_words[0],0x23EA150,0x94000000),
        (0x246C974,stage_character_words[3],0x23EA744,0x94000000),
        (0x246C980,stage_character_words[6],0x23E79F8,0x94000000),
        (0x246C990,stage_character_words[10],0x23E6888,0x94000000)]:
        immediate = word & 0x03FFFFFF
        if immediate & 0x02000000: immediate -= 0x04000000
        assert word & 0xFC000000 == opcode and address + 4 * immediate == target
    spans = [(prefix,24),(0x209C038,4),(0x2036AC4,40),(0x24ABD70,4),(0x25D0300,4),(copy_marker,32),(0x2371F70,4),
        (gve_replay,136),(gve_gate,16),(0x246FB70,4),(0x145152C,4),
        (scratch_gain,12),(event_box_counter,88),(event_box_bonus,100),(event_box_item,132),(event_box_common,44),(event_box_item_gate,20),
        (0x240CD18,4),(0x240CFCC,4),(0x240D0DC,4),(0x240D260,4),(0x24D8870,4),(0x24D88FC,4),(0x24D890C,4),(0x24D8918,4),
        (0x24BE31C,4),(0x243AEAC,4),(familia_callback,208),(familia_count,144),(familia_date,144),
        (0x25722C4,4),(0x257231C,4),(0x2570F7C,4),(0x2570F88,4),
        (casino_gain,12),(0x236271C,4),(0x248D5EC,4),(stage_xp,80),(0x246C6D0,4),(expedition_xp,256),(0x2308EE0,4),(stage_cp,112),(dispatch_cp,96),(friendship_cp,96),(friendship_item,96),(0x23EB2C8,4),(0x23E6CB8,4),
        (stage_counts,128),(stage_json,16),(0x246C58C,4),(0x245197C,4),(stage_cumulative,128),(0x245293C,4),(stage_last_date,128),(0x2451998,4),
        (pvb_counts,128),(pvb_last_date,128),(gve_counts,128),(gve_last_date,128),(gve_cumulative,128),(pvb_cumulative,144),(pvb_score_event,88),(0x246F008,4),
        (union_init,16),(union_info,32),(union_boss,32),(union_normal,32),(union_marker,208),(union_flush,144),
        (lottery_board,224),(lottery_constructor,224),(0x22F024C,4),
        (replay_receipt,240),(replay_string,112),(0x206A360,4),
        (stage_pc_resume,304),(stage_pc_effects,192),(0x246C880,4),
        (0x20BCB74,4),(0x25FAC24,4),(0x2811518,4),(0x2811920,4),(0x20BD150,4)]
    cursor = 0
    for start, size in sorted(spans):
        assert patched[cursor:start] == original[cursor:start]
        cursor = start + size
    assert patched[cursor:] == original[cursor:]
    assert patch_native_client(original, "armeabi-v7a") == original
    for offset in [prefix,0x209C038,0x25D0300,copy_marker,0x2371F70,gve_replay,gve_gate,0x246FB70,0x145152C,scratch_gain,
        event_box_counter,event_box_bonus,event_box_item,event_box_common,event_box_item_gate,0x240CD18,0x240CFCC,0x240D0DC,0x240D260,
        0x24D8870,0x24D88FC,0x24D890C,0x24D8918,0x24BE31C,0x243AEAC,
        familia_callback,familia_count,familia_date,0x25722C4,0x257231C,0x2570F7C,0x2570F88,
        casino_gain,0x236271C,0x248D5EC,stage_xp,0x246C6D0,expedition_xp,0x2308EE0,stage_cp,dispatch_cp,friendship_cp,0x23E6CB8,
        stage_counts,stage_json,0x246C58C,0x245197C,stage_cumulative,0x245293C,stage_last_date,0x2451998,
        pvb_counts,pvb_last_date,gve_counts,gve_last_date,gve_cumulative,pvb_cumulative,pvb_score_event,0x246F008,
        union_init,union_info,union_boss,union_normal,union_marker,union_flush,0x20BCB74,0x25FAC24,0x2811518,0x2811920,0x20BD150,
        lottery_board,lottery_constructor,0x22F024C,replay_receipt,replay_string,0x206A360,stage_pc_resume,stage_pc_effects,0x246C880]:
        wrong = bytearray(original)
        wrong[offset] ^= 1
        try:
            patch_native_client(bytes(wrong), "arm64-v8a")
        except ValueError as error:
            assert f'{offset:#x}' in str(error)
        else:
            raise AssertionError("A mismatched native instruction must not be patched")
    print("Native patch spans, targets, arguments and mismatch guards OK; Union ticket/PvB recovery and all gameplay remain unverified")


if __name__ == "__main__":
    main()
