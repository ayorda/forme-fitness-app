"""v4.0 real-footage acceptance gate, not a technique or copyright certificate."""
import re

LEGACY_SHA = 'e23dd1326c87bad75cd78f4ce6ffc9d352047765a24938d436bd1ee38646549b'


def validate_entry(entry):
    # The owner's v4.0 decision retires AI acceptance, including old WAN metadata.
    assert entry.get('origin', 'filmed') == 'filmed', 'v4.0 accepts real footage only'
    assert entry['license'] == entry['adaptationLicense'] == 'CC BY-SA 4.0'
    assert entry['licenseUrl'] == 'https://creativecommons.org/licenses/by-sa/4.0/'
    # Further licences need their own verified contract before catalogue delivery.
    assert re.fullmatch(r'[a-f0-9]{64}', entry['sourceSha256'])
    assert entry['sourceMetadata'] and entry['changes']
    poster = entry['poster']
    assert re.fullmatch(r'media/exercise-videos/[a-zA-Z0-9_-]+\.jpg', poster['path'])
    assert poster['sourceVideoSha256'] in [v['sha256'] for v in entry['variants']]
    style = entry['visualStandard']
    if style['status'] == 'legacy-not-accepted':
        # Preserve only the exact working old clip, never new noncompliant bytes.
        assert style['version'] == '1.0'
        assert entry['exerciseId'] == 'Parallel_Bar_Dips'
        assert len(entry['variants']) == 1 and entry['variants'][0]['sha256'] == LEGACY_SHA
        assert entry['sourceMetadataSnapshot']['id'] == 64
        assert entry['variants'][0]['duration'] == 10.5
        assert style['reason'] and style['audit']
        return 'LEGACY — NOT ACCEPTED UNDER V4.0'
    assert style['version'] == '4.0' and style['status'] == 'accepted-internal'
    assert style['comparison'] and style['reviewedOn']
    motion = style['motion']
    assert motion['continuous'] is True and motion['naturalSpeed'] is True
    assert motion['fullMovement'] is True and motion['synthetic'] is False
    review = entry['review']
    for key in ['visualConsistency', 'jointsVisible', 'stableCamera', 'rightsChecked']:
        assert review[key] is True
    assert review['framesInspected'] == 120
    assert review['independentTrainer'] in ['pending', 'accepted']
    assert review['limitations']
    assert len(entry['variants']) == 1
    for variant in entry['variants']:
        assert variant['path'].endswith('.mp4')
        assert variant['duration'] == 5 and variant['fps'] == '24/1'
        assert variant['frames'] == 120 and variant['audio'] is False
        assert variant['codec'] == 'h264' and variant['pixelFormat'] == 'yuv420p'
    return 'V4.0 INTERNAL REVIEW — INDEPENDENT/DEVICE ACCEPTANCE SEPARATE'
