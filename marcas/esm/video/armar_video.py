"""ESM · arma los videos de cómo instalar la app (iPhone Safari, iPhone Chrome, Android Chrome).

Con voz (necesita internet; se hace en la computadora):
    pip install edge-tts imageio-ffmpeg
    python armar_video.py                         # voz de hombre, Paraguay (es-PY-MarioNeural)
    python armar_video.py --voz es-PY-TaniaNeural # voz de mujer
Sin voz (solo música):
    python armar_video.py --sin-voz
Salida: salida/<video>.mp4 (va en marcas/esm/tutorial/ del sistema).
Cada escena está en escenas/<video>/NN.png; si existe NNb.png (con el anillo amarillo en el botón a tocar),
el anillo titila para mostrar dónde tocar.
"""
import json, os, re, shutil, subprocess, sys

H = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
SIN_VOZ = "--sin-voz" in args
VOZ = args[args.index("--voz") + 1] if "--voz" in args else "es-PY-MarioNeural"
SOLO = args[args.index("--solo") + 1] if "--solo" in args else None
FPS = 30
W, Hh = 1080, 1920


def ffmpeg_exe():
    e = shutil.which("ffmpeg")
    if e: return e
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg_exe()


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0: raise SystemExit("Error en: " + " ".join(cmd[:8]) + "\n" + r.stderr[-1500:])
    return r


def dur_de(path):
    r = subprocess.run([FF, "-i", path], stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def hablar(texto, archivo):
    run([sys.executable, "-m", "edge_tts", "--voice", VOZ, "--rate=+0%", "--text", texto, "--write-media", archivo])
    return dur_de(archivo)


G = json.load(open(os.path.join(H, "guion.json"), encoding="utf-8"))
os.makedirs(os.path.join(H, "salida"), exist_ok=True)
for k, v in G.items():
    if SOLO and k != SOLO: continue
    esc = v["escenas"]
    tmp = os.path.join(H, "tmp", k); os.makedirs(tmp, exist_ok=True)
    voces, durs = [None] * len(esc), [e["dur"] for e in esc]
    if not SIN_VOZ:
        for i, e in enumerate(esc):
            f = os.path.join(tmp, "voz%02d.mp3" % i)
            durs[i] = max(e["dur"], hablar(e["voz"], f) + 1.0)
            voces[i] = f
    # 1) un clip por escena; si hay versión con anillo, titila (sin anillo 1 s, después anillo / sin anillo)
    lista = []
    for i, d in enumerate(durs):
        a = os.path.join(H, "escenas", k, "%02d.png" % (i + 1)); b = os.path.join(H, "escenas", k, "%02db.png" % (i + 1))
        seq = os.path.join(tmp, "seq%02d.txt" % i)
        if os.path.exists(b):
            partes, t = [(a, 1.0)], 1.0
            while t < d:
                for img, dd in ((b, 0.9), (a, 0.3)):
                    dd = min(dd, d - t)
                    if dd > 0.01: partes.append((img, dd)); t += dd
        else:
            partes = [(a, d)]
        with open(seq, "w", encoding="utf-8") as fh:
            for img, dd in partes: fh.write("file '%s'\nduration %.3f\n" % (img.replace("\\", "/"), dd))
            fh.write("file '%s'\n" % partes[-1][0].replace("\\", "/"))
        clip = os.path.join(tmp, "c%02d.mp4" % i)
        vf = f"fps={FPS},scale={W}:{Hh},fade=t=in:st=0:d=0.3,fade=t=out:st={d - 0.3:.2f}:d=0.3,format=yuv420p"
        run([FF, "-y", "-f", "concat", "-safe", "0", "-i", seq, "-vf", vf, "-t", f"{d:.3f}",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", clip])
        lista.append(clip)
    cat = os.path.join(tmp, "lista.txt")
    with open(cat, "w", encoding="utf-8") as fh: fh.write("".join("file '%s'\n" % c.replace("\\", "/") for c in lista))
    mudo = os.path.join(tmp, "mudo.mp4"); run([FF, "-y", "-f", "concat", "-safe", "0", "-i", cat, "-c", "copy", mudo])
    largo = sum(durs)
    # 2) sonido: música de fondo suave (baja cuando habla la voz)
    mus = os.path.join(H, "musica.wav")
    salida = os.path.join(H, "salida", k + ".mp4")
    entradas = [FF, "-y", "-i", mudo, "-stream_loop", "-1", "-i", mus]
    if SIN_VOZ:
        filtro = f"[1:a]volume=0.55,afade=t=in:d=1,afade=t=out:st={largo - 2:.2f}:d=2[a]"
    else:
        t, partes = 0.0, []
        for i, f in enumerate(voces):
            entradas += ["-i", f]
            partes.append(f"[{i + 2}:a]adelay={int((t + 0.45) * 1000)}|{int((t + 0.45) * 1000)}[v{i}]")
            t += durs[i]
        mezcla = "".join(f"[v{i}]" for i in range(len(voces)))
        filtro = ";".join(partes) + f";{mezcla}amix=inputs={len(voces)}:normalize=0[voz];" \
                 f"[1:a]volume=0.22,afade=t=in:d=1,afade=t=out:st={largo - 2:.2f}:d=2[mus];[voz][mus]amix=inputs=2:normalize=0[a]"
    run(entradas + ["-filter_complex", filtro, "-map", "0:v", "-map", "[a]", "-t", f"{largo:.3f}",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", salida])
    print(k, "listo:", salida, round(largo, 1), "s")
