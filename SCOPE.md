# Obseg projekta — Slovenski tarok

Spletna igra slovenskega taroka (4 igralci: 1 človek + 3 boti). Jezik vmesnika: **slovenščina**.

## Pravila v obsegu

Implementiran je celoten tok igre po uradnih pravilih (glej [stevec-taroka.si/pravila](https://stevec-taroka.si/pravila)):

| Faza | Vsebina |
| --- | --- |
| Deljenje | 54 kart, 4 × 12 + talon 6; ponovno deljenje, če kdo nima taroka |
| Licitacija | Vse pogodbe (tri … valat), privilegij forehanda, klop ob vseh »naprej« |
| Klicanje | Klic kralja (igre s partnerjem); solo, če je kralj v talonu ali pri deklarantu |
| Talon | Izbira kupčka (3/2/1), zaloga (brez trule/kraljev), odkriti odloženi taroki |
| Napovedi | Trula, kralji, pagat/kralj ultimo, valat; kontra / rekontra / sub / mord |
| Igra | Barvanje, jemanje s tarokom, posebna pravila za klop/berač/odprti berač/valat/barvni valat |
| Posebnosti | Mondfang, radlci, zgodnji konec berača/valata, odprta roka pri odprtem beraču |

## Izjema: štetje (counting)

**Tradicionalno štetje kart (po trojicah, −2 / −1) ni del tega projekta** — niti kot interaktivni korak za igralca niti kot učni način.

Za odločanje zmag/porazov in razlike motor na koncu kroga uporablja **samodejne seštevke točk kart**, da ostanejo pogodbe igrive. To ni nadomestilo za ročno štetje po trojicah in se ne predstavlja kot popolna implementacija štetja.

## Zunaj obsega (za zdaj)

- Igra v troje
- Večigralski strežnik / omrežje
- i18n (angleščina, nemščina) — vmesnik je samo slovenski
