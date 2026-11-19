"""Synthesise one line with Kokoro (through kokoro-onnx) and write a WAV file.

Run by kokoro.ts with uv, which supplies kokoro-onnx and soundfile. Nothing here touches the network:
the model and the voices are read from the files given.

usage: kokoro_tts.py <model.onnx> <voices.bin> <out.wav> <voice> <speed> <lang>   (the text comes on stdin)
"""

import sys

import soundfile as sf
from kokoro_onnx import Kokoro

model, voices, out, voice, speed, lang = sys.argv[1:7]
text = sys.stdin.read().strip()
kokoro = Kokoro(model, voices)
if voice not in kokoro.get_voices():
    sys.exit(f"unknown voice {voice!r}; some of the {len(kokoro.get_voices())} voices: {', '.join(sorted(kokoro.get_voices())[:12])}")
samples, rate = kokoro.create(text, voice=voice, speed=float(speed), lang=lang)
sf.write(out, samples, rate)
