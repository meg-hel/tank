/**
 * Tank – Motorsteuerung und Web-Bluetooth
 * Calliope mini V2 / L298P
 * Links: P0 Richtung, P1 PWM
 * Rechts: P2 Richtung, P3 PWM
 *
 * Joystick-Protokoll: X+25,Y-40\n
 * Hinweis: Funk und Bluetooth in getrennten MakeCode-Programmen testen.
 */
//% color="#0D47A1" icon="\uf1b9" block="Tank"
namespace tank {
    export enum Motor {
        //% block="links"
        Links = 0,
        //% block="rechts"
        Rechts = 1,
        //% block="beide"
        Beide = 2
    }

    export enum Richtung {
        //% block="vorwärts"
        Vorwaerts = 0,
        //% block="rückwärts"
        Rueckwaerts = 1
    }

    export enum WebTaste {
        //% block="↑"
        Hoch = 0,
        //% block="↓"
        Runter = 1,
        //% block="←"
        Links = 2,
        //% block="→"
        Rechts = 3
    }

    let webGestartet = false
    let letzteNachricht = 0
    let motorenAktiv = false
    let aktuelleTaste = -1
    let joystickAktiv = false
    let ereignisse: number[] = []
    let funktionen: (() => void)[] = []
    let fahrzeit = 150
    let drehzeit = 75
    let totzone = 10
    let joystickTimeout = 250

    function stoppen(): void {
        pins.analogWritePin(AnalogPin.P1, 0)
        pins.analogWritePin(AnalogPin.P3, 0)
        motorenAktiv = false
    }

    /** Motoren ansteuern (Tempo 0–700). */
    //% blockId=tank_motor
    //% block="Motor %motor Richtung %richtung Tempo %tempo"
    //% tempo.shadow=math_number_minmax
    //% tempo.min=0 tempo.max=700 tempo.defl=200
    //% weight=100
    export function motor(motor: Motor, richtung: Richtung, tempo: number): void {
        tempo = Math.constrain(tempo, 0, 700)
        let signal = richtung == Richtung.Vorwaerts ? 1 : 0

        if (motor == Motor.Links || motor == Motor.Beide) {
            pins.analogWritePin(AnalogPin.P1, 0)
            pins.digitalWritePin(DigitalPin.P0, signal)
            pins.analogWritePin(AnalogPin.P1, tempo)
        }
        if (motor == Motor.Rechts || motor == Motor.Beide) {
            pins.analogWritePin(AnalogPin.P3, 0)
            pins.digitalWritePin(DigitalPin.P2, signal)
            pins.analogWritePin(AnalogPin.P3, tempo)
        }
        if (tempo > 0) {
            motorenAktiv = true
            letzteNachricht = input.runningTime()
        } else if (motor == Motor.Beide) {
            motorenAktiv = false
        }
    }

    function joystickMotoren(x: number, y: number): void {
        x = Math.constrain(x, -100, 100)
        y = Math.constrain(y, -100, 100)
        if (Math.abs(x) <= totzone) x = 0
        if (Math.abs(y) <= totzone) y = 0
        if (x == 0 && y == 0) {
            stoppen()
            return
        }

        let links = y + x
        let rechts = y - x
        let maximum = Math.max(100, Math.max(Math.abs(links), Math.abs(rechts)))
        links = links * 100 / maximum
        rechts = rechts * 100 / maximum
        let tempoLinks = Math.round(Math.abs(links) * 7)
        let tempoRechts = Math.round(Math.abs(rechts) * 7)

        pins.analogWritePin(AnalogPin.P1, 0)
        pins.analogWritePin(AnalogPin.P3, 0)
        pins.digitalWritePin(DigitalPin.P0, links >= 0 ? 1 : 0)
        pins.digitalWritePin(DigitalPin.P2, rechts >= 0 ? 1 : 0)
        pins.analogWritePin(AnalogPin.P1, tempoLinks)
        pins.analogWritePin(AnalogPin.P3, tempoRechts)
        motorenAktiv = true
    }

    function joystickAuswerten(text: string): boolean {
        while (text.length > 0 && text.charAt(0) == "X") {
            text = text.substr(1)
        }
        let komma = text.indexOf(",Y")
        if (komma < 0) return false
        let xText = text.substr(0, komma)
        let yText = text.substr(komma + 2)
        if (xText.length < 2 || yText.length < 2) return false
        if ((xText.charAt(0) != "+" && xText.charAt(0) != "-") ||
            (yText.charAt(0) != "+" && yText.charAt(0) != "-")) return false
        let x = parseFloat(xText)
        let y = parseFloat(yText)
        if (isNaN(x) || isNaN(y)) return false
        joystickAktiv = true
        aktuelleTaste = -1
        letzteNachricht = input.runningTime()
        joystickMotoren(x, y)
        return true
    }

    /** Web-Bluetooth UART starten. */
    //% blockId=tank_web_bluetooth
    //% block="Web-Bluetooth starten"
    //% weight=80
    export function webBluetoothStarten(): void {
        if (webGestartet) return
        webGestartet = true
        stoppen()
        bluetooth.startUartService()
        bluetooth.onBluetoothDisconnected(function () {
            stoppen()
            joystickAktiv = false
        })

        control.inBackground(function () {
            while (true) {
                let befehl = bluetooth.uartReadUntil("\n")
                befehl = befehl.trim()
                if (!joystickAuswerten(befehl)) {
                    let taste = -1
                    if (befehl == "up") taste = WebTaste.Hoch
                    else if (befehl == "down") taste = WebTaste.Runter
                    else if (befehl == "left") taste = WebTaste.Links
                    else if (befehl == "right") taste = WebTaste.Rechts
                    if (taste >= 0) {
                        joystickAktiv = false
                        aktuelleTaste = taste
                        letzteNachricht = input.runningTime()
                        for (let i = 0; i < ereignisse.length; i++) {
                            if (ereignisse[i] == taste) funktionen[i]()
                        }
                    }
                }
                basic.pause(10)
            }
        })

        control.inBackground(function () {
            while (true) {
                if (motorenAktiv) {
                    let zeit = fahrzeit
                    if (joystickAktiv) zeit = joystickTimeout
                    else if (aktuelleTaste == WebTaste.Links || aktuelleTaste == WebTaste.Rechts) zeit = drehzeit
                    if (input.runningTime() - letzteNachricht >= zeit) stoppen()
                }
                basic.pause(20)
            }
        })
    }

    /** Ereignis für die vier Web-Pfeiltasten. */
    //% blockId=tank_web_taste
    //% block="wenn Web-Taste %taste empfangen"
    //% weight=70
    export function wennWebTaste(taste: WebTaste, handler: () => void): void {
        ereignisse.push(taste)
        funktionen.push(handler)
    }
}
