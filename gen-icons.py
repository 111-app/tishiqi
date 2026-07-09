# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont

def create_icon(size):
    # 渐变背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆角矩形背景（紫蓝渐变模拟）
    radius = size // 8
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=(79, 70, 229, 255))
    
    # 绘制时钟图标 ⏰
    # 使用 Emoji 字体或默认字体
    try:
        font = ImageFont.truetype("seguiemj.ttf", size=int(size * 0.55))
    except:
        try:
            font = ImageFont.truetype("arial.ttf", size=int(size * 0.55))
        except:
            font = ImageFont.load_default()
    
    text = "⏰"
    # 使用中心点对齐，确保图标完全居中
    draw.text((size // 2, size // 2), text, font=font, embedded_color=True, anchor="mm")
    return img

# 生成 192x192 和 512x512
for s in [192, 512]:
    img = create_icon(s)
    img.save(f"icon-{s}.png", "PNG")
    print(f"Generated icon-{s}.png")
