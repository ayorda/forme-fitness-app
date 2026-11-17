#!/usr/bin/env python3
"""Render FORME's original algorithmic scores; no samples or external music.

Requires Python/numpy and FFmpeg. Intermediate PCM stays outside the app.
Run: python3 qa/render-yoga-music.py --work /tmp/forme-yoga-render
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE, SECONDS = 48000, 80
SCORES = {
    'calm': {'seed': 1501, 'chords': [[50, 57, 60, 64], [53, 60, 64, 69], [48, 55, 62, 64], [55, 62, 65, 69]], 'step': 5, 'pluck': .035, 'pulse': 0},
    'flow': {'seed': 1502, 'chords': [[50, 57, 62, 65], [58, 65, 69, 72], [53, 60, 65, 69], [48, 55, 62, 67]], 'step': 10/3, 'pluck': .045, 'pulse': .012},
    'breath': {'seed': 1503, 'chords': [[48, 55, 62], [48, 55, 64], [50, 57, 64], [48, 55, 62]], 'step': 20, 'pluck': .009, 'pulse': 0},
    'relax': {'seed': 1504, 'chords': [[45, 52, 59, 64], [48, 55, 59, 64], [43, 50, 57, 62], [45, 52, 59, 64]], 'step': 10, 'pluck': .014, 'pulse': 0},
}


def frequency(note):
    # Integer periods across the complete loop avoid a phase jump at the seam.
    return round(440 * 2 ** ((note - 69) / 12) * SECONDS) / SECONDS


def render(style, score):
    t = np.arange(RATE * SECONDS, dtype=np.float64) / RATE
    audio = np.zeros((len(t), 2), dtype=np.float64)
    rng = np.random.default_rng(score['seed'])
    for chord_index, chord in enumerate(score['chords']):
        distance = (t - chord_index * 20 + SECONDS / 2) % SECONDS - SECONDS / 2
        envelope = np.where(np.abs(distance) <= 14, np.cos(np.minimum(np.abs(distance), 14) / 14 * np.pi / 2) ** 2, 0)
        for voice, note in enumerate(chord):
            phase = rng.uniform(0, np.pi * 2)
            fundamental = np.sin(2 * np.pi * frequency(note) * t + phase)
            overtone = .10 * np.sin(2 * np.pi * frequency(note + 12) * t + phase / 2)
            slow = .88 + .12 * np.sin(2 * np.pi * (voice + 1) * t / SECONDS + phase)
            signal = (fundamental + overtone) * envelope * slow * .034
            pan = .30 + .4 * (voice / max(1, len(chord) - 1))
            audio[:, 0] += signal * np.sqrt(1 - pan)
            audio[:, 1] += signal * np.sqrt(pan)
    for i, start in enumerate(np.arange(0, SECONDS, score['step'])):
        chord = score['chords'][int(start // 20) % 4]
        note = chord[(i * 2 + i // 4) % len(chord)] + 12
        age = (t - start) % SECONDS
        envelope = (1 - np.exp(-age / .045)) * np.exp(-age / (2.8 if style != 'flow' else 1.5))
        signal = (np.sin(2 * np.pi * frequency(note) * age) + .13 * np.sin(2 * np.pi * frequency(note + 12) * age)) * envelope * score['pluck']
        pan = .35 if i % 2 else .65
        audio[:, 0] += signal * np.sqrt(1 - pan)
        audio[:, 1] += signal * np.sqrt(pan)
    if score['pulse']:
        # 72 bpm, rounded soft sine pulses; no drum sample or abrupt attack.
        pulse = (.5 - .5 * np.cos(2 * np.pi * 1.2 * t)) ** 3
        signal = np.sin(2 * np.pi * frequency(38) * t) * pulse * score['pulse']
        audio += signal[:, None]
    audio -= audio.mean(axis=0)
    audio *= min(.09 / np.sqrt(np.mean(audio ** 2)), .42 / np.max(np.abs(audio)))
    # AAC encoder delay can disturb an otherwise periodic boundary. A short,
    # quiet join prevents a click without claiming sample-perfect gapless AAC.
    edge = np.sin(np.linspace(0, np.pi / 2, int(RATE * .08))) ** 2
    audio[:len(edge)] *= edge[:, None]
    audio[-len(edge):] *= edge[::-1, None]
    return audio.astype('<f4')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', required=True, type=Path)
    args = parser.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    destination = ROOT / 'media/yoga-music'
    destination.mkdir(parents=True, exist_ok=True)
    entries = []
    for style, score in SCORES.items():
        pcm = args.work / f'{style}.f32'
        render(style, score).tofile(pcm)
        path = destination / f'{style}-v1.m4a'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', str(pcm), '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(path)], check=True)
        decoded = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
        samples = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2)
        entries.append({'id': style, 'src': path.relative_to(ROOT).as_posix(), 'seconds': SECONDS, 'sampleRate': RATE, 'channels': 2, 'codec': 'AAC-LC', 'container': 'M4A', 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'decodedPeak': round(float(np.max(np.abs(samples))), 6), 'decodedRms': round(float(np.sqrt(np.mean(samples ** 2))), 6), 'score': score})
        print(style, path.stat().st_size, 'bytes', flush=True)
    manifest = {'schema': 1, 'version': '1.0', 'created': '2026-11-17', 'provenance': 'Original deterministic algorithmic compositions rendered by qa/render-yoga-music.py for FORME; no third-party samples, recordings, melodies or generation services.', 'rights': 'Project-created audio; no third-party attribution obligation identified. No claim of exclusive copyright in algorithmically generated material.', 'files': entries}
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
