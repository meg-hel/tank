# Tank – MakeCode-Erweiterung (Testversion)

Gemeinsame Motor- und Web-Bluetooth-Steuerung für den Mini Tank mit Calliope mini V2.

- Motor links: P0 Richtung, P1 PWM
- Motor rechts: P2 Richtung, P3 PWM
- Motor-Tempo: 0–700
- Web-Bluetooth: Nordic UART; Joystick-Nachrichten `X+00,Y+00` mit Zeilenumbruch
- Automatischer Stopp bei ausbleibenden Joystick-Nachrichten und Bluetooth-Trennung

## MakeCode

Erweiterung über `https://github.com/meg-hel/tank` importieren.

**Testversion:** Funk und Bluetooth zunächst in getrennten Programmen prüfen. Die bestehenden Erweiterungen `mini-tank` und `mini-tank-web` bleiben als Rückfalllösung bestehen.
