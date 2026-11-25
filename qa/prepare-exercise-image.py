"""Prepare 3:2 WebP previews; publishing requires an exact, explicit visual review.

This enforces a review receipt, not an automatic anatomy detector. Originals and
rejected candidates belong outside the application repository.
"""
import argparse
import hashlib
import io
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

CHECKS = ('singleAthlete', 'limbCount', 'limbContinuity', 'jointAlignment',
          'exercisePose', 'equipmentContact', 'fullBodyMargins',
          'styleConsistency', 'mobileReadability')
ROOT = Path(__file__).resolve().parents[1]


def catalogue_record(exercise):
    """Read the actual application fields; never trust a receipt's own label."""
    script = """const fs=require('fs'),vm=require('vm');
const c={window:{FORME_EXERCISE_ART:{url:()=> 'fixture'}}};vm.createContext(c);
vm.runInContext(fs.readFileSync('data.js','utf8'),c);
const e=c.window.FORME_DATA.exercises.find(e=>e.id===process.argv[1]);
if(!e)process.exit(2);
console.log(JSON.stringify(Object.fromEntries(['id','name','level','equip','description','steps','easier','defaultMetric'].map(k=>[k,e[k]]))));"""
    return json.loads(subprocess.check_output(['node', '-e', script, exercise], cwd=ROOT))


def validate_exact_match(record, exercise):
    policy = json.loads((ROOT / 'qa/exercise-image-contracts.json').read_text())
    policies = [r for r in policy['exercises'] if r['id'] == exercise]
    if len(policies) != 1:
        raise ValueError('Need an explicit exercise-specific pose contract')
    policy = policies[0]
    current = catalogue_record(exercise)
    exact = record.get('exactMatch', {})
    if policy['catalogue'] != current or exact.get('catalogue') != current:
        raise ValueError('Catalogue changed or wrong exercise/progression receipt')
    if exact.get('phase') != policy['phase'] or exact.get('observedEquipment') != current['equip']:
        raise ValueError('Wrong depicted phase or equipment')
    for category in ['anatomy', 'exactMatch', 'style']:
        if record.get(category, {}).get('status') != 'accepted':
            raise ValueError('Anatomy, exact exercise and style must each be accepted')
    for category in ['anatomy', 'style']:
        if len(record[category].get('notes', '').strip()) < 30:
            raise ValueError('Missing individual category observations')
    criteria = exact.get('criteria', {})
    if set(criteria) != set(policy['requiredVisible']):
        raise ValueError('Missing or foreign exercise-specific visible criteria')
    if any(c.get('passed') is not True or len(c.get('observation', '').strip()) < 20
           for c in criteria.values()):
        raise ValueError('Every exact exercise criterion needs a passing visual observation')
    if set(record.get('reviewedVariants', [])) != {'source', '480', '960'}:
        raise ValueError('Source and both compressed sizes must be reviewed')
    if record.get('revision') == 'higgsfield-v4':
        lock = record.get('styleLock', {})
        if lock.get('referenceSha256') != record.get('oldDesktopSha256') or not re.fullmatch(r'[a-f0-9]{64}', lock.get('referenceSha256', '')):
            raise ValueError('Style lock must bind the exact previous reference')
        if lock.get('status') != 'accepted' or set(lock.get('criteria', {})) != {'background', 'composition', 'colorLighting', 'materials'}:
            raise ValueError('Need separate background, composition, color and material review')
        if any(c.get('passed') is not True or len(c.get('observation', '').strip()) < 30 for c in lock['criteria'].values()):
            raise ValueError('Every style-lock criterion needs a passing comparison observation')
        gen = record.get('generation', {})
        if gen.get('platform') != 'Higgsfield' or gen.get('model') != 'gpt_image_2_6' or gen.get('status') != 'completed' or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', gen.get('jobId', '')):
            raise ValueError('Need confirmed Higgsfield model and job provenance')
        if gen.get('referenceSha256') != lock['referenceSha256']:
            raise ValueError('Generation and visual review must use the same reference')


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
        if review.get('schemaVersion') != 2:
            raise ValueError('Need strict schema 2 with separate anatomy/exercise/style decisions')
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
        validate_exact_match(record, exercise)
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
