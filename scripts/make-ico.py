from PIL import Image

src = '/mnt/e/04-AI_tools/03-projects/03-AI_Tools/build/icon.png'
img = Image.open(src).convert('RGBA')

sizes = [16, 32, 48, 64, 128, 256]
out = '/mnt/e/04-AI_tools/03-projects/03-AI_Tools/build/icon.ico'

img.save(out, format='ICO', sizes=[(s, s) for s in sizes])
print(f'ICO created: {out}')
