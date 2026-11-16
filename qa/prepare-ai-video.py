"""Prepare WAN 3.0 candidates for REVIEW, never automatic catalogue approval.

Keep the provider's AIGC metadata. Do not silently discard signed C2PA data.
Requires free FFmpeg/ffprobe. Input remains unchanged; output stays outside app.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_format','-show_streams','-of','json',str(path)]))

def run(*args):
    return subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',*map(str,args)],check=True,capture_output=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--source-sha256',required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();raw=args.input.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=args.source_sha256:
        raise ValueError('Source SHA-256 does not match; no output created')
    out=args.output.resolve()
    if out.is_relative_to(ROOT) and not out.is_relative_to(ROOT/'qa-results'):
        raise ValueError('Review output must stay outside the shipped app')
    original=probe(args.input);streams=original['streams']
    if len(streams)!=1 or streams[0]['codec_type']!='video':
        raise ValueError('Expected one silent video stream from the requested generator')
    if abs(float(original['format']['duration'])-5)>0.000001:
        raise ValueError('Generator did not deliver exactly five seconds; do not trim a missing movement phase')
    if b'c2pa' in raw.lower() or b'jumb' in raw:
        raise ValueError('Signed provenance detected: a preservation-aware workflow is required before transcoding')
    tags=original['format'].get('tags',{})
    provider_tags={k:v for k,v in tags.items() if k.lower() in ['aigc','c2pa','contentcredentials']}
    out.mkdir(parents=True,exist_ok=True)
    width=round(streams[0]['width']*720/streams[0]['height']/2)*2
    filters=f'scale={width}:720:flags=lanczos,fps=24,format=yuv420p'
    reference=out/'reference.mkv'
    run('-i',args.input,'-map','0:v:0','-vf',filters,'-c:v','ffv1','-an',reference)
    candidates=[]
    for crf in [23,26,29]:
        target=out/f'candidate-c{crf}.mp4'
        run('-i',args.input,'-map','0:v:0','-vf',filters,'-c:v','libx264','-preset','slow','-crf',crf,'-profile:v','main','-level','3.1','-pix_fmt','yuv420p','-an','-map_metadata','0','-map_chapters','-1','-movflags','+faststart+use_metadata_tags',target)
        result=probe(target);v=result['streams'][0];copied=result['format'].get('tags',{})
        assert int(v['nb_read_frames'])==120 and v['avg_frame_rate']=='24/1'
        assert abs(float(result['format']['duration'])-5)<0.000001
        assert all(copied.get(k)==value for k,value in provider_tags.items()),'Provider metadata must survive byte-for-byte'
        metric=subprocess.run(['ffmpeg','-hide_banner','-i',str(reference),'-i',str(target),'-filter_complex','[0:v]settb=1/24,setpts=N[r];[1:v]settb=1/24,setpts=N[c];[r][c]ssim=shortest=1','-f','null','-'],capture_output=True,text=True,check=True)
        score=float(re.search(r'All:([0-9.]+)',metric.stderr).group(1))
        candidates.append(dict(crf=crf,bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),ssim=score,width=width,height=720,fps='24/1',frames=120,duration=5,providerTagsPreserved=list(provider_tags)))
    report=dict(status='GENERATED CANDIDATES — VISUAL/TECHNIQUE APPROVAL REQUIRED',sourceSha256=args.source_sha256,sourceBytes=len(raw),sourceProbe=original,filter=filters,candidates=candidates)
    (out/'quality.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(dict(status=report['status'],candidates=candidates)))

if __name__=='__main__':main()
