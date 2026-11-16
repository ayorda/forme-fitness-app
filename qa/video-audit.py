"""Read-only audit of the exact shipped clips; ffprobe is required (free FFmpeg)."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from video_policy import validate_entry

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())
for entry in manifest['entries']:
    print(entry['exerciseId'],validate_entry(entry))
    poster = entry['poster']; image = (ROOT/poster['path']).read_bytes()
    assert len(image) == poster['bytes'] < 150000
    assert image.startswith(b'\xff\xd8')
    assert hashlib.sha256(image).hexdigest() == poster['sha256']
    poster_probe = json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-of','json',str(ROOT/poster['path'])]))['streams'][0]
    assert poster_probe['width'] == poster['width'] and poster_probe['height'] == poster['height']
    for variant in entry['variants']:
        path = ROOT/variant['path']
        data = path.read_bytes()
        assert len(data) == variant['bytes'] < 1024*1024
        assert hashlib.sha256(data).hexdigest() == variant['sha256']
        probe = json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(path)]))
        assert len(probe['streams']) == 1, 'No audio or private metadata streams'
        stream = probe['streams'][0]
        for actual, expected in [('codec_name','codec'),('width','width'),('height','height'),('pix_fmt','pixelFormat'),('avg_frame_rate','fps')]:
            assert stream[actual] == variant[expected], (path, actual)
        assert abs(float(probe['format']['duration']) - variant['duration']) < .02
        if path.suffix == '.mp4':
            boxes, offset = [], 0
            while offset < len(data):
                length, kind = struct.unpack_from('>I4s',data,offset)
                assert length >= 8
                boxes.append(kind); offset += length
            assert offset == len(data)
            assert boxes.index(b'moov') < boxes.index(b'mdat'), 'MP4 must have faststart'
        print(variant['path'], variant['codec'], variant['duration'], len(data), 'PASS')
