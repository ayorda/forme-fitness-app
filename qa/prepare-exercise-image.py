"""Prepare 3:2 WebP previews; publishing requires an exact, explicit visual review.

This enforces a review receipt, not an automatic anatomy detector. Originals and
rejected candidates belong outside the application repository.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

CHECKS = ('singleAthlete', 'limbCount', 'limbContinuity', 'jointAlignment',
          'exercisePose', 'equipmentContact', 'fullBodyMargins',
          'styleConsistency', 'mobileReadability')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(source, exercise, output, review=None):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,80}', exercise):
        raise ValueError('Unsafe exercise ID')
    source = Path(source)
    raw = source.read_bytes()
    with Image.open(io.BytesIO(raw)) as opened:
        image = ImageOps.exif_transpose(opened).convert('RGB')
    if image.width * 2 != image.height * 3 or image.width < 960:
        raise ValueError('Need an uncropped 3:2 source at least 960 pixels wide')
    variants = {}
    for width in (480, 960):
        buffer = io.BytesIO()
        image.resize((width, width * 2 // 3), Image.Resampling.LANCZOS).save(
            buffer, format='WEBP', quality=85, method=6)
        data = buffer.getvalue()
        if len(data) >= 150_000:
            raise ValueError('Review compression separately; variant exceeds budget')
        variants[str(width)] = data
    revision = 'candidate'
    if review is not None:
        if review.get('schemaVersion') != 1:
            raise ValueError('Unknown review schema')
        records = [r for r in review.get('corrections', []) if r.get('id') == exercise]
        if len(records) != 1:
            raise ValueError('Need exactly one review for this exercise')
        record = records[0]
        if record.get('status') != 'accepted-visual' or record.get('sourceSha256') != sha(raw):
            raise ValueError('Candidate has no accepted review bound to its exact bytes')
        if any(record.get('checks', {}).get(key) is not True for key in CHECKS):
            raise ValueError('Every visual check must explicitly pass')
        if record.get('observedLimbs') != dict(arms=2, hands=2, legs=2, feet=2):
            raise ValueError('Ambiguous or unexpected limb count')
        if not record.get('poseNotes') or not record.get('reviewedAt'):
            raise ValueError('Missing individual pose review')
        revision = record.get('revision', '')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', revision):
            raise ValueError('Unsafe revision')
        for width, data in variants.items():
            if record.get('variants', {}).get(width, {}).get('sha256') != sha(data):
                raise ValueError('Final compressed bytes changed after visual review')
    output = Path(output)
    # A preview can never write into the live media tree, even by accident.
    live = Path(__file__).resolve().parents[1] / 'media'
    if review is None and (output.resolve() == live or live in output.resolve().parents):
        raise ValueError('Unreviewed previews cannot enter live media')
    pending = {output / f'{exercise}-{revision}-{width}.webp': data
               for width, data in variants.items()}
    for path, data in pending.items():
        if path.exists() and path.read_bytes() != data:
            raise ValueError('Refusing to overwrite an existing version with different bytes')
    output.mkdir(parents=True, exist_ok=True)
    for path, data in pending.items():
        path.write_bytes(data)
    return {str(path): {'bytes': len(data), 'sha256': sha(data)}
            for path, data in pending.items()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--exercise', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--publish-review', help='Exact accepted JSON receipt; absent means preview only')
    args = parser.parse_args()
    try:
        receipt = json.loads(Path(args.publish_review).read_text()) if args.publish_review else None
        print(json.dumps(prepare(args.input, args.exercise, args.output_dir, receipt), indent=2))
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, str(error) + '\n')
