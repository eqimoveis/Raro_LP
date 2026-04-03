"""
Converte todos os frames JPG para WebP.
Desktop: assets/frames/*.jpg → assets/frames-webp/*.webp
Mobile:  assets/frames-mobile/*.jpg → assets/frames-mobile-webp/*.webp
"""
import os
from PIL import Image
from pathlib import Path

QUALITY = 82  # boa qualidade, ~65% menor que JPEG

conversions = [
    ("assets/frames", "assets/frames-webp"),
    ("assets/frames-mobile", "assets/frames-mobile-webp"),
]

for src_dir, dst_dir in conversions:
    src = Path(src_dir)
    dst = Path(dst_dir)
    
    if not src.exists():
        print(f"SKIP: {src_dir} nao existe")
        continue
    
    dst.mkdir(exist_ok=True)
    jpgs = sorted(src.glob("*.jpg"))
    total = len(jpgs)
    
    if total == 0:
        print(f"SKIP: nenhum JPG em {src_dir}")
        continue
    
    print(f"\nConvertendo {total} arquivos: {src_dir} → {dst_dir}")
    
    orig_total = 0
    webp_total = 0
    
    for i, jpg_path in enumerate(jpgs, 1):
        webp_path = dst / (jpg_path.stem + ".webp")
        
        if webp_path.exists():
            continue  # já convertido
        
        try:
            img = Image.open(jpg_path)
            img.save(webp_path, "WEBP", quality=QUALITY, method=4)
            
            orig_size = jpg_path.stat().st_size
            webp_size = webp_path.stat().st_size
            orig_total += orig_size
            webp_total += webp_size
            
            if i % 50 == 0 or i == total:
                ratio = (1 - webp_total / orig_total) * 100 if orig_total else 0
                print(f"  [{i}/{total}] {orig_total/1024/1024:.1f}MB → {webp_total/1024/1024:.1f}MB ({ratio:.0f}% menor)")
        
        except Exception as e:
            print(f"  ERRO em {jpg_path.name}: {e}")
    
    print(f"  Concluido! {orig_total/1024/1024:.1f}MB → {webp_total/1024/1024:.1f}MB")

print("\nConversao finalizada!")
