import copy
import json
from pathlib import Path
import unittest
import subprocess
import sys
import tempfile
from video_policy import validate_entry

ROOT = Path(__file__).resolve().parents[1]

class VideoReviewGateTests(unittest.TestCase):
    def setUp(self):
        self.entry = json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())['entries'][0]

    def test_existing_clip_is_explicitly_legacy_not_a_premium_pass(self):
        self.assertIn('NOT ACCEPTED',validate_entry(self.entry))

    def test_new_bytes_or_unknown_exercise_cannot_inherit_legacy_exception(self):
        for key in ['bytes','exercise']:
            entry = copy.deepcopy(self.entry)
            if key == 'bytes':
                entry['variants'][0]['sha256'] = 'a'*64
                entry['poster']['sourceVideoSha256'] = 'a'*64
            else:entry['exerciseId'] = 'Other'
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_new_material_requires_review_and_complete_natural_movement(self):
        entry = copy.deepcopy(self.entry)
        entry['visualStandard'] = dict(version='1.0',status='accepted-internal',comparison='qa/evidence/example.jpg',reviewedOn='2026-11-16',motion=dict(continuous=True,naturalSpeed=True,fullMovement=True,synthetic=False))
        entry['variants'][0]['duration'] = 5.5
        self.assertIn('INTERNAL',validate_entry(entry))
        for field in ['continuous','naturalSpeed','fullMovement']:
            broken = copy.deepcopy(entry);broken['visualStandard']['motion'][field] = False
            with self.assertRaises(AssertionError):validate_entry(broken)
        for field in ['comparison','reviewedOn']:
            broken = copy.deepcopy(entry);broken['visualStandard'][field] = ''
            with self.assertRaises(AssertionError):validate_entry(broken)
        entry['visualStandard']['motion']['synthetic'] = True
        with self.assertRaises(AssertionError):validate_entry(entry)

    def test_longer_new_video_requires_specific_duration_reason(self):
        entry = copy.deepcopy(self.entry)
        entry['visualStandard'] = dict(version='1.0',status='accepted-internal',comparison='qa/evidence/example.jpg',reviewedOn='2026-11-16',motion=dict(continuous=True,naturalSpeed=True,fullMovement=True,synthetic=False))
        with self.assertRaises(KeyError):validate_entry(entry)
        entry['durationException'] = 'too short'
        with self.assertRaises(AssertionError):validate_entry(entry)
        entry['durationException'] = 'A complex transition needs the full entry, controlled hold and safe exit at its recorded natural speed.'
        self.assertIn('INTERNAL',validate_entry(entry))

    def test_study_rejects_wrong_source_before_creating_any_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            original=Path(temporary)/'wrong.mov';original.write_bytes(b'not the reviewed original')
            output=Path(temporary)/'output'
            result=subprocess.run([sys.executable,str(ROOT/'qa/prepare-video-study.py'),'--input',str(original),'--output',str(output)],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('source SHA-256 does not match',result.stderr)
            self.assertFalse(output.exists())

if __name__ == '__main__':unittest.main()
