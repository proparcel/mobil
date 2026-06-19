## Amaç

Mobil uygulamada alt-sheet / menü tipindeki tüm panellerin **sadece tutma barından (drag handle)** değil, **panelin herhangi bir yerinden aşağı sürükleme** ile kapanabilmesi.

## Kapsam

- Ana menü (index içindeki `Modal`)
- `MyQueriesModal` (Sorgularım)
- Rapor sayfası (`app/report_mobil_viewver.tsx`) içindeki:
  - Hamburger menü modalı
  - Map info / controls sheet (`mapPanelVisible`)
- Diğer sheet benzeri modallar (Parcel/PropertyType gibi ScrollView içerenler dahil)

## Uygulama Prensibi

- Gesture tüm sheet container’a uygulanır (sadece drag handle alanına değil).
- ScrollView içeren sheet’lerde, **ScrollView en üstteyken** aşağı sürükleme “kapatma” gesture’ına dönüşür.
  - Scroll içerik aşağıda ise normal scroll davranışı korunur.
- Kapatma eşiği:
  - `dy > 120` veya hızlı sürükleme `vy > 1.2`

## Test Planı

- Ana menüyü aç:
  - Tutma barından aşağı sürükle → kapanmalı
  - Menü içindeki herhangi bir yerden (header/liste) aşağı sürükle → kapanmalı
  - Menü listesi aşağı kaydırılmışken: scroll çalışmalı; en üste gelince aşağı sürükle kapanmalı
- Sorgularım’ı aç:
  - Tutma barından aşağı sürükle → kapanmalı
  - Liste/header üzerinde aşağı sürükle → kapanmalı
  - Liste aşağı kaydırılmışken: scroll çalışmalı; en üste gelince aşağı sürükle kapanmalı
- Rapor sayfası:
  - Hamburger menüyü aç → menü kartının herhangi bir yerinden aşağı sürükle → kapanmalı
  - Harita panelini aç (`mapPanelVisible`) → panelin herhangi bir yerinden aşağı sürükle → kapanmalı
  - Harita paneli içerik aşağı kaydırılmışken: scroll çalışmalı; en üste gelince aşağı sürükle kapanmalı

