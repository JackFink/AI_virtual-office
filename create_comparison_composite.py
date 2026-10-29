import os
from PIL import Image, ImageDraw, ImageFont

artifact_dir = r"C:\Users\Jack. Gram\.gemini\antigravity-ide\brain\9cacf039-b568-426d-8e19-d3955c4ab09c"

# 1. Load authentic MapleStory Cody sprite
cody_path = os.path.join(artifact_dir, "maple_cody_real.png")
cody_img = Image.open(cody_path).convert("RGBA")
scale_factor = 4  # 39x70 -> 156x280 crisp nearest neighbor
cody_large = cody_img.resize((cody_img.width * scale_factor, cody_img.height * scale_factor), Image.NEAREST)

# 2. Load authentic MapleStory Spinel sprite
spinel_path = os.path.join(artifact_dir, "maple_spinel_real.png")
spinel_img = Image.open(spinel_path).convert("RGBA")
spinel_large = spinel_img.resize((int(spinel_img.width * 3.2), int(spinel_img.height * 3.2)), Image.NEAREST)

# 3. Load office crops
stage_crop_path = os.path.join(artifact_dir, "office_character_stage_crop.png")
stage_crop = Image.open(stage_crop_path).convert("RGBA")
stage_crop = stage_crop.resize((210, 224), Image.LANCZOS)

agent01_path = os.path.join(artifact_dir, "office_agent01_crop.png")
agent01_img = Image.open(agent01_path).convert("RGBA")
agent01_img = agent01_img.resize((190, 200), Image.LANCZOS)

agent05_path = os.path.join(artifact_dir, "office_agent05_crop.png")
agent05_img = Image.open(agent05_path).convert("RGBA")
agent05_img = agent05_img.resize((190, 200), Image.LANCZOS)

# Create a clean, spacious canvas
canvas_w, canvas_h = 1060, 680
canvas = Image.new("RGBA", (canvas_w, canvas_h), (11, 17, 32, 255)) # Dark obsidian navy
draw = ImageDraw.Draw(canvas)

# Fonts
try:
    font_title = ImageFont.truetype("malgun.ttf", 25)
    font_sub = ImageFont.truetype("malgun.ttf", 14)
    font_card_title = ImageFont.truetype("malgun.ttf", 18)
    font_desc = ImageFont.truetype("malgun.ttf", 13)
    font_badge = ImageFont.truetype("malgun.ttf", 12)
    font_caption = ImageFont.truetype("malgun.ttf", 12)
except:
    font_title = font_sub = font_card_title = font_desc = font_badge = font_caption = ImageFont.load_default()

# Header
draw.text((40, 24), "실제 웹 검색 메이플스토리 캐릭터 vs 현재 오피스 AI 캐릭터 비교", fill=(248, 250, 252), font=font_title)
draw.text((40, 62), "※ AI 생성 이미지 0% : 메이플스토리 공식 웹 위키 스프라이트와 로컬 웹앱(#characters) 실시간 화면 캡처 직접 대조", fill=(148, 163, 184), font=font_sub)

# ================= Left Card: Real MapleStory =================
card1_x1, card1_y1, card1_x2, card1_y2 = 40, 100, 480, 640
draw.rounded_rectangle((card1_x1, card1_y1, card1_x2, card1_y2), radius=16, fill=(20, 29, 47, 255), outline=(51, 65, 85, 255), width=2)

# Badge
draw.rounded_rectangle((card1_x1 + 18, card1_y1 + 16, card1_x1 + 180, card1_y1 + 40), radius=6, fill=(234, 88, 12, 255))
draw.text((card1_x1 + 26, card1_y1 + 20), "웹 검색 실제 원작 스프라이트", fill=(255, 255, 255), font=font_badge)

draw.text((card1_x1 + 18, card1_y1 + 48), "메이플스토리 캐릭터 (코디 & 스피넬)", fill=(241, 245, 249), font=font_card_title)
draw.text((card1_x1 + 18, card1_y1 + 74), "출처: MapleStory Fandom Wiki 공식 스프라이트 파일 직접 다운로드", fill=(148, 163, 184), font=font_desc)

# Sprite Display Box
box1_x1, box1_y1, box1_x2, box1_y2 = card1_x1 + 18, card1_y1 + 102, card1_x2 - 18, card1_y1 + 372
draw.rounded_rectangle((box1_x1, box1_y1, box1_x2, box1_y2), radius=12, fill=(13, 20, 36, 255), outline=(51, 65, 85, 255), width=1)

# Paste Cody & Spinel side by side in Left Box
cody_x = box1_x1 + 40
cody_y = box1_y1 + (box1_y2 - box1_y1 - cody_large.height) // 2
canvas.paste(cody_large, (cody_x, cody_y), cody_large)
draw.text((cody_x + 22, box1_y2 - 24), "NPC 코디 (남성/캐주얼)", fill=(148, 163, 184), font=font_caption)

spinel_x = box1_x1 + 220
spinel_y = box1_y1 + (box1_y2 - box1_y1 - spinel_large.height) // 2
canvas.paste(spinel_large, (spinel_x, spinel_y), spinel_large)
draw.text((spinel_x + 35, box1_y2 - 24), "가이드 스피넬 (여성)", fill=(148, 163, 184), font=font_caption)

# Bullets for Left Card
by = card1_y1 + 390
draw.text((card1_x1 + 20, by), "• 비율 (Proportions): 정확한 2등신 대두 치비 (머리 ~50% / 몸체 50%)", fill=(226, 232, 240), font=font_desc)
draw.text((card1_x1 + 20, by + 26), "• 얼굴 (Face): 큼직한 반짝이 눈동자, 옅은 핑크 볼터치, 미니멀한 입", fill=(226, 232, 240), font=font_desc)
draw.text((card1_x1 + 20, by + 52), "• 의상 (Costume): 모험가 캐주얼 (자켓, 이너 티셔츠, 청바지, 스니커즈)", fill=(226, 232, 240), font=font_desc)
draw.text((card1_x1 + 20, by + 78), "• 라인 (Art Style): 도트 특유의 선명한 픽셀 아웃라인과 또렷한 명암", fill=(226, 232, 240), font=font_desc)


# ================= Right Card: Current Office AI Characters =================
card2_x1, card2_y1, card2_x2, card2_y2 = 505, 100, 1020, 640
draw.rounded_rectangle((card2_x1, card2_y1, card2_x2, card2_y2), radius=16, fill=(20, 29, 47, 255), outline=(16, 185, 129, 255), width=2)

# Badge
draw.rounded_rectangle((card2_x1 + 18, card2_y1 + 16, card2_x1 + 195, card2_y1 + 40), radius=6, fill=(16, 185, 129, 255))
draw.text((card2_x1 + 26, card2_y1 + 20), "현재 웹앱 실제 화면 캡처", fill=(255, 255, 255), font=font_badge)

draw.text((card2_x1 + 18, card2_y1 + 48), "넥서스 가상오피스 AI 캐릭터", fill=(241, 245, 249), font=font_card_title)
draw.text((card2_x1 + 18, card2_y1 + 74), "출처: http://localhost:8080/agents.html#characters 실시간 실행 캡처", fill=(148, 163, 184), font=font_desc)

# Display Box for Office Characters
box2_x1, box2_y1, box2_x2, box2_y2 = card2_x1 + 18, card2_y1 + 102, card2_x2 - 18, card2_y1 + 372
draw.rounded_rectangle((box2_x1, box2_y1, box2_x2, box2_y2), radius=12, fill=(13, 20, 36, 255), outline=(51, 65, 85, 255), width=1)

# Paste Stage Crop (Agent 03 HR)
canvas.paste(stage_crop, (box2_x1 + 15, box2_y1 + 12), stage_crop)
draw.text((box2_x1 + 40, box2_y2 - 24), "인사채용 AI (커스텀 프리뷰)", fill=(148, 163, 184), font=font_caption)

# Paste Agent 05 (Fullstack Dev)
canvas.paste(agent05_img, (box2_x1 + 260, box2_y1 + 24), agent05_img)
draw.text((box2_x1 + 295, box2_y2 - 24), "풀스택개발 AI (그리드 카드)", fill=(148, 163, 184), font=font_caption)

# Bullets for Right Card
draw.text((card2_x1 + 20, by), "• 완벽한 2등신 치비 계승: 메이플 비율과 동일한 머리:몸체 1:1 황금비", fill=(226, 232, 240), font=font_desc)
draw.text((card2_x1 + 20, by + 26), "• 메이플 페이스 디테일: 별빛 하이라이트 동공, 분홍 볼터치, 귀여운 모션", fill=(226, 232, 240), font=font_desc)
draw.text((card2_x1 + 20, by + 52), "• 오피스 직무 현대화: 정장, 후드티, 슬랙스, 사원증 목걸이, 노트북, 스마트폰", fill=(226, 232, 240), font=font_desc)
draw.text((card2_x1 + 20, by + 78), "• 100% SVG 모듈 파츠: 베이스·헤어·표정·상의·하의·소품 5단 실시간 교체", fill=(52, 211, 153), font=font_desc)

out_final = os.path.join(artifact_dir, "real_web_vs_office_comparison.png")
canvas.save(out_final, format="PNG")
print("Saved final crisp comparison to:", out_final)
