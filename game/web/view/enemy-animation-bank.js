// Independently authored enemy motion registry.
import {animate as a0} from './enemy-animations/archive-warden.js';
import {animate as a1} from './enemy-animations/armored-worm.js';
import {animate as a2} from './enemy-animations/bandwidth-jammer.js';
import {animate as a3} from './enemy-animations/bandwidth-requisitioner.js';
import {animate as a4} from './enemy-animations/chorus-overseer.js';
import {animate as a5} from './enemy-animations/detonation-shell.js';
import {animate as a6} from './enemy-animations/echo-glider.js';
import {animate as a7} from './enemy-animations/entropy-engine.js';
import {animate as a8} from './enemy-animations/floating-noise.js';
import {animate as a9} from './enemy-animations/fracture-seed.js';
import {animate as a10} from './enemy-animations/frequency-hunter.js';
import {animate as a11} from './enemy-animations/memory-medic.js';
import {animate as a12} from './enemy-animations/memory-reforger.js';
import {animate as a13} from './enemy-animations/memory-runner.js';
import {animate as a14} from './enemy-animations/mirror-censor.js';
import {animate as a15} from './enemy-animations/noise-bell.js';
import {animate as a16} from './enemy-animations/noise-hive.js';
import {animate as a17} from './enemy-animations/null-wing.js';
import {animate as a18} from './enemy-animations/ordered-sentinel.js';
import {animate as a19} from './enemy-animations/phase-teleporter.js';
import {animate as a20} from './enemy-animations/pressure-cantor.js';
import {animate as a21} from './enemy-animations/proliferation-protocol.js';
import {animate as a22} from './enemy-animations/remote-hunter.js';
import {animate as a23} from './enemy-animations/repair-skiff.js';
import {animate as a24} from './enemy-animations/replication-node.js';
import {animate as a25} from './enemy-animations/resistance-corruptor.js';
import {animate as a26} from './enemy-animations/scrap-bulwark.js';
import {animate as a27} from './enemy-animations/shield-conductor.js';
import {animate as a28} from './enemy-animations/shield-echo.js';
import {animate as a29} from './enemy-animations/siege-ram.js';
import {animate as a30} from './enemy-animations/signal-summoner.js';
import {animate as a31} from './enemy-animations/spike-runner.js';
import {animate as a32} from './enemy-animations/spirit-taxer.js';
import {animate as a33} from './enemy-animations/static-drifter.js';
import {animate as a34} from './enemy-animations/tempo-amplifier.js';
import {animate as a35} from './enemy-animations/terrain-dismantler.js';
import {animate as a36} from './enemy-animations/zero-frequency-mind.js';
const animations={
 "archive_warden":a0,
 "armored_worm":a1,
 "bandwidth_jammer":a2,
 "bandwidth_requisitioner":a3,
 "chorus_overseer":a4,
 "detonation_shell":a5,
 "echo_glider":a6,
 "entropy_engine":a7,
 "floating_noise":a8,
 "fracture_seed":a9,
 "frequency_hunter":a10,
 "memory_medic":a11,
 "memory_reforger":a12,
 "memory_runner":a13,
 "mirror_censor":a14,
 "noise_bell":a15,
 "noise_hive":a16,
 "null_wing":a17,
 "ordered_sentinel":a18,
 "phase_teleporter":a19,
 "pressure_cantor":a20,
 "proliferation_protocol":a21,
 "remote_hunter":a22,
 "repair_skiff":a23,
 "replication_node":a24,
 "resistance_corruptor":a25,
 "scrap_bulwark":a26,
 "shield_conductor":a27,
 "shield_echo":a28,
 "siege_ram":a29,
 "signal_summoner":a30,
 "spike_runner":a31,
 "spirit_taxer":a32,
 "static_drifter":a33,
 "tempo_amplifier":a34,
 "terrain_dismantler":a35,
 "zero_frequency_mind":a36
};
export const enemyAnimationIds=Object.freeze(Object.keys(animations));
export function animateEnemy(type,context){return animations[type]?.(context)??null;}
