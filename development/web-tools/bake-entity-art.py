"""Bake articulated Kenney CC0 assemblies with Blender 4.5+ (no game engine).

Example:
  blender --background --python-exit-code 1 --python development/web-tools/bake-entity-art.py -- \
    --output <outside-repository-directory> --ids anchor_bulwark,remote_hunter

The first invocation may use --source-cache <downloaded Kenney pack directory>
to copy only referenced neutral GLBs into development/assets/model_sources.
No mesh primitives are generated: every visible mechanical part comes from a
licensed GLB listed in the recipes below. Baked PNGs are the runtime assets;
the Blender application and intermediary scenes are never part of the game.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / 'development/assets/model_sources/kenney'
CELL, DIRECTIONS, POSES = 80, 8, 10
ELEVATION = math.radians(55)
TOWER_VARIANTS = ['T1', 'T2A', 'T2B', 'T3A', 'T3B']
BOSS_VARIANTS = ['phase1', 'phase2', 'phase3']
RECIPES = {}


def part(source, size, position=(0, 0, 0), motion='fixed', rotation=(0, 0, 0), finish='native'):
    return dict(source=source, size=size, position=position, motion=motion, rotation=rotation, finish=finish)


def td(name, size, position=(0, 0, 0), motion='fixed', rotation=(0, 0, 0), finish='native'):
    return part('tower-defense-kit/' + name, size, position, motion, rotation, finish)


def sp(name, size, position=(0, 0, 0), motion='fixed', rotation=(0, 0, 0), finish='native'):
    return part('space-kit/' + name, size, position, motion, rotation, finish)


def pair(source, size, spread, y=0, z=0, motion='arm', rotation=(0, 0, 0), finish='native'):
    return [sp(source, size, (sign * spread, y, z), motion + ('L' if sign < 0 else 'R'),
               (rotation[0], rotation[1] * sign, rotation[2] * sign), finish) for sign in [-1, 1]]


def tower(id, role, parts, branch_a, branch_b):
    RECIPES[id] = dict(kind='towers', role=role, parts=parts, branch_a=branch_a, branch_b=branch_b,
                       variants=TOWER_VARIANTS, locomotion='anchored')


def enemy(id, parts, locomotion='crawler', boss=False, elite=False, phase_parts=None):
    RECIPES[id] = dict(kind='enemies', role='boss' if boss else 'elite' if elite else 'normal',
                       parts=parts, variants=BOSS_VARIANTS if boss else ['base'],
                       locomotion=locomotion, phase_parts=phase_parts or [])


base_round = lambda: td('tower-round-bottom-c', (1.8, 1.6, .42))
base_square = lambda: td('tower-square-bottom-b', (1.75, 1.55, .38))
shield_pair = lambda: pair('corridor_wall', (.2, .95, 1.15), .73, -.20, .35, 'shield', finish='armor')
reactor = lambda z=.55: sp('machine_generator', (.68, .65, .66), (0, .15, z), 'core')

tower('anchor_bulwark', 'melee', [base_square(), td('tower-round-top-a', (1.2, 1, .5), (0, .13, .4)),
    *shield_pair(), sp('rocket_baseA', (.57, .5, .62), (0, -.22, .83), 'head', finish='accent')],
    [sp('weapon_gun', (.5, .98, .44), (0, -.75, .7), 'hammer'), *pair('rocket_finsB', (.25, .68, .55), .85, -.58, .45, 'shield')],
    [*pair('corridor_wallCorner', (.5, .8, .85), .9, .25, .42, 'shield', finish='armor'), sp('machine_generator', (.65,.5,.4),(0,.38,1.03),'core')])
tower('phase_blade', 'melee', [base_round(), sp('alien', (.8, .7, 1.35), (0,0,.37), 'body'),
    *pair('rocket_finsB', (.26, .58, 1.15), .63, -.38, .6, 'blade', (12, 28, 0), 'blade')],
    [*pair('rocket_fuelB', (.34,.42,.62), .52,.25,.86,'core'), sp('rocket_topB',(.42,.4,.53),(0,0,1.62),'head',finish='accent')],
    [*pair('weapon_rifle',(.24,1.05,.26),.66,-.43,.96,'blade',(0,0,8),'blade'), sp('rocket_finsA',(.72,.42,.58),(0,.22,1.14),'fin',finish='metal')])
tower('boundary_riveter', 'melee', [base_square(), sp('machine_generatorLarge',(1.05,.83,.7),(0,.14,.34),'body'),
    sp('weapon_gun',(.78,.88,.58),(0,-.58,.64),'hammer'), *pair('supports_high',(.22,.65,.88),.75,0,.38,'brace',finish='metal')],
    [sp('rocket_fuelB',(.65,.55,.72),(0,.13,1.0),'core'), *pair('weapon_gun',(.33,.92,.3),.52,-.5,.75,'barrel')],
    [*pair('corridor_wall',(.24,.86,.94),.90,.13,.38,'shield',finish='armor'), sp('pipe_ring',(.96,.84,.25),(0,0,1.02),'ring',finish='metal')])
tower('resonance_guard', 'melee', [base_round(), reactor(), sp('satelliteDish',(.98,.56,.91),(0,-.40,.76),'shield'),
    *pair('rocket_sidesA',(.27,.64,.77),.66,.13,.42,'shield',finish='armor')],
    [*pair('satelliteDish',(.62,.43,.64),.74,-.36,.93,'shield'), sp('rocket_topA',(.4,.4,.38),(0,.15,1.39),'core',finish='gold')],
    [sp('pipe_ring', (1.52,1.25,.28),(0,0,.57),'ring',finish='metal'), *pair('corridor_wallCorner',(.36,.58,.78),.9,.0,.45,'shield',finish='armor')])
tower('pulse_array', 'ranged', [base_round(), td('tower-round-middle-a',(1.02,.92,.46),(0,0,.4)),
    sp('turret_double',(1.36,1.43,.61),(0,-.12,.81),'barrel')],
    [sp('turret_double',(.9,1.46,.42),(0,-.08,1.37),'barrel'), *pair('rocket_fuelA',(.26,.5,.48),.77,.24,.60,'core')],
    [*pair('weapon_rifle',(.28,1.88,.26),.43,-.10,.96,'barrel'), sp('satelliteDish',(.4,.4,.56),(0,.4,1.28),'sensor')])
tower('focus_rail', 'ranged', [base_square(), sp('turret_single',(.98,1.53,.58),(0,-.24,.52),'barrel'),
    *pair('weapon_rifle',(.22,1.96,.23),.32,-.21,.94,'barrel'), sp('machine_wireless',(.4,.43,.52),(0,.32,.81),'sensor')],
    [*pair('rocket_fuelA',(.22,.85,.4),.61,.11,.59,'core'), sp('weapon_rifle',(.25,2.0,.28),(0,-.22,1.30),'barrel')],
    [sp('satelliteDish_detailed',(.80,.68,.67),(0,.49,1.11),'sensor'), *pair('corridor_wall',(.14,.64,.54),.59,.06,.46,'shield',finish='armor')])
tower('arc_mortar', 'ranged', [base_round(), td('weapon-cannon',(1.4,1.65,.89),(0,-.12,.45),'mortar',(0,0,0)),
    *pair('rocket_fuelA',(.36,.54,.58),.83,.21,.43,'loader',finish='gold')],
    [*pair('weapon_gun',(.36,.85,.4),.73,-.32,.75,'barrel'), sp('rocket_fuelB',(.46,.62,.5),(0,.53,.92),'core',finish='gold')],
    [sp('weapon_rifle',(.34,1.41,.29),(0,-.2,1.23),'barrel'), sp('satelliteDish',(.61,.46,.55),(0,.60,1.16),'sensor')])
tower('drone_loom', 'ranged', [base_square(), sp('hangar_roundA',(1.44,1.20,.74),(0,.13,.35),'body'),
    *pair('craft_speederA',(.55,.78,.29),.80,-.13,1.16,'drone'), sp('machine_wireless',(.45,.43,.65),(0,.33,1.0),'sensor')],
    [*pair('craft_speederB',(.52,.64,.28),.59,-.40,1.75,'drone'), sp('rocket_fuelA',(.47,.5,.39),(0,.0,.94),'core')],
    [*pair('weapon_gun',(.3,.78,.25),.83,-.24,1.25,'barrel'), sp('satelliteDish_detailed',(.68,.49,.49),(0,.38,1.41),'sensor')])
tower('bandwidth_relay', 'support', [base_square(), sp('machine_wireless',(1.01,.88,1.27),(0,0,.36),'core'),
    sp('satelliteDish_detailed',(1.38,.68,.73),(0,-.1,1.39),'sensor'), *pair('rocket_fuelA',(.23,.43,.66),.67,.16,.48,'core')],
    [*pair('satelliteDish',(.6,.40,.67),.83,-.1,1.17,'sensor'), sp('pipe_ring',(.87,.69,.17),(0,0,.96),'ring',finish='gold')],
    [*pair('rocket_finsA',(.30,.58,1.14),.72,.22,.72,'fin',finish='metal'), sp('machine_generator',(.65,.62,.5),(0,.15,1.94),'core')])
tower('memory_mechanic', 'support', [base_round(), sp('machine_generator',(1.07,.98,.9),(0,.16,.4),'body'),
    *pair('supports_high',(.23,.43,.78),.67,-.10,.51,'arm'), *pair('weapon_gun',(.35,.89,.28),.70,-.40,1.08,'tool',(-18,0,0),'gold'),
    sp('desk_computerScreen',(.48,.32,.35),(0,-.37,1.15),'screen',finish='accent')],
    [*pair('weapon_rifle',(.24,1.23,.24),.76,-.36,1.4,'tool',finish='gold'), sp('rocket_fuelB',(.55,.50,.52),(0,.27,1.20),'core')],
    [*pair('machine_barrel',(.40,.40,.71),.69,.36,.48,'reservoir',finish='ivory'), sp('satelliteDish',(.63,.39,.54),(0,.28,1.36),'sensor')])
tower('frequency_choir', 'support', [base_round(), sp('machine_generatorLarge',(.9,.85,.84),(0,.12,.39),'body'),
    *pair('satelliteDish_large',(.55,.56,1.03),.67,-.12,.68,'speaker'), sp('rocket_topB',(.5,.47,.6),(0,.06,1.16),'core',finish='gold')],
    [*pair('satelliteDish',(.60,.46,.55),.77,.19,1.46,'speaker'), sp('pipe_ring',(.86,.83,.17),(0,0,1.11),'ring',finish='gold')],
    [*pair('machine_wireless',(.33,.43,.91),.78,.31,.77,'sensor'), sp('satelliteDish_detailed',(.69,.51,.50),(0,.09,1.81),'speaker')])
tower('resistance_beacon', 'support', [base_square(), sp('rocket_baseB',(.90,.85,1.2),(0,0,.37),'body'),
    sp('rocket_topA',(.69,.68,.58),(0,0,1.54),'core',finish='gold'), *pair('rocket_finsB',(.35,.67,.91),.61,.06,.78,'fin',finish='ivory')],
    [*pair('satelliteDish',(.48,.39,.60),.66,-.1,1.49,'sensor'), sp('machine_generator',(.55,.45,.39),(0,.22,1.29),'core')],
    [*pair('corridor_wall',(.21,.63,1.0),.77,.0,.68,'shield',finish='armor'), sp('pipe_ring',(.93,.82,.24),(0,0,1.86),'ring',finish='gold')])

rover = lambda size=(1.55,1.45,.61): sp('rover',size,(0,0,.06),'body')
alien = lambda: sp('alien',(.83,.62,1.32),(0,0,.32),'body')
legs = lambda: pair('supports_high',(.28,.39,.48),.37,0,.04,'leg',finish='metal')
eye = lambda z=1.: sp('rocket_topB',(.37,.41,.33),(0,-.29,z),'head',finish='glow')

enemy('static_drifter',[alien(),*legs(),eye(1.22)],'walker')
enemy('spike_runner',[sp('craft_racer',(1.1,1.52,.52),(0,0,.4),'body'),*legs(),*pair('rocket_finsB',(.24,.53,.62),.57,.18,.49,'fin',finish='blade')],'runner')
enemy('shield_echo',[alien(),*legs(),sp('corridor_wallCorner',(1.15,.26,.87),(0,-.44,.46),'shield',finish='armor')],'walker')
enemy('tempo_amplifier',[rover((1.25,1.2,.47)),*pair('satelliteDish',(.57,.42,.82),.48,-.03,.53,'speaker'),sp('machine_generator',(.49,.48,.47),(0,.14,.57),'core')])
enemy('fracture_seed',[td('enemy-ufo-d',(1.36,1.12,.65),(0,0,.32),'body'),*pair('rocket_fuelB',(.47,.51,.66),.56,.0,.27,'pod'),sp('rocket_topA',(.56,.49,.41),(0,-.23,.81),'core',finish='gold')])
enemy('floating_noise',[td('enemy-ufo-b',(1.63,1.49,.57),(0,0,.5),'body'),*pair('rocket_finsA',(.30,.64,.56),.68,.18,.59,'fin'),sp('rocket_fuelA',(.40,.43,.42),(0,0,.24),'engine',finish='glow')],'hover')
enemy('remote_hunter',[rover(),sp('turret_single',(.89,1.61,.48),(0,-.20,.59),'barrel'),sp('weapon_rifle',(.24,1.90,.24),(.31,-.19,.97),'barrel'),sp('machine_wireless',(.30,.30,.66),(-.4,.25,.69),'sensor')])
enemy('siege_ram',[sp('craft_miner',(1.53,1.53,.70),(0,0,.27),'body'),sp('rocket_baseB',(1.23,.71,.57),(0,-.85,.28),'hammer',finish='armor'),*pair('rocket_fuelA',(.36,.75,.54),.79,.19,.31,'loader')])
enemy('memory_medic',[alien(),*legs(),sp('machine_barrel',(.57,.56,.92),(0,.39,.67),'reservoir',finish='ivory'),*pair('weapon_gun',(.23,.72,.27),.48,-.29,.99,'tool',finish='gold')],'walker')
enemy('bandwidth_jammer',[rover((1.38,1.25,.54)),sp('machine_wireless',(.74,.66,.79),(0,0,.54),'body'),*pair('satelliteDish',(.64,.42,.77),.55,-.09,1.04,'sensor'),sp('rocket_fuelA',(.30,.42,.47),(0,.25,1.34),'core',finish='gold')])
enemy('phase_teleporter',[alien(),*legs(),sp('pipe_ringHigh',(1.33,.56,1.18),(0,.13,.71),'ring',finish='metal'),*pair('rocket_fuelA',(.26,.34,.6),.47,.08,.90,'core')],'walker')
enemy('replication_node',[rover((1.33,1.29,.5)),*pair('machine_generator',(.49,.56,.69),.42,.0,.54,'pod'),sp('pipe_ring',(.8,.85,.24),(0,.05,1.10),'ring',finish='metal')])
enemy('pressure_cantor',[alien(),*legs(),sp('satelliteDish_large',(1.12,.64,.73),(0,-.1,1.20),'speaker'),sp('rocket_fuelB',(.56,.45,.7),(0,.37,.49),'core',finish='gold')],'walker')
enemy('armored_worm',[sp('craft_cargoB',(1.10,.88,.52),(0,.66,.21),'segment0'),sp('craft_cargoB',(1.22,.94,.64),(0,0,.23),'segment1'),sp('craft_miner',(1.32,.93,.61),(0,-.65,.23),'segment2'),*pair('rocket_finsA',(.23,.67,.39),.66,-.27,.29,'fin',finish='armor')])
enemy('shield_conductor',[rover(),sp('machine_generatorLarge',(.86,.86,.68),(0,0,.52),'core'),*pair('corridor_wallCorner',(.34,.81,.94),.68,-.09,.45,'shield',finish='armor'),sp('satelliteDish',(.66,.42,.68),(0,.12,1.15),'sensor')])
enemy('signal_summoner',[rover((1.50,1.39,.6)),sp('gate_simple',(1.22,.46,1.19),(0,.11,.6),'gate'),sp('machine_wireless',(.48,.48,.74),(0,-.28,.65),'core'),*pair('rocket_fuelB',(.36,.56,.63),.73,.03,.61,'pod')])
enemy('resistance_corruptor',[td('enemy-ufo-c',(1.61,1.36,.56),(0,0,.68),'body'),*pair('rocket_fuelB',(.38,.4,.88),.58,-.05,.32,'pod',finish='gold'),*pair('rocket_finsB',(.27,.58,.62),.9,.1,.61,'fin',finish='blade')],'hover')
enemy('detonation_shell',[sp('craft_cargoA',(1.42,1.40,.52),(0,0,.26),'body'),sp('machine_barrelLarge',(.87,.87,.84),(0,0,.64),'core',finish='gold'),*pair('rocket_fuelA',(.38,.38,.64),.68,0,.31,'pod')])
enemy('frequency_hunter',[rover((1.66,1.54,.62)),sp('turret_double',(1.37,1.76,.61),(0,-.10,.65),'barrel'),*pair('weapon_rifle',(.23,1.89,.26),.58,-.20,1.20,'barrel'),sp('satelliteDish_detailed',(.67,.49,.58),(0,.48,1.03),'sensor')],elite=True)
enemy('terrain_dismantler',[sp('craft_miner',(1.72,1.63,.70),(0,0,.25),'body'),*pair('weapon_gun',(.52,1.05,.5),.68,-.61,.55,'hammer'),sp('rocket_baseB',(.71,.62,.70),(0,-.91,.35),'hammer',finish='metal'),*pair('rocket_fuelB',(.40,.61,.72),.74,.29,.60,'loader',finish='gold')],elite=True)
enemy('proliferation_protocol',[rover((1.62,1.58,.56)),sp('hangar_roundA',(1.23,1.1,.72),(0,.0,.52),'body'),*pair('machine_barrel',(.46,.47,.93),.79,.17,.48,'pod'),sp('gate_simple',(.91,.38,1.11),(0,.16,.91),'gate')],elite=True)
enemy('spirit_taxer',[td('enemy-ufo-d',(1.72,1.56,.53),(0,0,.75),'body'),*pair('rocket_fuelB',(.42,.45,1.07),.71,.0,.28,'pod',finish='gold'),sp('satelliteDish_large',(.81,.60,.72),(0,-.18,1.19),'speaker'),*pair('rocket_finsA',(.23,.78,.47),.96,.07,.74,'fin')],'hover',elite=True)

# Revision 4 formations: a wide shield, wing escorts, factory transports and
# articulated heavy siege chassis use distinct assemblies of licensed parts.
enemy('scrap_bulwark',[rover((1.4,1.2,.5)),sp('corridor_wallCorner',(1.65,.40,1.04),(0,-.45,.43),'shield',finish='armor'),sp('weapon_gun',(.43,1.25,.36),(0,-.68,.88),'barrel'),eye(1.32)])
enemy('echo_glider',[sp('craft_speederA',(1.06,1.68,.43),(0,0,.62),'body'),*pair('rocket_finsB',(.70,.90,.30),.88,.17,.70,'fin',(0,20,0),'blade'),sp('satelliteDish',(.64,.37,.58),(0,.15,1.03),'speaker'),*pair('rocket_fuelA',(.27,.69,.3),.40,.45,.43,'engine',finish='glow')],'hover')
enemy('noise_bell',[rover((1.55,1.32,.54)),sp('gate_simple',(1.24,.48,1.56),(0,.18,.63),'gate',finish='metal'),sp('satelliteDish_large',(1.37,.83,.84),(0,-.05,1.64),'speaker'),sp('machine_generator',(.72,.75,.81),(0,0,.63),'core',finish='gold')],elite=True)
enemy('memory_runner',[sp('alien',(.82,.81,1.47),(0,0,.34),'body'),*legs(),*pair('weapon_gun',(.27,1.01,.32),.53,-.22,.99,'arm'),sp('machine_barrel',(.62,.67,.80),(0,.53,.82),'reservoir',finish='ivory'),*pair('rocket_finsB',(.25,.57,.9),.58,.19,.53,'fin',finish='metal')],'runner')
enemy('repair_skiff',[sp('craft_cargoB',(1.48,1.62,.58),(0,0,.64),'body'),*pair('machine_barrel',(.52,.55,.77),.66,-.04,.82,'reservoir',finish='ivory'),*pair('weapon_gun',(.22,.93,.22),.86,-.38,.54,'tool',finish='gold'),sp('rocket_fuelA',(.74,.66,.35),(0,.30,.32),'engine',finish='glow')],'hover')
enemy('archive_warden',[rover((1.85,1.65,.64)),*pair('corridor_wallCorner',(.45,1.02,1.42),.86,0,.56,'shield',finish='armor'),sp('gate_complex',(1.15,.59,1.18),(0,.16,.75),'gate'),sp('machine_generator',(.68,.62,.90),(0,-.33,.72),'core',finish='gold')],elite=True)
enemy('ordered_sentinel',[sp('alien',(1.02,.99,1.70),(0,0,.33),'body'),*legs(),*pair('corridor_wallCorner',(.41,.75,1.13),.67,.04,.78,'shield',finish='armor'),*pair('weapon_rifle',(.31,1.50,.32),.65,-.53,.94,'barrel'),sp('rocket_topA',(.57,.57,.56),(0,.05,1.84),'head',finish='gold')],'walker')
enemy('null_wing',[td('enemy-ufo-b',(1.71,1.56,.53),(0,0,.67),'body'),*pair('rocket_finsA',(.40,1.37,.52),.88,.14,.64,'fin',finish='blade'),*pair('satelliteDish',(.63,.39,.69),.66,.22,1.03,'sensor'),sp('machine_wireless',(.48,.47,.73),(0,-.27,.97),'core',finish='gold')],'hover')
enemy('entropy_engine',[sp('craft_miner',(2.1,2.12,.82),(0,0,.29),'body'),*pair('turret_double',(.68,1.58,.51),.76,-.65,.79,'barrel'),sp('rocket_baseB',(1.44,.91,.77),(0,-1.12,.30),'hammer',finish='metal'),sp('machine_generatorLarge',(1.03,1.04,1.12),(0,.31,1.02),'core',finish='gold'),*pair('rocket_fuelB',(.48,.74,1.14),1.03,.35,.59,'reservoir')],elite=True)

enemy('noise_hive',[sp('hangar_roundB',(1.81,1.47,.93),(0,.20,.35),'body'),sp('gate_complex',(1.11,.65,1.12),(0,-.48,.41),'gate'),
    *pair('craft_cargoB',(.50,1.26,.62),1.0,.12,.26,'segment'),sp('machine_generatorLarge',(.72,.70,.69),(0,.34,1.25),'core'),
    *pair('machine_barrel',(.38,.45,.67),.72,-.07,1.18,'pod')],boss=True,
    phase_parts=[*pair('craft_speederA',(.5,.70,.27),1.12,-.49,.96,'drone'),sp('satelliteDish_large',(.85,.68,.64),(0,.28,1.84),'sensor')])
enemy('mirror_censor',[sp('alien',(.95,.76,1.44),(0,0,.27),'body'),*legs(),*pair('corridor_wallCorner',(.42,.59,1.44),.73,.0,.47,'shield',finish='metal'),
    sp('pipe_ringHigh',(1.63,.53,1.34),(0,.19,.96),'ring',finish='gold')],'walker',boss=True,
    phase_parts=[*pair('satelliteDish',(.68,.4,.85),1.0,-.15,.98,'shield'),sp('rocket_topB',(.64,.52,.69),(0,0,1.94),'core',finish='glow')])
enemy('memory_reforger',[sp('craft_cargoB',(1.92,1.56,.77),(0,0,.22),'body'),sp('machine_generatorLarge',(1.15,1.03,1.01),(0,.14,.96),'core'),
    *pair('supports_high',(.25,.46,.96),.99,-.18,.55,'arm'),*pair('weapon_gun',(.44,1.12,.39),1.0,-.41,1.40,'tool',finish='gold')],boss=True,
    phase_parts=[*pair('machine_barrelLarge',(.46,.50,.85),.82,.55,1.02,'reservoir',finish='ivory'),sp('satelliteDish_detailed',(.8,.62,.5),(0,.22,2.0),'sensor')])
enemy('bandwidth_requisitioner',[sp('craft_cargoA',(1.86,1.62,.56),(0,0,.21),'body'),sp('machine_wireless',(.91,.76,1.4),(0,0,.72),'body'),
    *pair('satelliteDish_large',(.91,.53,.91),.82,-.12,1.14,'sensor'),sp('rocket_fuelB',(.50,.57,.7),(0,.14,1.73),'core',finish='gold')],boss=True,
    phase_parts=[*pair('rocket_finsB',(.25,.73,1.20),1.04,.36,.75,'fin',finish='metal'),sp('satelliteDish',(.88,.51,.72),(0,-.02,2.25),'sensor')])
enemy('chorus_overseer',[td('enemy-ufo-d',(1.88,1.72,.59),(0,0,.72),'body'),sp('machine_generator',(.91,.84,1.06),(0,.12,1.04),'core'),
    *pair('satelliteDish_large',(.79,.60,1.03),.96,-.12,.99,'speaker'),sp('satelliteDish',(.83,.62,.75),(0,-.24,1.87),'speaker')],'hover',boss=True,
    phase_parts=[*pair('rocket_finsA',(.47,.86,.88),1.14,.19,.69,'fin',finish='metal'),*pair('satelliteDish',(.57,.41,.56),.75,.28,2.0,'speaker')])
enemy('zero_frequency_mind',[sp('craft_miner',(1.86,1.82,.67),(0,0,.28),'body'),sp('gate_complex',(1.58,.91,1.44),(0,.05,.72),'gate'),
    sp('rocket_topB',(.79,.70,.88),(0,-.01,1.39),'core',finish='glow'),*pair('weapon_gun',(.50,1.27,.46),.98,-.41,.71,'barrel')],boss=True,
    phase_parts=[*pair('rocket_finsB',(.40,.74,1.19),1.02,.43,1.17,'fin',finish='metal'),sp('satelliteDish_detailed',(.91,.75,.64),(0,.05,2.22),'sensor')])


def setup_sources(source_cache):
    used = sorted({p['source'] for r in RECIPES.values() for variant in r['variants'] for p in assembly_parts(r,variant)})
    records = []
    for item in used:
        path = SOURCES / (item + '.glb')
        if not path.exists() and source_cache:
            pack, name = item.split('/')
            matches = list((Path(source_cache) / pack / 'Models').rglob(name + '.glb'))
            if len(matches) != 1:
                raise RuntimeError(f'Expected one licensed source for {item}, found {len(matches)}')
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(matches[0], path)
        if not path.exists():
            raise FileNotFoundError(f'{path}; supply --source-cache for the already downloaded Kenney packs')
        records.append(dict(path=str(path.relative_to(ROOT)).replace('\\', '/'), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return records


def rgba(hex):
    return tuple(int(hex[i:i+2], 16) / 255 for i in [0, 2, 4]) + (1,)


PALETTES = {
    'towers':dict(dark='23383F',metal='ADB7AE',ivory='EEE7D4',accent='63BDA4',glow='A4F4D8',gold='D8B469',armor='50756E',blade='CCEADC'),
    'enemies':dict(dark='342B38',metal='A996A0',ivory='DDCEBD',accent='B75550',glow='FFB097',gold='D6A358',armor='634852',blade='EAD4C4')
}
MATERIALS, TEMPLATES = {}, {}


def material(kind, finish):
    key = (kind, finish)
    if key not in MATERIALS:
        mat = bpy.data.materials.new(f'{kind}_{finish}')
        mat.diffuse_color = rgba(PALETTES[kind][finish])
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = mat.diffuse_color
        shader.inputs['Roughness'].default_value = .74
        shader.inputs['Metallic'].default_value = .15 if finish in ['metal','blade'] else .02
        if finish == 'glow':
            shader.inputs['Emission Color'].default_value = mat.diffuse_color
            shader.inputs['Emission Strength'].default_value = .18
        MATERIALS[key] = mat
    return MATERIALS[key]


def finish_for_color(color, name=''):
    lo, hi = min(color[:3]), max(color[:3])
    name = name.lower()
    if 'glass' in name or 'blue' in name or 'red' in name or hi-lo>.17:
        return 'accent'
    if hi < .35 or 'dark' in name and hi < .65:
        return 'dark'
    if hi > .86:
        return 'ivory'
    return 'metal'


def template(source, kind, finish):
    key = (source, kind, finish)
    if key in TEMPLATES:
        return TEMPLATES[key]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCES / (source + '.glb')))
    added = set(bpy.data.objects) - before
    meshes = [o for o in added if o.type == 'MESH']
    # Apply source hierarchy and import coordinate conversion, then normalize.
    all_points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = Vector(tuple(min(v[i] for v in all_points) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in all_points) for i in range(3)))
    center = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    span = high-low
    result = []
    for obj in meshes:
        mesh = obj.data.copy()
        matrix = obj.matrix_world.copy()
        for v in mesh.vertices:
            p = matrix @ v.co - center
            v.co = tuple(p[i] / max(span[i], .00001) for i in range(3))
        original = list(mesh.materials)
        mesh.materials.clear()
        finishes = list(PALETTES[kind])
        for f in finishes:
            mesh.materials.append(material(kind, f))
        for face in mesh.polygons:
            old = original[min(face.material_index, len(original)-1)] if original else None
            color = old.diffuse_color if old else (.6,.6,.6,1)
            if old and old.use_nodes:
                textures = [n.image for n in old.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
                if textures and mesh.uv_layers.active:
                    image = textures[0]
                    uv = mesh.uv_layers.active.data[face.loop_indices[0]].uv
                    x = min(image.size[0]-1, max(0, int(uv.x*image.size[0])))
                    y = min(image.size[1]-1, max(0, int(uv.y*image.size[1])))
                    offset = (y*image.size[0]+x)*4
                    color = image.pixels[offset:offset+4]
            chosen = finish_for_color(color, old.name if old else '')
            # Deliberate finishes recolor panels only; retain source joints and trim.
            if finish != 'native' and chosen not in ['dark']:
                chosen = finish if chosen == 'accent' or finish in ['blade','glow'] else ('metal' if chosen=='metal' else finish)
            face.material_index = finishes.index(chosen)
        mesh.update()
        result.append(mesh)
    for obj in added:
        bpy.data.objects.remove(obj, do_unlink=True)
    TEMPLATES[key] = result
    return result


def assembly_parts(recipe, variant):
    parts = list(recipe['parts'])
    if recipe['locomotion']=='crawler' and not any(p['motion'].startswith('segment') for p in parts):
        width=1.04 if recipe['role']=='boss' else .74
        wheel=.43 if recipe['role']=='boss' else .34
        for y in [-.48,.43]:
            parts+=pair('barrel',(wheel,wheel,wheel*.75),width,y,.09,'wheel',(0,90,0),'metal')
        parts+=pair('supports_low',(.19,1.12,.19),width,0,.29,'drive',finish='gold')
    if recipe['kind'] == 'towers' and variant != 'T1':
        additions = recipe['branch_a' if variant.endswith('A') else 'branch_b']
        parts += additions
        if variant.startswith('T3'):
            # Third tier gains a second physically separate module bank and rear
            # stabilizers, rather than enlarging/recoloring the complete sprite.
            parts += pair('rocket_finsA',(.32,.65,.68),.93,.49,.23,'brace',finish='metal')
            for p in additions[:2]:
                q = dict(p)
                q['size'] = tuple(v*.72 for v in p['size'])
                q['position'] = (p['position'][0]*.82, p['position'][1]+.28, p['position'][2]+.43)
                parts.append(q)
    elif recipe['role'] == 'boss':
        phase = int(variant[-1])
        if phase >= 2:
            parts += recipe['phase_parts'][:2]
        if phase >= 3:
            parts += recipe['phase_parts'][2:]
            parts += pair('rocket_fuelB',(.39,.51,.68),.84,.61,1.22,'core',finish='glow')
    return parts


def pose_part(p, pose, recipe):
    pos, rot = Vector(p['position']), Vector(tuple(math.radians(v) for v in p['rotation']))
    m = p['motion']
    side = -1 if m.endswith('L') else 1
    cycle = math.sin((pose-1)*math.pi/2) if 1 <= pose <= 4 else 0
    # The attack frames show a visible windup, contact/recoil and return.
    attack = {5:-.45,6:1,7:.22}.get(pose,0)
    cast = {8:.48,9:1}.get(pose,0)
    if m.startswith('leg'):
        rot.x += cycle*.39*side
        pos.y += cycle*.14*side
        pos.z += max(0,math.cos((pose-1)*math.pi/2)*side)*.10 if 1<=pose<=4 else 0
    elif m.startswith('wheel'):
        rot.x += ((pose-1)*.55 if 1<=pose<=4 else 0)
    elif m.startswith('drive'):
        if 1<=pose<=4:
            pos.y += math.cos((pose-1)*math.pi/2)*.19*side
            pos.z += cycle*.055*side
    elif m.startswith('segment'):
        index = int(m[-1]) if m[-1].isdigit() else side
        pos.x += (math.sin((pose-1)*math.pi/2+index*.85)*.24 if 1<=pose<=4 else 0)
        rot.z += cycle*.13
        if index==2:
            pos.y -= attack*.29
            rot.x -= attack*.14
    elif m.startswith('blade'):
        rot.y += attack*.62*side
        rot.z += attack*.62*side
        pos.y -= max(0,attack)*.34
    elif m.startswith(('barrel','hammer','mortar')):
        pos.y += attack*.27
        rot.x -= attack*(.16 if m!='mortar' else .28)
        rot.x += cast*.10
    elif m.startswith('loader'):
        pos.y += attack*.18
    elif m.startswith(('tool','arm')):
        rot.x += (attack*.34+cast*.39)*side
        rot.z += (attack*.17+cast*.33)*side
        pos.y -= (attack*.12+cast*.17)
    elif m.startswith('shield'):
        pos.x += cast*.17*side
        pos.y -= attack*.22
        rot.z += (cast*.29-attack*.12)*side
    elif m.startswith(('sensor','speaker')):
        rot.z += cycle*.13+cast*.23*side
        rot.x += cast*.24
    elif m.startswith(('fin','brace')):
        rot.y += (cycle*.09+cast*.26)*side
        if recipe['locomotion']=='hover' and 1<=pose<=4:
            pos.z += math.cos((pose-1)*math.pi/2)*.055*side
    elif m.startswith(('drone','pod','reservoir')):
        pos.z += (cycle*.12*side if m.startswith('drone') else 0)+cast*.18
        pos.x += cast*.14*side
        rot.z += cycle*.12*side
        if m.startswith('drone'):
            pos.y -= attack*.31
            pos.z += attack*.20
            rot.x -= attack*.19
    elif m in ['ring','gate']:
        rot.z += cast*.28
        pos.z += cast*.09
    elif m in ['core','head','engine']:
        pos.z += cast*.15
        rot.z += cast*.13
        if m=='head':
            rot.x -= attack*.18
    elif m == 'body':
        if recipe['kind']=='enemies':
            rot.x -= attack*.16
            pos.y -= attack*.16
        if recipe['locomotion'] in ['walker','runner']:
            rot.z += cycle*.045
            pos.z += abs(cycle)*.045
        elif recipe['locomotion']=='hover':
            rot.y += cycle*.10
            pos.z += cycle*.085
        elif recipe['locomotion']=='crawler' and 1<=pose<=4:
            rot.y += cycle*.045
            pos.z += math.cos((pose-1)*math.pi/2)*.035
    return pos,rot


def create_instance(recipe, parts, pose, direction, offset, scale):
    yaw = Matrix.Rotation(direction*math.tau/8,4,'Z')
    translation = Matrix.Translation(offset)
    root_scale = Matrix.Diagonal((scale,scale,scale,1))
    for p in parts:
        pos,rot = pose_part(p,pose,recipe)
        local = Matrix.Translation(pos) @ Matrix.Rotation(rot.z,4,'Z') @ Matrix.Rotation(rot.y,4,'Y') @ Matrix.Rotation(rot.x,4,'X')
        local @= Matrix.Diagonal((*p['size'],1))
        for mesh in template(p['source'],recipe['kind'],p['finish']):
            obj = bpy.data.objects.new(p['motion'],mesh)
            bpy.context.scene.collection.objects.link(obj)
            obj.matrix_world = translation @ yaw @ root_scale @ local


def model_scale(recipe):
    """One framing for every pose/tier; bounds include each articulated part."""
    left,right,bottom,top=0.,0.,0.,0.
    up=Vector((0,math.sin(ELEVATION),math.cos(ELEVATION)))
    corners=[Vector((x,y,z)) for x in [-.5,.5] for y in [-.5,.5] for z in [0,1]]
    for variant in recipe['variants']:
        for pose in range(POSES):
            for p in assembly_parts(recipe,variant):
                pos,rot=pose_part(p,pose,recipe)
                local=Matrix.Translation(pos) @ Matrix.Rotation(rot.z,4,'Z') @ Matrix.Rotation(rot.y,4,'Y') @ Matrix.Rotation(rot.x,4,'X') @ Matrix.Diagonal((*p['size'],1))
                for direction in range(8):
                    matrix=Matrix.Rotation(direction*math.tau/8,4,'Z') @ local
                    for point in corners:
                        q=matrix @ point
                        left=min(left,q.x);right=max(right,q.x)
                        y=q.dot(up)
                        bottom=min(bottom,y);top=max(top,y)
    # Four clear pixels on all sides, including the forward ground projection.
    scale=min(1.08,1.64/max(-left,right),2.44/max(.01,top),.82/max(.01,-bottom))
    return scale


def setup_scene(width,height):
    scene=bpy.context.scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    scene.render.engine='BLENDER_WORKBENCH'
    scene.render.resolution_x=width
    scene.render.resolution_y=height
    scene.render.resolution_percentage=100
    scene.render.dither_intensity=0
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.compression=80
    scene.display.shading.light='STUDIO'
    scene.display.shading.studiolight_rotate_z=.4
    scene.display.shading.studio_light='paint.sl'
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.curvature_ridge_factor=1.25
    scene.display.shading.curvature_valley_factor=1.15
    scene.display.shading.cavity_ridge_factor=1.15
    scene.display.shading.cavity_valley_factor=1.25
    scene.display.shading.show_object_outline=False
    scene.display.render_aa='8'
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None'
    camera_data=bpy.data.cameras.new('Orthographic55')
    camera=bpy.data.objects.new('Orthographic55',camera_data)
    scene.collection.objects.link(camera)
    scene.camera=camera
    camera_data.type='ORTHO'
    camera_data.ortho_scale=8*3.65
    camera_data.clip_end=1000
    camera.location=(0,-math.cos(ELEVATION)*200,math.sin(ELEVATION)*200)
    camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    return scene


def bake(id,output):
    recipe=RECIPES[id]
    variants=recipe['variants']
    # All variants share the same framing; late tier parts cannot shrink T1.
    scale=model_scale(recipe)
    paths={}
    for animated in [True]:
        rows=len(variants)*(POSES if animated else 1)
        scene=setup_scene(CELL*8,CELL*rows)
        # Blender's ortho_scale covers the larger raster dimension.
        scene.camera.data.ortho_scale=max(8,rows)*3.65
        up=Vector((0,math.sin(ELEVATION),math.cos(ELEVATION)))
        right=Vector((1,0,0))
        for vi,variant in enumerate(variants):
            parts=assembly_parts(recipe,variant)
            for pose in range(POSES if animated else 1):
                row=vi*(POSES if animated else 1)+pose
                for direction in range(8):
                    offset=right*((direction-3.5)*3.65)+up*((rows/2-row-.72)*3.65)
                    create_instance(recipe,parts,pose,direction,offset,scale)
        folder=output/('animations' if animated else '')/recipe['kind']
        folder.mkdir(parents=True,exist_ok=True)
        path=folder/(id+'.png')
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        paths['animation' if animated else 'static']=str(path)
    # Export the exact neutral pose from each animation group. A separate scene
    # would re-jitter antialiasing and cavity samples at its new screen origin.
    atlas=bpy.data.images.load(paths['animation'],check_existing=False)
    atlas.colorspace_settings.name='Non-Color'
    pixels=np.empty(len(atlas.pixels),dtype=np.float32)
    atlas.pixels.foreach_get(pixels)
    pixels=pixels.reshape((atlas.size[1],atlas.size[0],4))
    neutral=np.concatenate([pixels[atlas.size[1]-(vi*10+1)*80:atlas.size[1]-vi*800] for vi in reversed(range(len(variants)))],axis=0)
    icon=bpy.data.images.new(id+'_neutral',width=640,height=80*len(variants),alpha=True)
    icon.colorspace_settings.name='Non-Color'
    icon.pixels.foreach_set(neutral.ravel())
    icon.file_format='PNG'
    folder=output/recipe['kind'];folder.mkdir(parents=True,exist_ok=True)
    icon.filepath_raw=str(folder/(id+'.png'))
    icon.save()
    paths['static']=icon.filepath_raw
    bpy.data.images.remove(atlas)
    bpy.data.images.remove(icon)
    return dict(id=id,variants=variants,paths=paths,cell=CELL,directions=8,poseRows=POSES,rows=len(variants)*POSES,baseline=.72,bearing=0,elevation=55,modelScale=scale,role=recipe['role'],locomotion=recipe['locomotion'])


def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True)
    parser.add_argument('--ids',default=','.join(RECIPES))
    parser.add_argument('--source-cache')
    args=parser.parse_args(argv)
    output=Path(args.output).resolve()
    if output==ROOT or ROOT in output.parents:
        parser.error('Bake to an external staging directory, inspect, then copy approved PNGs into assets/game/sprites.')
    sources=setup_sources(args.source_cache)
    output.mkdir(parents=True,exist_ok=True)
    started=time.time()
    records=[]
    for id in args.ids.split(','):
        if id not in RECIPES:
            raise ValueError('Unknown entity '+id)
        records.append(bake(id,output))
        print('ENTITY_ART_BAKED '+id,flush=True)
    report=dict(blender=bpy.app.version_string,seconds=round(time.time()-started,3),sources=sources,entities=records)
    (output/'bake-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('ENTITY_ART_COMPLETE '+json.dumps(dict(count=len(records),seconds=report['seconds'])),flush=True)


if __name__=='__main__':
    main()
