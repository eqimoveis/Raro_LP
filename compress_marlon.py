"""
Otimiza os vídeos das amenidades Marlon:
- Recorta para máximo 5 segundos (t=0 até t=5)
- Re-encoda em H.264 720p max, CRF 28 (boa qualidade, arquivo menor)
- Salva com sufixo _web.mp4 na mesma pasta
"""
import subprocess, os
from pathlib import Path

SRC_DIR = Path("assets/amenidades-marlon")
MAX_SEC = 5
# CRF 28 = boa qualidade/tamanho; scale=1280:-2 = máx 1280px largura mantendo proporção
FFMPEG_ARGS = [
    "-c:v", "libx264", "-crf", "28", "-preset", "fast",
    "-vf", "scale='min(1280,iw)':-2",  # reduz se maior que 1280px
    "-an",   # sem áudio
    "-movflags", "+faststart",  # streaming-ready
    "-y"
]

videos = sorted(SRC_DIR.glob("*.mp4"))
print(f"Processando {len(videos)} vídeos...\n")

total_before = 0
total_after = 0

for mp4 in videos:
    if mp4.stem.endswith("_web"):
        continue  # pula já processados
    
    orig_size = mp4.stat().st_size
    total_before += orig_size

    # Detecta duração real do vídeo
    probe_cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(mp4)
    ]
    try:
        dur_str = subprocess.check_output(probe_cmd, text=True).strip()
        duration = float(dur_str)
    except:
        duration = 999

    trim_dur = min(duration, MAX_SEC)
    
    out_path = mp4.parent / (mp4.stem + "_web.mp4")

    cmd = ["ffmpeg", "-i", str(mp4), "-t", str(trim_dur)] + FFMPEG_ARGS + [str(out_path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"  ERRO: {mp4.name}")
        print(result.stderr[-500:])
        continue

    out_size = out_path.stat().st_size
    total_after += out_size
    reduction = (1 - out_size / orig_size) * 100
    print(f"  {mp4.name} ({orig_size/1024/1024:.1f}MB) → {out_path.name} ({out_size/1024/1024:.1f}MB · {reduction:.0f}% menor · {trim_dur:.1f}s)")

print(f"\nTotal: {total_before/1024/1024:.1f}MB → {total_after/1024/1024:.1f}MB ({(1-total_after/total_before)*100:.0f}% menor)")
print("\nDone! Verifique os arquivos _web.mp4 antes de substituir os originais.")
