# Narración con Piper (voz neuronal que corre en local): voz "daniela", español de Argentina.
# Requiere: pip install piper-tts. La primera vez descarga la voz (~110 MB) a promo/voices/.
# Licencia de la voz: dataset OpenSLR 61 (CC BY-SA 4.0) → uso comercial permitido citando la fuente.
import subprocess
import sys
import urllib.request
from pathlib import Path

LINES = {
    'v1': '¿Quieres ganar veinte mil pesos?',
    'v2': 'Entra a Friendegle entre las veintidós y las veintitrés horas. ¡Todos los días a esa hora hay un concurso nuevo!',
    'v3': 'Busca al usuario con el cartel.',
    'v4': 'Ingresa el código único...',
    'v5': '¡Y gana el premio!',
    'v6': 'Entra a Friendegle con el link en la bio o en los comentarios.',
}
VOICE = 'es_AR-daniela-high'
URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/'
LENGTH_SCALE = '0.9'  # < 1 = un poco más rápido (ritmo de TikTok)

root = Path(__file__).resolve().parent.parent
voices = root / 'voices'
voices.mkdir(exist_ok=True)
model = voices / f'{VOICE}.onnx'
for f in (model, voices / f'{VOICE}.onnx.json'):
    if not f.exists():
        print(f'descargando {f.name}…')
        urllib.request.urlretrieve(URL + f.name, f)

out = root / 'public' / 'voice'
out.mkdir(parents=True, exist_ok=True)
for key, text in LINES.items():
    wav = out / f'{key}.wav'
    subprocess.run(
        [sys.executable, '-m', 'piper', '-m', str(model), '-f', str(wav), '--length-scale', LENGTH_SCALE, '--sentence-silence', '0.15'],
        input=text.encode('utf-8'),
        check=True,
        capture_output=True,
    )
    print(f'voz {key} -> {wav.name}')
