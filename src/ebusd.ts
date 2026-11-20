// Draht zum Befehlsport von ebusd, wie ebusctl: je Befehl eine Verbindung, eine Zeile hin, die Antwort endet mit einer Leerzeile.
// Fehler beginnen mit "ERR: " (ebusd 26.1, src/lib/ebus/result.cpp). Befehle laufen streng nacheinander: Auf dem Bus geht ohnehin
// nur eins zur Zeit, und so steht im Protokoll jede Antwort direkt hinter ihrem Befehl.
import { connect } from 'node:net';

export interface Antwort {
  text: string;
  ok: boolean; // false, wenn ebusd mit "ERR: …" antwortet
  ms: number;
}

/** Was die Versuche von ebusd brauchen; im Test ersetzt. */
export interface Befehle {
  befehl(zeile: string): Promise<Antwort>;
}

export class Ebusd implements Befehle {
  private kette: Promise<unknown> = Promise.resolve();
  host: string;
  port: number;
  zeitlimitMs: number;

  constructor(host: string, port: number, zeitlimitMs = 20_000) {
    this.host = host;
    this.port = port;
    this.zeitlimitMs = zeitlimitMs;
  }

  befehl(zeile: string): Promise<Antwort> {
    if (!/^[\x20-\x7e]+$/.test(zeile)) return Promise.reject(new Error(`ungültiger Befehl: ${JSON.stringify(zeile)}`));
    const lauf = this.kette.then(() => this.senden(zeile));
    this.kette = lauf.catch(() => {});
    return lauf;
  }

  private senden(zeile: string): Promise<Antwort> {
    const start = Date.now();
    return new Promise((fertig, fehler) => {
      const s = connect({ host: this.host, port: this.port });
      let puffer = '';
      let erledigt = false;
      const ende = (e: Error | null, text = '') => {
        if (erledigt) return;
        erledigt = true;
        clearTimeout(uhr);
        s.destroy();
        if (e) fehler(e);
        else fertig({ text, ok: !text.startsWith('ERR:'), ms: Date.now() - start });
      };
      const uhr = setTimeout(() => ende(new Error(`ebusd antwortet nicht in ${this.zeitlimitMs} ms: ${zeile}`)), this.zeitlimitMs);
      s.setEncoding('utf8');
      s.on('connect', () => s.write(`${zeile}\n`));
      s.on('data', (d: string) => {
        puffer += d;
        const i = puffer.indexOf('\n\n');
        if (i >= 0) ende(null, puffer.slice(0, i));
      });
      s.on('error', (e) => ende(new Error(`ebusd ${this.host}:${this.port} nicht erreichbar: ${e.message}`)));
      s.on('close', () => ende(new Error(`ebusd hat die Verbindung ohne Antwort geschlossen: ${zeile}`)));
    });
  }
}
