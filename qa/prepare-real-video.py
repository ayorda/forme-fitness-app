"""Prepare unaccepted real-footage review candidates, never publish them.

python qa/prepare-real-video.py --input original.mp4 --plan review-plan.json --output /tmp/review
Plan: sourceSha256, sourcePage, licenseUrl, origin='filmed', trimStart, duration,
maxEdge (default 960), optional crop={x,y,width,height}, optional grade
{contrast,brightness,saturation,gamma}. No preset grade or time manipulation.
Copyright, visual and movement acceptance remain separate human checks.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames',
        '-show_format', '-show_streams', '-of', 'json', str(path)]))


def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', *map(str, args)], check=True)


def prepare(original, plan, target):
    allowed = {'sourceSha256', 'sourcePage', 'licenseUrl', 'origin', 'trimStart', 'duration', 'maxEdge', 'crop', 'grade'}
    if set(plan) - allowed:
        raise ValueError('Unsupported plan fields; no custom filters or speed changes')
    sha = hashlib.sha256(original.read_bytes()).hexdigest()
    if sha != plan['sourceSha256']:
        raise ValueError('Source SHA-256 does not match the review plan')
    if plan['origin'] != 'filmed':
        raise ValueError('Real footage only')
    for key in ['sourcePage', 'licenseUrl']:
        if not re.fullmatch(r'https://[^\s]+', plan[key]):
            raise ValueError('Public HTTPS source and licence references required')
    source = probe(original)
    if any(key.lower() == 'aigc' for key in source['format'].get('tags', {})):
        raise ValueError('AI-marked source is not eligible for the real-footage workflow')
    stream = next(s for s in source['streams'] if s['codec_type'] == 'video')
    if stream.get('sample_aspect_ratio', '1:1') not in ['1:1', '0:1', 'N/A']:
        raise ValueError('Nonsquare source pixels need separate reviewed normalization')
    start = plan['trimStart']
    source_duration = float(stream.get('duration', source['format']['duration']))
    duration = plan['duration']
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0 or abs(duration * 24 - round(duration * 24)) > .000001:
        raise ValueError('Choose a positive duration on the 24 fps frame boundary')
    frames = round(duration * 24)
    if isinstance(start, bool) or not isinstance(start, (int, float)) or not math.isfinite(start) or start < 0 or start + duration > source_duration + 0.000001:
        raise ValueError('The complete continuous interval must exist in the source; no padding or speed changes')
    edge = plan.get('maxEdge', 960)
    if type(edge) is not int or edge < 480 or edge > 1280 or edge % 2:
        raise ValueError('maxEdge must be an even integer between 480 and 1280')
    filters = []
    width, height = stream['width'], stream['height']
    # FFmpeg autorotates the decoded image; use that same display coordinate space.
    rotation = next((s['rotation'] for s in stream.get('side_data_list', []) if 'rotation' in s), 0)
    if rotation % 90:
        raise ValueError('Nonorthogonal source rotation needs separate reviewed normalization')
    if rotation % 180:
        width, height = height, width
    crop = plan.get('crop')
    if crop is not None:
        if set(crop) != {'x', 'y', 'width', 'height'} or any(type(v) is not int or v < 0 or v % 2 for v in crop.values()):
            raise ValueError('Crop must contain even nonnegative integer bounds')
        if not crop['width'] or not crop['height'] or crop['x'] + crop['width'] > width or crop['y'] + crop['height'] > height:
            raise ValueError('Crop exceeds the actual source frame')
        filters.append(f"crop={crop['width']}:{crop['height']}:{crop['x']}:{crop['y']}")
        width, height = crop['width'], crop['height']
    grade = plan.get('grade', {})
    limits = dict(contrast=(.8, 1.2), brightness=(-.05, .05), saturation=(.65, 1.1), gamma=(.85, 1.15))
    for key, value in grade.items():
        if key not in limits or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not limits[key][0] <= value <= limits[key][1]:
            raise ValueError('Only explicitly reviewed moderate colour adjustments are allowed')
    if grade:
        filters.append('eq=' + ':'.join(f'{key}={value}' for key, value in grade.items()))
    ratio = min(1, edge / max(width, height))
    width, height = max(2, int(width * ratio) // 2 * 2), max(2, int(height * ratio) // 2 * 2)
    filters += [f'scale={width}:{height}', 'setsar=1', 'fps=24', 'format=yuv420p']
    target = target.resolve()
    if target.is_relative_to(ROOT) and not target.is_relative_to(ROOT / 'qa-results'):
        raise ValueError('Unaccepted candidates must stay outside the app or in ignored qa-results')
    # An existing directory is refused: do not overwrite a previous review.
    target.mkdir(parents=True, exist_ok=False)
    reference = target / 'reference.mkv'
    run(['-ss', start, '-i', original, '-t', duration, '-map', '0:v:0', '-vf', ','.join(filters),
         '-an', '-map_metadata', '-1', '-c:v', 'ffv1', reference])
    rows = []
    for crf in [22, 24, 26]:
        clip = target / f'candidate-c{crf}.mp4'
        run(['-i', reference, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf,
             '-profile:v', 'main', '-level', '3.1', '-pix_fmt', 'yuv420p', '-an',
             '-map_metadata', '-1', '-movflags', '+faststart', clip])
        metadata = probe(clip); video = metadata['streams'][0]
        if len(metadata['streams']) != 1 or int(video['nb_read_frames']) != frames or abs(float(metadata['format']['duration']) - duration) > .001:
            raise ValueError('Output must match the reviewed continuous duration and frame count, without audio')
        data = clip.read_bytes(); boxes = []; offset = 0
        while offset < len(data):
            length, kind = struct.unpack_from('>I4s', data, offset)
            if length < 8:
                raise ValueError('Invalid MP4 box')
            boxes.append(kind); offset += length
        if offset != len(data) or boxes.index(b'moov') > boxes.index(b'mdat'):
            raise ValueError('MP4 faststart required')
        comparison = subprocess.run(['ffmpeg', '-nostdin', '-i', str(reference), '-i', str(clip),
            '-filter_complex', '[0:v]settb=1/24,setpts=N[r];[1:v]settb=1/24,setpts=N[c];[r][c]ssim=shortest=1',
            '-f', 'null', '-'], capture_output=True, text=True, check=True)
        (target / f'ssim-c{crf}.log').write_text(comparison.stderr)
        rows.append(dict(path=clip.name, crf=crf, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
            duration=duration, frames=frames, fps=video['avg_frame_rate'], width=video['width'], height=video['height'],
            codec=video['codec_name'], pixelFormat=video['pix_fmt'], audio=False, faststart=True,
            ssim=float(re.search(r'All:([0-9.]+)', comparison.stderr).group(1))))
        run(['-i', clip, '-frames:v', 1, '-q:v', 3, '-map_metadata', '-1', target / f'poster-c{crf}.jpg'])
    report = dict(status='UNACCEPTED REVIEW CANDIDATES — NOT FOR CATALOGUE', accepted=False,
        sourceSha256=sha, sourceBytes=original.stat().st_size, plan=plan,
        filters=','.join(filters), candidates=rows,
        limitations='Source declaration and metadata checks do not prove filming, copyright, technique or visual consistency. Inspect every output frame and normal-speed playback separately.')
    (target / 'quality.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--plan', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.input, json.loads(args.plan.read_text()), args.output)))
