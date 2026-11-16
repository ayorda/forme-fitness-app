"""Rebuild the REJECTED wger65 review study, never an approved catalogue asset.

Usage: python qa/prepare-video-study.py --input original65.MOV --output /tmp/review
This per-source preset is not a colour recipe for other exercises.
"""
import argparse
import colorsys
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def verify_source(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError('Wrong original: source SHA-256 does not match the reviewed file')

def smooth(value):
    value = max(0, min(1, value))
    return value*value*(3-2*value)

def band(hue, low, peak, high):
    return smooth((hue-low)/(peak-low))*smooth((high-hue)/(high-peak))

def write_lut(path):
    with path.open('w') as output:
        output.write('TITLE "FORME wger65 secondary, source-specific, not a global preset"\nLUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for blue in range(33):
            for green in range(33):
                for red in range(33):
                    hue, sat, value = colorsys.rgb_to_hsv(red/32,green/32,blue/32)
                    degrees = hue*360
                    # Secondary ranges avoid the orange skin range (15–45deg).
                    cyan = band(degrees,105,160,205)*smooth((sat-.10)/.30)
                    pink = band(degrees,285,330,352)*smooth((sat-.10)/.30)
                    yellow = band(degrees,48,61,83)*smooth((sat-.15)/.35)
                    red_weight = max(band(degrees,-14,0,14),band(degrees,346,360,374))*smooth((sat-.35)/.35)
                    sat *= 1-.78*cyan-.70*pink-.35*yellow-.40*red_weight
                    value *= 1-.58*cyan-.48*pink-.24*yellow-.15*red_weight
                    rgb = colorsys.hsv_to_rgb(hue,max(0,sat),max(0,value))
                    output.write(' '.join(f'{channel:.7f}' for channel in rgb)+'\n')

def run(args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args],check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args = parser.parse_args()
    study = json.loads((ROOT/'qa/video-style-study.json').read_text())
    verify_source(args.input,study['source']['sha256'])
    target = args.output.resolve()
    if target.is_relative_to(ROOT) and not target.is_relative_to(ROOT/'qa-results'):
        raise ValueError('Unaccepted study output must stay outside the app or in ignored qa-results')
    target.mkdir(parents=True,exist_ok=True)
    prep = study['preparation']
    with tempfile.TemporaryDirectory(prefix='forme-video-study-') as scratch:
        lut = Path(scratch)/'secondary.cube'; write_lut(lut)
        crop = prep['crop']
        filters = f"crop={crop['width']}:{crop['height']}:{crop['x']}:{crop['y']},lut3d=file={lut}:interp=tetrahedral,"+prep['filterAfterLut']
        reference = target/'reference.mkv'
        run(['-ss',str(prep['trimStart']),'-i',str(args.input),'-t',str(prep['duration']),'-vf',filters,'-an','-map_metadata','-1','-c:v','ffv1',str(reference)])
    rows = []
    for crf in [23,26,29]:
        clip = target/f'candidate-c{crf}.mp4'
        run(['-i',str(reference),'-c:v','libx264','-preset','slow','-crf',str(crf),'-profile:v','main','-level','3.1','-pix_fmt','yuv420p','-an','-map_metadata','-1','-movflags','+faststart',str(clip)])
        comparison = subprocess.run(['ffmpeg','-i',str(reference),'-i',str(clip),'-filter_complex','[0:v]settb=1/24,setpts=N[r];[1:v]settb=1/24,setpts=N[c];[r][c]ssim=shortest=1','-f','null','-'],capture_output=True,text=True,check=True)
        (target/f'ssim-c{crf}.log').write_text(comparison.stderr)
        rows.append(dict(crf=crf,bytes=clip.stat().st_size,ssim=float(re.search(r'All:([0-9.]+)',comparison.stderr).group(1)),sha256=hashlib.sha256(clip.read_bytes()).hexdigest()))
    chosen = target/'candidate-c26.mp4'
    run(['-i',str(chosen),'-frames:v','1','-q:v','3','-map_metadata','-1',str(target/'poster.jpg')])
    report = dict(status='REJECTED / REVIEW ONLY / NOT FOR CATALOGUE',sourceSha256=study['source']['sha256'],candidates=rows)
    (target/'quality.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
