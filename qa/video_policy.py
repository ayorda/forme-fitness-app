"""Technique-first real-footage gate. Internal review is not trainer certification."""
import math
import re

LEGACY_SHA = 'e23dd1326c87bad75cd78f4ce6ffc9d352047765a24938d436bd1ee38646549b'


def validate_entry(entry):
    assert entry.get('origin', 'filmed') == 'filmed', 'Real footage only'
    license_name = entry['license']
    assert entry['adaptationLicense'] == license_name
    if license_name == 'CC BY-SA 4.0':
        assert entry['licenseUrl'] == 'https://creativecommons.org/licenses/by-sa/4.0/'
    elif license_name == 'Pexels':
        assert entry['licenseUrl'] == 'https://www.pexels.com/license/'
        match = re.fullmatch(r'https://www\.pexels\.com/video/([a-z0-9-]+)-(\d+)/', entry['sourcePage'])
        assert match, 'Canonical public Pexels video page required'
        snapshot = entry['sourceMetadataSnapshot']
        assert str(snapshot['id']) == match[2] and snapshot['slug'] == match[1]
        assert snapshot['license'] == 'Pexels' and snapshot['published'] is True and snapshot['status'] == 'approved'
        assert snapshot['created_at'] and snapshot['author'] == entry['author']
        assert re.fullmatch(r'https://videos\.pexels\.com/video-files/\d+/[a-zA-Z0-9_.-]+\.mp4', entry['sourceFile'])
        assert entry['sourceFile'].split('/')[4] == match[2]
        assert entry['sourceFile'] in [v['link'] for v in snapshot['video_files'] if v['file_type'] == 'video/mp4']
        assert entry['rightsReview']['licenseCheckedOn'] and entry['rightsReview']['useContext'] == 'integrated-instructional-app'
        assert entry['rightsReview']['restrictions'] and entry['rightsReview']['modelRelease']
    else:
        assert license_name == 'Coverr License'
        assert entry['licenseUrl'] == 'https://coverr.co/license'
        assert re.fullmatch(r'https://coverr\.co/videos/[a-z0-9-]+', entry['sourcePage'])
        snapshot = entry['sourceMetadataSnapshot']
        assert snapshot['isAiGenerated'] is False and snapshot['isPremium'] is False
        assert snapshot['slug'] == entry['sourcePage'].rsplit('/', 1)[1]
        assert entry['sourceFile'] in [v['url'] for v in snapshot['defaultVariant']['renditions'] if v['isPlus'] is False]
        assert entry['rightsReview']['licenseCheckedOn'] and entry['rightsReview']['useContext'] == 'integrated-instructional-app'
    assert re.fullmatch(r'[a-f0-9]{64}', entry['sourceSha256'])
    assert entry['sourceMetadata'] and entry['changes']
    poster = entry['poster']
    assert re.fullmatch(r'media/exercise-videos/[a-zA-Z0-9_-]+\.jpg', poster['path'])
    assert poster['sourceVideoSha256'] in [v['sha256'] for v in entry['variants']]
    style = entry['visualStandard']
    if style['status'] == 'legacy-not-accepted':
        assert style['version'] == '1.0'
        assert entry['exerciseId'] == 'Parallel_Bar_Dips'
        assert len(entry['variants']) == 1 and entry['variants'][0]['sha256'] == LEGACY_SHA
        assert entry['sourceMetadataSnapshot']['id'] == 64
        assert entry['variants'][0]['duration'] == 10.5
        assert style['reason'] and style['audit']
        return 'LEGACY — NOT ACCEPTED UNDER CURRENT STANDARD'
    assert style['version'] == '4.1' and style['status'] == 'accepted-internal'
    assert style['comparison'] and style['reviewedOn']
    motion = style['motion']
    assert motion['continuous'] is True and motion['naturalSpeed'] is True
    assert motion['fullMovement'] is True and motion['synthetic'] is False
    review = entry['review']
    for key in ['visualConsistency', 'jointsVisible', 'cameraReadable', 'rightsChecked', 'noAssistance', 'noAddedLoad']:
        assert review[key] is True
    assert review['independentTrainer'] in ['pending', 'accepted']
    assert review['limitations'] and entry['durationReason']
    assert len(entry['variants']) == 1
    for variant in entry['variants']:
        assert variant['path'].endswith('.mp4')
        duration = variant['duration']
        assert type(duration) in [int, float] and math.isfinite(duration) and duration > 0
        assert variant['fps'] == '24/1' and variant['frames'] == round(duration * 24)
        assert abs(duration * 24 - variant['frames']) < .000001
        assert review['framesInspected'] == variant['frames']
        assert variant['audio'] is False
        assert variant['codec'] == 'h264' and variant['pixelFormat'] == 'yuv420p'
    assert entry['trimDuration'] == entry['variants'][0]['duration']
    return 'INTERNAL REVIEW — INDEPENDENT/DEVICE ACCEPTANCE SEPARATE'
