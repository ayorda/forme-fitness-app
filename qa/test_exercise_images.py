"""Adversarial checks for the image publication gate, not AI anatomy tests."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('image_prepare', Path(__file__).with_name('prepare-exercise-image.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class ImageGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source.png'
        Image.new('RGB', (960, 640), '#182020').save(self.source)

    def receipt(self):
        variants = helper.prepare(self.source, 'Handstand', self.root / 'preview')
        return {'schemaVersion': 1, 'corrections': [{
            'id': 'Handstand', 'revision': 'anatomy-v2', 'status': 'accepted-visual',
            'sourceSha256': hashlib.sha256(self.source.read_bytes()).hexdigest(),
            'reviewedAt': '2026-11-17', 'poseNotes': 'Synthetic gate fixture only, not an accepted athlete.',
            'observedLimbs': dict(arms=2, hands=2, legs=2, feet=2),
            'checks': dict.fromkeys(helper.CHECKS, True),
            'variants': {path.split('-')[-1].split('.')[0]: value for path, value in variants.items()}}]}

    def test_preview_cannot_enter_live_media(self):
        with self.assertRaisesRegex(ValueError, 'Unreviewed'):
            helper.prepare(self.source, 'Handstand', Path(__file__).resolve().parents[1] / 'media/exercises')

    def test_changed_source_refused(self):
        receipt = self.receipt()
        Image.new('RGB', (960, 640), '#263838').save(self.source)
        with self.assertRaisesRegex(ValueError, 'exact bytes'):
            helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)

    def test_doubt_about_one_joint_refuses_all_output(self):
        receipt = self.receipt()
        receipt['corrections'][0]['checks']['jointAlignment'] = False
        with self.assertRaisesRegex(ValueError, 'Every visual check'):
            helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)
        self.assertFalse((self.root / 'publish').exists())

    def test_changed_compression_refused(self):
        receipt = self.receipt()
        receipt['corrections'][0]['variants']['480']['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'compressed bytes changed'):
            helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)

    def test_unsafe_id_and_crop_refused(self):
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            helper.prepare(self.source, '../Handstand', self.root / 'preview')
        Image.new('RGB', (1024, 1024)).save(self.source)
        with self.assertRaisesRegex(ValueError, 'uncropped 3:2'):
            helper.prepare(self.source, 'Handstand', self.root / 'preview')

    def test_accepted_exact_receipt_and_idempotent_export(self):
        receipt = self.receipt()
        first = helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)
        self.assertEqual(first, helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt))
        for path in first:
            with Image.open(path) as image:
                self.assertIn(image.size, [(480, 320), (960, 640)])
                self.assertFalse(image.info.get('exif'))
                self.assertFalse(image.info.get('icc_profile'))

    def test_pending_extra_limb_and_duplicate_review_refused(self):
        for mutation in ['pending', 'extra-foot', 'duplicate']:
            receipt = self.receipt()
            if mutation == 'pending':
                receipt['corrections'][0]['status'] = 'pending'
            elif mutation == 'extra-foot':
                receipt['corrections'][0]['observedLimbs']['feet'] = 3
            else:
                receipt['corrections'].append(dict(receipt['corrections'][0]))
            with self.assertRaises(ValueError):
                helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)


if __name__ == '__main__':
    unittest.main()
