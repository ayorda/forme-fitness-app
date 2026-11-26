"""Adversarial checks for the image publication gate, not AI anatomy tests."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
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
        policy = next(p for p in json.loads((helper.ROOT / 'qa/exercise-image-contracts.json').read_text())['exercises'] if p['id'] == 'Handstand')
        return {'schemaVersion': 2, 'corrections': [{
            'id': 'Handstand', 'revision': 'anatomy-v3', 'status': 'accepted-visual',
            'sourceSha256': hashlib.sha256(self.source.read_bytes()).hexdigest(),
            'reviewedAt': '2026-11-17', 'poseNotes': 'Synthetic gate fixture only, not an accepted athlete.',
            'observedLimbs': dict(arms=2, hands=2, legs=2, feet=2),
            'checks': dict.fromkeys(helper.CHECKS, True),
            'reviewedVariants': ['source', '480', '960'],
            'anatomy': {'status': 'accepted', 'notes': 'Synthetic test receipt, not a real anatomy decision.'},
            'style': {'status': 'accepted', 'notes': 'Synthetic test receipt, not a real style decision.'},
            'exactMatch': {'status': 'accepted', 'catalogue': policy['catalogue'], 'phase': policy['phase'],
                           'observedEquipment': policy['catalogue']['equip'],
                           'criteria': {k: {'passed': True, 'observation': 'Synthetic observation for gate validation only.'} for k in policy['requiredVisible']}},
            'variants': {path.split('-')[-1].split('.')[0]: value for path, value in variants.items()}}]}

    def test_preview_cannot_enter_live_media(self):
        with self.assertRaisesRegex(ValueError, 'Unreviewed'):
            helper.prepare(self.source, 'Handstand', Path(__file__).resolve().parents[1] / 'media/exercises')

    def test_retired_exercise_cannot_be_republished_from_a_receipt(self):
        receipt = self.receipt()
        with self.assertRaisesRegex(ValueError, 'Retired exercise'):
            helper.prepare(self.source, 'Handstand_Pushups', self.root / 'publish', receipt)
        self.assertFalse((self.root / 'publish').exists())

    def test_higgsfield_revision_requires_bound_reference_and_all_style_comparisons(self):
        receipt = self.receipt()
        record = receipt['corrections'][0]
        record['revision'] = 'higgsfield-v4'
        record['oldDesktopSha256'] = 'a' * 64
        record['generation'] = dict(platform='Higgsfield', model='gpt_image_2_6', status='completed', jobId='12345678-1234-1234-1234-123456789abc', referenceSha256='a' * 64)
        record['styleLock'] = dict(status='accepted', referenceSha256='a' * 64, criteria={k: dict(passed=True, observation='Synthetic comparison observation; no real image acceptance.') for k in ['background', 'composition', 'colorLighting', 'materials']})
        helper.prepare(self.source, 'Handstand', self.root / 'higgsfield', receipt)
        record['styleLock']['referenceSha256'] = 'b' * 64
        with self.assertRaisesRegex(ValueError, 'exact previous reference'):
            helper.prepare(self.source, 'Handstand', self.root / 'refused', receipt)
        record['styleLock']['referenceSha256'] = 'a' * 64
        record['styleLock']['criteria']['background']['passed'] = False
        with self.assertRaisesRegex(ValueError, 'style-lock criterion'):
            helper.prepare(self.source, 'Handstand', self.root / 'refused', receipt)
        record['styleLock']['criteria']['background']['passed'] = True
        record['generation']['status'] = 'pending'
        with self.assertRaisesRegex(ValueError, 'job provenance'):
            helper.prepare(self.source, 'Handstand', self.root / 'refused', receipt)
        self.assertFalse((self.root / 'refused').exists())

    def test_higgsfield_revision_refuses_missing_or_mismatched_generation(self):
        receipt = self.receipt()
        record = receipt['corrections'][0]
        record['revision'] = 'higgsfield-v4'
        record['oldDesktopSha256'] = 'a' * 64
        record['styleLock'] = dict(status='accepted', referenceSha256='a' * 64, criteria={k: dict(passed=True, observation='Synthetic comparison observation; no real image acceptance.') for k in ['background', 'composition', 'colorLighting', 'materials']})
        with self.assertRaisesRegex(ValueError, 'job provenance'):
            helper.prepare(self.source, 'Handstand', self.root / 'refused', receipt)
        record['generation'] = dict(platform='Higgsfield', model='gpt_image_2_6', status='completed', jobId='12345678-1234-1234-1234-123456789abc', referenceSha256='b' * 64)
        with self.assertRaisesRegex(ValueError, 'same reference'):
            helper.prepare(self.source, 'Handstand', self.root / 'refused', receipt)

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

    def test_legacy_checkbox_only_receipt_refused(self):
        receipt = self.receipt()
        receipt['schemaVersion'] = 1
        with self.assertRaisesRegex(ValueError, 'strict schema 2'):
            helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)

    def test_wrong_phase_equipment_or_category_refused(self):
        for mutation in ['phase', 'equipment', 'style']:
            receipt = self.receipt()
            record = receipt['corrections'][0]
            if mutation == 'phase':
                record['exactMatch']['phase'] = 'wall-pike-pushup'
            elif mutation == 'equipment':
                record['exactMatch']['observedEquipment'] = 'parallettes'
            else:
                record['style']['status'] = 'pending'
            with self.assertRaises(ValueError):
                helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)

    def test_missing_failed_or_foreign_pose_criterion_refused(self):
        for mutation in ['missing', 'failed', 'foreign']:
            receipt = self.receipt()
            criteria = receipt['corrections'][0]['exactMatch']['criteria']
            if mutation == 'missing':
                criteria.pop('verticalStack')
            elif mutation == 'failed':
                criteria['verticalStack']['passed'] = False
            else:
                criteria['highStraightLegs'] = dict(passed=True, observation='Foreign toes-to-bar observation cannot approve a handstand.')
            with self.assertRaises(ValueError):
                helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)

    def test_actual_catalogue_change_invalidates_old_review(self):
        receipt = self.receipt()
        changed = dict(receipt['corrections'][0]['exactMatch']['catalogue'], equip='none')
        with patch.object(helper, 'catalogue_record', return_value=changed):
            with self.assertRaisesRegex(ValueError, 'Catalogue changed'):
                helper.prepare(self.source, 'Handstand', self.root / 'publish', receipt)


if __name__ == '__main__':
    unittest.main()
