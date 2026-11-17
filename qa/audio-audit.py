#!/usr/bin/env python3
"""Audit the actual delivered music bytes using FFmpeg and Python stdlib."""
import array
import hashlib
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / 'media/yoga-music/manifest.json').read_text())
    results = []
    for entry in manifest['files']:
        path = ROOT / entry['src']
        raw = path.read_bytes()
        assert len(raw) == entry['bytes'] < 1200000
        assert hashlib.sha256(raw).hexdigest() == entry['sha256']
        assert raw.index(b'moov') < raw.index(b'mdat'), 'faststart'
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
        assert len(info['streams']) == 1
        stream = info['streams'][0]
        assert stream['codec_name'] == 'aac' and stream['profile'] == 'LC'
        assert stream['channels'] == 2 and int(stream['sample_rate']) == 48000
        assert abs(float(info['format']['duration']) - 80) < .025
        samples = array.array('f', subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-acodec', 'pcm_f32le', '-']))
        assert len(samples) == 80 * 48000 * 2
        peak = max(abs(x) for x in samples)
        rms = math.sqrt(sum(x*x for x in samples) / len(samples))
        seam = max(abs(samples[-2] - samples[0]), abs(samples[-1] - samples[1]))
        assert .02 < rms < .13 and peak < .5, (entry['id'], peak, rms)
        assert seam < .003, (entry['id'], 'loop edge', seam)
        assert abs(peak - entry['decodedPeak']) < .00001
        assert abs(rms - entry['decodedRms']) < .00001
        results.append({'id': entry['id'], 'seconds': 80, 'bytes': len(raw), 'peakDbFS': round(20*math.log10(peak), 2), 'rmsDbFS': round(20*math.log10(rms), 2), 'loopEdgeDelta': round(seam, 7)})
    print(json.dumps({'passed': True, 'recordings': results}, indent=2))


if __name__ == '__main__':
    main()
