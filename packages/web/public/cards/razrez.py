import os
from PIL import Image

karte_seznam = [
    {"karta": "Sküs (Fool)", "box": [8, 5, 205, 122]},
    {"karta": "XXI (Mond)",  "box": [8, 128, 205, 245]},
    {"karta": "XX",          "box": [8, 251, 205, 368]},
    {"karta": "XIX",         "box": [8, 374, 205, 491]},
    {"karta": "XVIII",       "box": [8, 497, 205, 614]},
    {"karta": "XVII",        "box": [8, 620, 205, 737]},
    {"karta": "XVI",         "box": [8, 743, 205, 860]},
    {"karta": "XV",          "box": [8, 866, 205, 983]},
    {"karta": "XIV",         "box": [215, 5, 412, 122]},
    {"karta": "XIII",        "box": [215, 128, 412, 245]},
    {"karta": "XII",         "box": [215, 251, 412, 368]},
    {"karta": "XI",          "box": [215, 374, 412, 491]},
    {"karta": "X",           "box": [215, 497, 412, 614]},
    {"karta": "IX",          "box": [215, 620, 412, 737]},
    {"karta": "VIII",        "box": [215, 743, 412, 860]},
    {"karta": "VII",         "box": [215, 866, 412, 983]},
    {"karta": "VI",          "box": [422, 5, 619, 122]},
    {"karta": "V",           "box": [422, 128, 619, 245]},
    {"karta": "IIII",        "box": [422, 251, 619, 368]},
    {"karta": "III",         "box": [422, 374, 619, 491]},
    {"karta": "II",          "box": [422, 497, 619, 614]},
    {"karta": "I (Pagat)",   "box": [422, 620, 619, 737]},  # ✅ popravek 1
]

POT_DO_SLIKE = "tarok_karte.jpg"
MAPA_ZA_IZHOD = "izrezane_karte"

if not os.path.exists(MAPA_ZA_IZHOD):
    os.makedirs(MAPA_ZA_IZHOD)                              # ✅ popravek 2

try:
    originalna_slika = Image.open(POT_DO_SLIKE)             # ✅ popravek 2
except FileNotFoundError:
    print(f"Napaka: Datoteka '{POT_DO_SLIKE}' ne obstaja v mapi: {os.getcwd()}")
    print("Prosim, preimenujte svojo izvorno sliko v 'tarok_karte.jpg'.")
    exit()

print(f"Začenjam z izrezovanjem {len(karte_seznam)} tarok kart...")

for element in karte_seznam:                                 # ✅ popravek 2
    ime_karte = element["karta"]
    koordinate = element["box"]
    ymin, xmin, ymax, xmax = koordinate
    box_za_pillow = (xmin, ymin, xmax, ymax)
    izrezana_karta = originalna_slika.crop(box_za_pillow)
    varno_ime = ime_karte.replace(" ", "_").replace("(", "").replace(")", "").lower()
    varno_ime = varno_ime.replace("ü", "u")
    celotna_pot = os.path.join(MAPA_ZA_IZHOD, f"{varno_ime}.jpg")
    izrezana_karta.save(celotna_pot, "JPEG")
    print(f"-> Uspešno shranjena: {celotna_pot}")

print("\nKončano! Vse karte so uspešno razrezane.")
