import copy
import json
from pathlib import Path
import unittest
import subprocess
import sys
import tempfile
from video_policy import validate_entry

ROOT = Path(__file__).resolve().parents[1]

def ai_fixture():
    return dict(origin='ai-image-to-video',exerciseId='Parallel_Bar_Dips',license='Higgsfield Terms of Use',licenseUrl='https://higgsfield.ai/terms-of-use-agreement',sourceSha256='a'*64,changes='Synthetic test fixture only',generator=dict(model='wan3_0',resolution='720p',duration=5,generate_audio=False,jobId='00000000-0000-0000-0000-000000000000'),referenceImage=dict(path='media/exercises/Parallel_Bar_Dips-960.webp',sha256='b'*64),visualStandard=dict(version='2.0',status='accepted-internal',comparison='qa/evidence/test.jpg',reviewedOn='2026-11-16'),review=dict(framesInspected=120,visualConsistency=True,anatomyAccepted=True,equipmentStable=True,fullMovement=True,naturalSpeed=True,addedText=False,independentTrainer='pending'),transparency=dict(disclosureKey='exercises.videoGenerated',providerMarkingsRemoved=False),variants=[dict(path='media/exercise-videos/test-ai.mp4',duration=5,fps='24/1',frames=120,audio=False,codec='h264',pixelFormat='yuv420p',sha256='c'*64)],poster=dict(path='media/exercise-videos/test-ai-poster.jpg',sourceVideoSha256='c'*64))

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

    def test_ai_contract_is_distinct_from_stock_and_requires_selected_wan720(self):
        entry=ai_fixture();self.assertIn('AI INTERNAL',validate_entry(entry))
        for key,value in [('model','seedance_2_5'),('resolution','1080p'),('generate_audio',True)]:
            broken=copy.deepcopy(entry);broken['generator'][key]=value
            with self.assertRaises(AssertionError):validate_entry(broken)
        entry['license']='CC BY-SA 4.0'
        with self.assertRaises(AssertionError):validate_entry(entry)

    def test_ai_requires_exactly_five_seconds_and_120_frames_without_exceptions(self):
        for key,value in [('duration',5.5),('frames',150),('fps','30/1'),('audio',True)]:
            entry=ai_fixture();entry['variants'][0][key]=value;entry['durationException']='No duration exception is permitted for the AI demonstration series.'
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_ai_rejects_incomplete_review_and_changed_equipment(self):
        for key,value in [('framesInspected',119),('visualConsistency',False),('anatomyAccepted',False),('equipmentStable',False),('fullMovement',False),('naturalSpeed',False),('addedText',True)]:
            entry=ai_fixture();entry['review'][key]=value
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_ai_requires_disclosure_and_retains_provider_markings(self):
        for key,value in [('disclosureKey','hidden-in-menu'),('providerMarkingsRemoved',True)]:
            entry=ai_fixture();entry['transparency'][key]=value
            with self.assertRaises(AssertionError):validate_entry(entry)
        entry=ai_fixture();entry['visualStandard']['status']='pending'
        with self.assertRaises(AssertionError):validate_entry(entry)

    def test_ai_preparation_refuses_wrong_original_before_creating_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            original=Path(temporary)/'wrong.mp4';original.write_bytes(b'not a reviewed generator output')
            output=Path(temporary)/'output'
            result=subprocess.run([sys.executable,str(ROOT/'qa/prepare-ai-video.py'),'--input',str(original),'--source-sha256','a'*64,'--output',str(output)],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn('Source SHA-256 does not match',result.stderr);self.assertFalse(output.exists())

    def test_transcoding_preserves_provider_tag_and_120_frame_timeline(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            original=Path(temporary)/'synthetic-qa.mp4';output=Path(temporary)/'review'
            marker='{"Label":"1","ContentProducer":"LOCAL-QA-ONLY"}'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=0x121717:s=960x720:r=30:d=5','-an','-c:v','libx264','-pix_fmt','yuv420p','-metadata','AIGC='+marker,'-movflags','+faststart+use_metadata_tags',str(original)],check=True,capture_output=True)
            sha=hashlib.sha256(original.read_bytes()).hexdigest()
            subprocess.run([sys.executable,str(ROOT/'qa/prepare-ai-video.py'),'--input',str(original),'--source-sha256',sha,'--output',str(output)],check=True,capture_output=True)
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(),sha)
            report=json.loads((output/'quality.json').read_text());self.assertEqual(len(report['candidates']),3)
            for candidate in report['candidates']:
                self.assertEqual((candidate['duration'],candidate['frames'],candidate['fps']),(5,120,'24/1'))
                probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(output/f"candidate-c{candidate['crf']}.mp4")]))
                self.assertEqual(probe['format']['tags']['AIGC'],marker)

if __name__ == '__main__':unittest.main()
