import copy
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from video_policy import validate_entry

ROOT = Path(__file__).resolve().parents[1]
prepare = runpy.run_path(str(ROOT/'qa/prepare-real-video.py'))['prepare']


def real_fixture():
    entry = json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())['entries'][0]
    entry['origin'] = 'filmed'
    entry['visualStandard'] = dict(version='4.0',status='accepted-internal',comparison='qa/evidence/test.jpg',reviewedOn='2026-11-16',motion=dict(continuous=True,naturalSpeed=True,fullMovement=True,synthetic=False))
    entry['review'].update(visualConsistency=True,jointsVisible=True,stableCamera=True,rightsChecked=True,framesInspected=120,independentTrainer='pending')
    entry['variants'][0].update(duration=5,frames=120)
    return entry


class VideoReviewGateTests(unittest.TestCase):
    def test_existing_clip_is_explicitly_legacy_not_a_premium_pass(self):
        entry=json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())['entries'][0]
        self.assertIn('NOT ACCEPTED',validate_entry(entry))

    def test_new_bytes_or_unknown_exercise_cannot_inherit_legacy_exception(self):
        for key in ['bytes','exercise','duration']:
            entry=json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())['entries'][0]
            if key=='bytes':
                entry['variants'][0]['sha256']='a'*64
                entry['poster']['sourceVideoSha256']='a'*64
            elif key=='exercise':entry['exerciseId']='Other'
            else:entry['variants'][0]['duration']=5
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_real_contract_requires_full_continuous_natural_movement(self):
        entry=real_fixture();self.assertIn('V4.0 INTERNAL',validate_entry(entry))
        for key,value in [('continuous',False),('naturalSpeed',False),('fullMovement',False),('synthetic',True)]:
            broken=copy.deepcopy(entry);broken['visualStandard']['motion'][key]=value
            with self.assertRaises(AssertionError):validate_entry(broken)

    def test_exact_five_seconds_120_frames_silent_h264_contract(self):
        for key,value in [('duration',4.99),('duration',5.5),('duration',6),('frames',119),('fps','30/1'),('audio',True),('codec','vp9'),('pixelFormat','yuv444p'),('path','media/exercise-videos/test.webm')]:
            entry=real_fixture();entry['variants'][0][key]=value
            entry['durationException']='Old broad exceptions must not bypass the exact v4.0 contract.'
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_ai_or_unknown_origin_cannot_pass_even_with_real_licence(self):
        for origin in ['ai-image-to-video','wan3_0','unknown','animation']:
            entry=real_fixture();entry['origin']=origin
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_visual_rights_and_complete_frame_review_are_required(self):
        for key,value in [('visualConsistency',False),('jointsVisible',False),('stableCamera',False),('rightsChecked',False),('framesInspected',119),('independentTrainer','certified-by-code'),('limitations','')]:
            entry=real_fixture();entry['review'][key]=value
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_unreviewed_or_outdated_style_cannot_pass(self):
        for key,value in [('status','pending'),('version','2.0'),('comparison',''),('reviewedOn','')]:
            entry=real_fixture();entry['visualStandard'][key]=value
            with self.assertRaises(AssertionError):validate_entry(entry)

    def test_unverified_licence_or_wrong_poster_source_cannot_pass(self):
        for key,value in [('license','Free'),('adaptationLicense','CC0'),('licenseUrl','https://example.test'),('sourceSha256','not-a-sha')]:
            entry=real_fixture();entry[key]=value
            with self.assertRaises(AssertionError):validate_entry(entry)
        entry=real_fixture();entry['poster']['sourceVideoSha256']='a'*64
        with self.assertRaises(AssertionError):validate_entry(entry)

    def test_owner_policy_has_no_generator_or_bulk_authorization(self):
        policy=json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())['productionPolicy']
        self.assertEqual((policy['version'],policy['origin'],policy['tool']),('4.0','filmed','FFmpeg'))
        self.assertIs(policy['aiGenerationAllowed'],False)
        self.assertEqual((policy['duration'],policy['fps'],policy['frames']),(5,'24/1',120))
        self.assertIn('Parallel_Bar_Dips only',policy['scope'])


class RealPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary=tempfile.TemporaryDirectory();cls.base=Path(cls.temporary.name)
        cls.original=cls.base/'synthetic-qa-pattern-not-exercise.mp4'
        subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','testsrc2=s=96x64:r=30:d=7','-f','lavfi','-i','sine=duration=7','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(cls.original)],check=True,capture_output=True)
        cls.plan=dict(sourceSha256=hashlib.sha256(cls.original.read_bytes()).hexdigest(),sourcePage='https://example.test/local-qa-only',licenseUrl='https://example.test/local-qa-only',origin='filmed',trimStart=1,maxEdge=480)

    @classmethod
    def tearDownClass(cls):cls.temporary.cleanup()

    def test_wrong_source_or_ai_declaration_refused_before_output(self):
        for key,value in [('sourceSha256','a'*64),('origin','ai-image-to-video')]:
            plan={**self.plan,key:value};output=self.base/('bad-'+key)
            with self.assertRaises(ValueError):prepare(self.original,plan,output)
            self.assertFalse(output.exists())

    def test_missing_interval_and_unsafe_crop_or_grade_refused_before_output(self):
        for i,change in enumerate([dict(trimStart=3),dict(trimStart=-1),dict(trimStart=float('nan')),dict(trimStart=True),dict(maxEdge=4096),dict(crop=dict(x=0,y=0,width=100,height=64)),dict(grade=dict(saturation=.1)),dict(grade=dict(gamma=float('inf'))),dict(filters='reverse'),dict(sourcePage='javascript:alert(1)')]):
            output=self.base/f'invalid-{i}'
            with self.assertRaises(ValueError):prepare(self.original,{**self.plan,**change},output)
            self.assertFalse(output.exists())

    def test_catalogue_output_is_refused_before_directory_creation(self):
        output=ROOT/'media/exercise-videos/never-create-this-review'
        with self.assertRaises(ValueError):prepare(self.original,self.plan,output)
        self.assertFalse(output.exists())

    def test_ai_marked_original_is_refused_without_stripping_signal(self):
        marked=self.base/'ai-marked-qa.mp4'
        subprocess.run(['ffmpeg','-v','error','-i',str(self.original),'-c','copy','-metadata','AIGC=LOCAL-QA-ONLY','-movflags','+use_metadata_tags',str(marked)],check=True,capture_output=True)
        plan={**self.plan,'sourceSha256':hashlib.sha256(marked.read_bytes()).hexdigest()};output=self.base/'ai-marked-output'
        with self.assertRaisesRegex(ValueError,'AI-marked'):prepare(marked,plan,output)
        self.assertFalse(output.exists())

    def test_actual_transcoding_is_exact_silent_faststart_and_never_accepted(self):
        output=self.base/'valid-review';report=prepare(self.original,self.plan,output)
        self.assertEqual(hashlib.sha256(self.original.read_bytes()).hexdigest(),self.plan['sourceSha256'])
        self.assertIs(report['accepted'],False);self.assertEqual(len(report['candidates']),3)
        for candidate in report['candidates']:
            self.assertEqual((candidate['duration'],candidate['frames'],candidate['fps']),(5,120,'24/1'))
            self.assertEqual((candidate['codec'],candidate['pixelFormat'],candidate['audio'],candidate['faststart']),('h264','yuv420p',False,True))
            self.assertGreater(candidate['ssim'],.9)
            self.assertTrue((output/f"poster-c{candidate['crf']}.jpg").exists())
        with self.assertRaises(FileExistsError):prepare(self.original,self.plan,output)

    def test_phone_rotation_preserves_display_aspect_ratio(self):
        rotated=self.base/'rotated-qa.mp4'
        options=subprocess.check_output(['ffmpeg','-hide_banner','-h','full'],stderr=subprocess.DEVNULL,text=True)
        before=['-display_rotation','90'] if '-display_rotation' in options else []
        after=[] if before else ['-metadata:s:v:0','rotate=90']
        subprocess.run(['ffmpeg','-v','error',*before,'-i',str(self.original),'-c','copy',*after,str(rotated)],check=True,capture_output=True)
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(rotated)]))
        self.assertTrue(any(abs(side.get('rotation',0))==90 for side in probe['streams'][0].get('side_data_list',[])))
        plan={**self.plan,'sourceSha256':hashlib.sha256(rotated.read_bytes()).hexdigest()}
        report=prepare(rotated,plan,self.base/'rotated-review')
        for candidate in report['candidates']:
            self.assertEqual((candidate['width'],candidate['height']),(64,96))
            self.assertEqual((candidate['duration'],candidate['frames']),(5,120))


if __name__=='__main__':unittest.main()
