// Die Versuche für eine Wolf CWL 300/400 Excellent (baugleich Brink Renovent Excellent), Definition encon/excellent von ebusd.
// Abgesprochen am 2026-11-20: Stufe und Filter stellt, wer am Gerät steht, selbst ein, wenn die App darum bittet; per eBus
// geschrieben wird nur SetFanMode (fällt laut Definition nach wenigen Minuten zurück), nie ResetNotifications; Abtasten liest nur.
// Seit 2026-11-22 dazu SetFanModeAlt, das nicht von selbst zurückfällt: SetFanMode quittiert die CWL, schaltet aber nicht.
import { SCHREIBBAR, type Kontext, type Versuch } from './versuche.ts';

/** Was sich bei einem Stufenwechsel ändern sollte */
export const STUFE = [
  'FanMode', 'SwitchPosition', 'SettingInletFlow', 'SettingExhaustFlow', 'InletFlow', 'ExhaustFlow', 'InletFanSpeed', 'ExhaustFanSpeed',
];
export const LUFTMENGEN = ['FlowMode0', 'FlowMode1', 'FlowMode2', 'FlowMode3'];
export const FILTER = [
  'FilterStatus', 'TotalFilterDays', 'TotalFilterFlow', 'FilterNotificationFlow', 'FilterDaysBeforeWarning', 'RequestErrorList',
];
const FILTER_KURZ = ['FilterStatus', 'TotalFilterDays', 'TotalFilterFlow'];
const SEKUNDE = 1000;
const MINUTE = 60 * SEKUNDE;

async function nachregeln(k: Kontext, was: string) {
  await k.warte(30 * SEKUNDE, `${was}: 30 s beobachten, bis die Lüfter nachgeregelt haben. „Weiter“ geht früher.`, {
    beobachten: STUFE, alleMs: 5 * SEKUNDE,
  });
}

export const CWL_VERSUCHE: Versuch[] = [
  {
    id: 'bestand',
    titel: 'Bestandsaufnahme',
    beschreibung: 'Liest einmal alle Werte der Definition und vergleicht sie mit der Anzeige. Du liest nur ab.',
    dauer: 'etwa 2 Minuten',
    async ablauf(k) {
      await k.eingabe('Was zeigt die Anzeige der CWL gerade? Stufe, Luftmenge, Meldungen wie FILTER. Kurz notieren, dann „Speichern“.');
      k.arbeite(`Alle ${k.lesbar.length} Werte der Definition lesen`, k.lesbar.length);
      for (const [i, name] of k.lesbar.entries()) {
        await k.lies([name]);
        k.fortschritt(i + 1);
      }
      await k.eingabe('Stimmen Stufe, Luftmengen und Temperaturen in der Liste unten mit der Anzeige überein? Abweichungen notieren.');
    },
  },
  {
    id: 'stufe-geraet',
    titel: 'Stufe am Gerät',
    beschreibung:
      'Du stellst die Stufen 0, 1, 2, 3 nacheinander am Gerät ein, die App liest dabei alle 5 s Modus, Luftmengen und Drehzahlen. ' +
      'Zeigt, was die CWL bei einem Stufenwechsel von selbst sendet.',
    dauer: 'etwa 5 Minuten',
    async ablauf(k) {
      await k.lies([...STUFE, ...LUFTMENGEN]);
      await k.eingabe('Welche Stufe zeigt die Anzeige jetzt? Das ist die Ausgangsstufe, am Ende kommt sie zurück.');
      for (const s of ['0', '1', '2', '3']) {
        await k.erledigt(`Stelle am Gerät Stufe ${s} ein. „Erledigt“, sobald die Anzeige sie zeigt. Geht es nicht: notieren, dann „Erledigt“.`, {
          beobachten: STUFE, alleMs: 5 * SEKUNDE,
        });
        await nachregeln(k, `Stufe ${s}`);
      }
      await k.erledigt('Stelle die Ausgangsstufe wieder ein. „Erledigt“, sobald die Anzeige sie zeigt.', { beobachten: STUFE, alleMs: 5 * SEKUNDE });
      await nachregeln(k, 'Ausgangsstufe');
      await k.lies(LUFTMENGEN);
    },
  },
  {
    id: 'stufe-ebus',
    titel: 'Stufe per eBus',
    beschreibung:
      'Die App schaltet per eBus auf Stufe 3 (SetFanMode High) und liest, bis die CWL von selbst zurückfällt (höchstens 15 min). ' +
      'Danach stellt sie den Ausgangswert wieder her. Du schaust auf die Anzeige.',
    dauer: '5 bis 15 Minuten',
    async ablauf(k) {
      const vorher = (await k.lies(STUFE)).FanMode;
      k.notiz(`Ausgang: FanMode ${vorher ?? 'nicht lesbar'}`);
      await k.erledigt('Gleich schaltet die App per eBus auf Stufe 3 (High). Schau auf die Anzeige; „Erledigt“ schaltet.');
      try {
        await k.schreibe('SetFanMode', 'High');
        await k.erledigt('Zeigt die Anzeige jetzt Stufe 3? Notiere, was du siehst, dann „Erledigt“.', { beobachten: STUFE, alleMs: 5 * SEKUNDE });
        let hoch = false;
        await k.warte(15 * MINUTE, 'Warten, bis die CWL von selbst zurückfällt (höchstens 15 min). „Weiter“ beendet früher.', {
          beobachten: STUFE,
          alleMs: 10 * SEKUNDE,
          bis: (w) => {
            hoch ||= w.FanMode === 'High';
            return hoch && w.FanMode !== undefined && w.FanMode !== 'High';
          },
        });
        await k.eingabe('Was zeigt die Anzeige jetzt? Wann ist sie zurückgesprungen?');
      } finally {
        const jetzt = (await k.lies(['FanMode'])).FanMode;
        if (vorher && jetzt !== vorher) {
          if (['Holiday', 'Reduced', 'Normal', 'High'].includes(vorher)) await k.schreibe('SetFanMode', vorher);
          else k.notiz(`Ausgang ${vorher} lässt sich per SetFanMode nicht setzen, die CWL steht auf ${jetzt ?? '?'}`);
        }
      }
    },
  },
  {
    id: 'stufe-bedienteil',
    titel: 'Stufe wie das Bedienteil',
    beschreibung:
      'Die App schaltet per eBus auf Stufe 3, so wie es das Bedienteil Brink AirControl tut (SetFanModeAlt High). Das fällt nicht ' +
      'von selbst zurück: Du drückst einmal eine Stufe am Gerät, am Ende stellt die App den Ausgangswert wieder ein.',
    dauer: 'etwa 4 Minuten',
    async ablauf(k) {
      const vorher = (await k.lies(STUFE)).FanMode;
      if (!vorher || !SCHREIBBAR.SetFanModeAlt!.includes(vorher)) {
        k.notiz(`Ausgang FanMode ${vorher ?? 'nicht lesbar'} lässt sich per SetFanModeAlt nicht wiederherstellen, der Versuch schreibt nichts`);
        return;
      }
      k.notiz(`Ausgang: FanMode ${vorher}`);
      await k.erledigt(
        'Gleich schaltet die App per eBus auf Stufe 3 (SetFanModeAlt High). Das hält, bis jemand etwas anderes einstellt; am Ende ' +
          'stellt die App die Ausgangsstufe wieder ein. Schau auf die Anzeige; „Erledigt“ schaltet.',
      );
      let geschrieben = false;
      try {
        geschrieben = true;
        await k.schreibe('SetFanModeAlt', 'High');
        await k.erledigt('Zeigt die Anzeige jetzt Stufe 3? Notiere, was du siehst, dann „Erledigt“.', { beobachten: STUFE, alleMs: 5 * SEKUNDE });
        await k.warte(2 * MINUTE, 'Zwei Minuten beobachten, ob die Stufe bleibt. „Weiter“ geht früher.', {
          beobachten: STUFE, alleMs: 10 * SEKUNDE,
        });
        await k.erledigt(
          'Stelle am Gerät eine andere Stufe ein, zum Beispiel 1. Folgt die CWL? Notieren, dann „Erledigt“.',
          { beobachten: STUFE, alleMs: 5 * SEKUNDE },
        );
      } finally {
        if (geschrieben) {
          await k.schreibe('SetFanModeAlt', vorher);
          await k.lies(STUFE);
        }
      }
      await k.erledigt(
        `Die App hat per eBus die Ausgangsstufe (FanMode ${vorher}) eingestellt. Zeigt die Anzeige sie? Lässt sich die Stufe am Gerät ` +
          'noch umstellen? Notieren, die Ausgangsstufe am Gerät einstellen, dann „Erledigt“.',
        { beobachten: STUFE, alleMs: 5 * SEKUNDE },
      );
    },
  },
  {
    id: 'filter',
    titel: 'Filter quittieren',
    beschreibung:
      'Liest die Filterwerte, du quittierst am Gerät (R 5 s), die App liest danach noch einmal. Am besten zusammen mit dem Filterwechsel.',
    dauer: 'etwa 3 Minuten',
    einmalig: 'Geht nur einmal: Danach steht der Filterzähler auf 0. Am besten als letzten Versuch und zusammen mit dem Filterwechsel.',
    async ablauf(k) {
      await k.lies(FILTER);
      await k.eingabe('Zeigt die Anzeige FILTER? Was steht genau da?');
      await k.erledigt(
        'Wenn du neue Filter hast: jetzt wechseln. Dann am Gerät die Taste R 5 s drücken, bis FILTER verschwindet. Danach „Erledigt“.',
        { beobachten: FILTER_KURZ, alleMs: 5 * SEKUNDE },
      );
      await k.warte(30 * SEKUNDE, '30 s beobachten. „Weiter“ geht früher.', { beobachten: FILTER_KURZ, alleMs: 5 * SEKUNDE });
      await k.lies(FILTER);
      await k.eingabe('Was zeigt die Anzeige jetzt?');
    },
  },
  {
    id: 'abtasten',
    titel: 'Unbekanntes abtasten',
    beschreibung:
      'Fragt alle Kennungen 40 22 00…ff und 40 50 00…ff ab, nur lesend, auch die, die die Definition nicht kennt. Du musst nichts tun.',
    dauer: 'einige Minuten',
    async ablauf(k) {
      await k.erledigt('Die App fragt jetzt 512 Kennungen ab, nur lesend. „Erledigt“ startet; abbrechen geht jederzeit.');
      k.arbeite('Kennungen abfragen', 512);
      let antworten = 0;
      let n = 0;
      for (const pbsb of ['4022', '4050']) {
        for (let id = 0; id < 256; id++) {
          if (k.signal.aborted) return;
          const a = await k.hex(`${k.cwl}${pbsb}01${id.toString(16).padStart(2, '0')}`);
          if (a.ok) antworten++;
          k.fortschritt(++n);
        }
      }
      k.notiz(`${antworten} von 512 Kennungen mit Antwort`);
    },
  },
];
