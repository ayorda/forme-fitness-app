"""Repository review gate, not a technique certificate or a copyright guarantee."""
import re

LEGACY_SHA = 'e23dd1326c87bad75cd78f4ce6ffc9d352047765a24938d436bd1ee38646549b'

def validate_ai_entry(entry):
    """Owner-selected WAN contract. Recorded review is not independent certification."""
    assert entry['origin'] == 'ai-image-to-video'
    assert entry['license'] == 'Higgsfield Terms of Use'
    assert entry['licenseUrl'] == 'https://higgsfield.ai/terms-of-use-agreement'
    assert entry['generator']['model'] == 'wan3_0'
    assert entry['generator']['resolution'] == '720p'
    assert entry['generator']['duration'] == 5
    assert entry['generator']['generate_audio'] is False
    assert re.fullmatch(r'[a-f0-9-]{36}',entry['generator']['jobId'])
    reference = entry['referenceImage']
    assert reference['path'] == 'media/exercises/'+entry['exerciseId']+'-960.webp'
    assert re.fullmatch(r'[a-f0-9]{64}',reference['sha256'])
    assert re.fullmatch(r'[a-f0-9]{64}',entry['sourceSha256'])
    assert entry['changes']
    style = entry['visualStandard']
    assert style['version'] == '2.0' and style['status'] == 'accepted-internal'
    assert style['comparison'] and style['reviewedOn']
    review = entry['review']
    assert review['framesInspected'] == 120
    for key in ['visualConsistency','anatomyAccepted','equipmentStable','fullMovement','naturalSpeed']:
        assert review[key] is True
    assert review['addedText'] is False
    assert review['independentTrainer'] in ['pending','accepted']
    assert entry['transparency']['disclosureKey'] == 'exercises.videoGenerated'
    assert entry['transparency']['providerMarkingsRemoved'] is False
    assert len(entry['variants']) == 1
    for variant in entry['variants']:
        assert variant['path'].endswith('.mp4')
        assert variant['duration'] == 5 and variant['fps'] == '24/1'
        assert variant['frames'] == 120 and variant['audio'] is False
        assert variant['codec'] == 'h264' and variant['pixelFormat'] == 'yuv420p'
    poster = entry['poster']
    assert re.fullmatch(r'media/exercise-videos/[a-zA-Z0-9_-]+\.jpg',poster['path'])
    assert poster['sourceVideoSha256'] == entry['variants'][0]['sha256']
    return 'AI INTERNAL REVIEW — INDEPENDENT/DEVICE ACCEPTANCE SEPARATE'

def validate_entry(entry):
    if entry.get('origin') == 'ai-image-to-video':
        return validate_ai_entry(entry)
    assert entry['license'] == entry['adaptationLicense'] == 'CC BY-SA 4.0'
    assert entry['licenseUrl'] == 'https://creativecommons.org/licenses/by-sa/4.0/'
    assert entry['sourceSha256'] and entry['sourceMetadata'] and entry['changes']
    poster = entry['poster']
    assert re.fullmatch(r'media/exercise-videos/[a-zA-Z0-9_-]+\.jpg',poster['path'])
    assert poster['sourceVideoSha256'] in [v['sha256'] for v in entry['variants']]
    style = entry['visualStandard']
    assert style['version'] == '1.0'
    if style['status'] == 'legacy-not-accepted':
        # Exactly the already-published video may remain playable while the
        # replacement is blocked. New bytes can never inherit this exception.
        assert entry['exerciseId'] == 'Parallel_Bar_Dips'
        assert len(entry['variants']) == 1 and entry['variants'][0]['sha256'] == LEGACY_SHA
        assert entry['sourceMetadataSnapshot']['id'] == 64
        assert entry['variants'][0]['duration'] == 10.5
        assert style['reason'] and style['audit']
        return 'LEGACY — NOT ACCEPTED UNDER STYLE GUIDE'
    assert style['status'] == 'accepted-internal'
    assert style['comparison'] and style['reviewedOn']
    motion = style['motion']
    assert motion['continuous'] is True and motion['naturalSpeed'] is True
    assert motion['fullMovement'] is True and motion['synthetic'] is False
    for variant in entry['variants']:
        if not 5 <= variant['duration'] <= 6:
            exception = entry['durationException']
            assert isinstance(exception,str) and len(exception.strip()) >= 40
    return 'INTERNAL REVIEW — INDEPENDENT/DEVICE ACCEPTANCE SEPARATE'
