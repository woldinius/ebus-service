// Speicher für die mitgelesenen Telegramme: eine SQLite-Datei, Zeit in Millisekunden seit 1970 (UTC).
// Aufbewahrt wird eine feste Zahl Tage (Standard 7), aufgeräumt per aufraeumen(), das main.ts regelmäßig aufruft.
// Dazu die Läufe der Versuche mit ihren Ereignissen (was gefragt, gesendet, beantwortet, am Gerät getan wurde). Läufe bleiben, bis
// jemand die Datei löscht; Telegramme aus ihrer Zeit (mit RAND davor und danach) löscht aufraeumen() nicht.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Status, Telegramm } from './telegramm.ts';

export interface Eintrag extends Telegramm {
  id: number;
  zeit: number;
  name: string | null; // Name aus der ebusd-Definition, wenn bekannt
}

export interface Filter {
  von?: number;
  bis?: number;
  pbsb?: string;
  qq?: number;
  zz?: number;
  status?: Status;
  grenze?: number;
  vor?: number; // nur Einträge mit kleinerer id (Blättern)
}

export interface Zusammenfassung {
  qq: number;
  zz: number;
  pbsb: string;
  name: string | null;
  anzahl: number;
  erste: number;
  letzte: number;
  daten: string;
  antwort: string | null;
  text: string | null;
  status: Status;
}

const SCHEMA = `
create table if not exists telegramme (
  id integer primary key,
  zeit integer not null,
  roh text not null,
  qq integer not null,
  zz integer not null,
  pbsb text not null,
  daten text not null,
  antwort text,
  text text,
  art text not null,
  status text not null,
  name text
);
create index if not exists telegramme_zeit on telegramme (zeit);
create index if not exists telegramme_nachricht on telegramme (qq, zz, pbsb, zeit);
create table if not exists zustand (schluessel text primary key, wert text not null);
create table if not exists laeufe (
  id integer primary key,
  versuch text not null,
  titel text not null,
  start integer not null,
  ende integer,
  status text not null,
  fehler text
);
create table if not exists ereignisse (
  id integer primary key,
  lauf integer not null references laeufe (id),
  zeit integer not null,
  art text not null,
  text text,
  befehl text,
  antwort text,
  ok integer,
  ms integer
);
create index if not exists ereignisse_lauf on ereignisse (lauf, id);
`;

export type LaufStatus = 'laeuft' | 'fertig' | 'abgebrochen' | 'fehler' | 'unterbrochen';

export interface LaufZeile {
  id: number;
  versuch: string;
  titel: string;
  start: number;
  ende: number | null;
  status: LaufStatus;
  fehler: string | null;
}

export interface NeuesEreignis {
  zeit: number;
  art: string; // schritt, lesen, schreiben, hex, erledigt, eingabe, weiter, notiz, fehler, abbruch
  text?: string | null;
  befehl?: string | null;
  antwort?: string | null;
  ok?: boolean | null;
  ms?: number | null;
}

export interface Ereignis {
  id: number;
  lauf: number;
  zeit: number;
  art: string;
  text: string | null;
  befehl: string | null;
  antwort: string | null;
  ok: boolean | null;
  ms: number | null;
}

/** So viel vor dem Start und nach dem Ende eines Laufs bleiben die Telegramme mit ihm erhalten */
export const RAND = 120_000;

const SPALTEN = 'id, zeit, roh, qq, zz, pbsb, daten, antwort, text, art, status, name';
const MAX_GRENZE = 5000;

export class Speicher {
  db: DatabaseSync;

  constructor(pfad: string) {
    this.db = new DatabaseSync(pfad);
    if (pfad !== ':memory:') this.db.exec('pragma journal_mode = wal; pragma synchronous = normal;');
    this.db.exec(SCHEMA);
  }

  schliessen(): void {
    this.db.close();
  }

  speichere(zeit: number, t: Telegramm, name: string | null = null): void {
    this.db
      .prepare(
        'insert into telegramme (zeit, roh, qq, zz, pbsb, daten, antwort, text, art, status, name) ' +
          'values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(zeit, t.roh, t.qq, t.zz, t.pbsb, t.daten, t.antwort, t.text, t.art, t.status, name);
  }

  liste(f: Filter): Eintrag[] {
    const { wo, werte } = bedingungen(f);
    if (f.vor !== undefined) {
      wo.push('id < ?');
      werte.push(f.vor);
    }
    const grenze = Math.min(Math.max(1, f.grenze ?? 500), MAX_GRENZE);
    const sql = `select ${SPALTEN} from telegramme ${klausel(wo)} order by zeit desc, id desc limit ?`;
    return einfach(this.db.prepare(sql).all(...werte, grenze)) as Eintrag[];
  }

  uebersicht(f: Filter): Zusammenfassung[] {
    const { wo, werte } = bedingungen(f);
    // Je Nachricht (Sender, Empfänger, PB/SB) die Zählung und die Werte des jüngsten Telegramms
    const sql = `
      with gruppe as (
        select qq, zz, pbsb, count(*) as anzahl, min(zeit) as erste, max(id) as letzte_id
        from telegramme ${klausel(wo)} group by qq, zz, pbsb
      )
      select g.qq, g.zz, g.pbsb, t.name, g.anzahl, g.erste, t.zeit as letzte, t.daten, t.antwort, t.text, t.status
      from gruppe g join telegramme t on t.id = g.letzte_id
      order by t.zeit desc`;
    return einfach(this.db.prepare(sql).all(...werte)) as Zusammenfassung[];
  }

  jeStunde(f: Filter): { stunde: number; anzahl: number }[] {
    const { wo, werte } = bedingungen(f);
    const sql = `select (zeit / 3600000) * 3600000 as stunde, count(*) as anzahl from telegramme ${klausel(wo)}
                 group by stunde order by stunde`;
    return einfach(this.db.prepare(sql).all(...werte)) as { stunde: number; anzahl: number }[];
  }

  kennzahlen(): { anzahl: number; aeltestes: number | null; neuestes: number | null } {
    const z = this.db.prepare('select count(*) as anzahl, min(zeit) as aeltestes, max(zeit) as neuestes from telegramme').get();
    return { ...z } as { anzahl: number; aeltestes: number | null; neuestes: number | null };
  }

  merke(schluessel: string, wert: unknown): void {
    this.db
      .prepare('insert into zustand (schluessel, wert) values (?, ?) on conflict (schluessel) do update set wert = excluded.wert')
      .run(schluessel, JSON.stringify(wert));
  }

  lese<T>(schluessel: string): T | null {
    const z = this.db.prepare('select wert from zustand where schluessel = ?').get(schluessel) as { wert: string } | undefined;
    return z ? (JSON.parse(z.wert) as T) : null;
  }

  /** Führt f in einer Transaktion aus: alles oder nichts, und viele Einfügungen auf einmal sind schnell. */
  alsEinheit<T>(f: () => T): T {
    this.db.exec('begin');
    try {
      const r = f();
      this.db.exec('commit');
      return r;
    } catch (e) {
      this.db.exec('rollback');
      throw e;
    }
  }

  /** Löscht alles, was älter als `tage` Tage vor `jetzt` ist, außer aus der Zeit eines Laufs. Gibt die Zahl gelöschter Telegramme zurück. */
  aufraeumen(jetzt: number, tage: number): number {
    const r = this.db
      .prepare(
        `delete from telegramme where zeit < ? and not exists (
           select 1 from laeufe l where telegramme.zeit between l.start - ? and coalesce(l.ende, ?) + ?)`,
      )
      .run(jetzt - tage * 86_400_000, RAND, jetzt, RAND);
    return Number(r.changes);
  }

  /** Alle Telegramme zwischen von und bis, aufsteigend nach Zeit (für das Protokoll eines Laufs). */
  telegrammeZwischen(von: number, bis: number): Eintrag[] {
    const sql = `select ${SPALTEN} from telegramme where zeit between ? and ? order by zeit, id limit 200000`;
    return einfach(this.db.prepare(sql).all(von, bis)) as Eintrag[];
  }

  neuerLauf(versuch: string, titel: string, start: number): number {
    const r = this.db.prepare("insert into laeufe (versuch, titel, start, status) values (?, ?, ?, 'laeuft')").run(versuch, titel, start);
    return Number(r.lastInsertRowid);
  }

  beendeLauf(id: number, ende: number, status: LaufStatus, fehler: string | null = null): void {
    this.db.prepare('update laeufe set ende = ?, status = ?, fehler = ? where id = ?').run(ende, status, fehler, id);
  }

  /** Läufe, die beim letzten Ende des Dienstes noch liefen, gelten als unterbrochen. */
  unterbrochen(jetzt: number): number {
    return Number(this.db.prepare("update laeufe set ende = ?, status = 'unterbrochen' where status = 'laeuft'").run(jetzt).changes);
  }

  lauf(id: number): LaufZeile | null {
    const z = this.db.prepare('select id, versuch, titel, start, ende, status, fehler from laeufe where id = ?').get(id);
    return z ? ({ ...z } as unknown as LaufZeile) : null;
  }

  laeufe(grenze = 100): LaufZeile[] {
    const sql = 'select id, versuch, titel, start, ende, status, fehler from laeufe order by start desc, id desc limit ?';
    return einfach(this.db.prepare(sql).all(grenze)) as LaufZeile[];
  }

  ereignis(lauf: number, e: NeuesEreignis): number {
    const ok = e.ok === undefined || e.ok === null ? null : e.ok ? 1 : 0;
    const r = this.db
      .prepare('insert into ereignisse (lauf, zeit, art, text, befehl, antwort, ok, ms) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(lauf, e.zeit, e.art, e.text ?? null, e.befehl ?? null, e.antwort ?? null, ok, e.ms ?? null);
    return Number(r.lastInsertRowid);
  }

  ereignisse(lauf: number): Ereignis[] {
    const sql = 'select id, lauf, zeit, art, text, befehl, antwort, ok, ms from ereignisse where lauf = ? order by id';
    return this.db
      .prepare(sql)
      .all(lauf)
      .map((z) => ({ ...z, ok: z.ok === null ? null : z.ok === 1 }) as unknown as Ereignis);
  }
}

function bedingungen(f: Filter): { wo: string[]; werte: SQLInputValue[] } {
  const wo: string[] = [];
  const werte: SQLInputValue[] = [];
  const dazu = (sql: string, wert: SQLInputValue | undefined) => {
    if (wert === undefined) return;
    wo.push(sql);
    werte.push(wert);
  };
  dazu('zeit >= ?', f.von);
  dazu('zeit <= ?', f.bis);
  dazu('pbsb = ?', f.pbsb);
  dazu('qq = ?', f.qq);
  dazu('zz = ?', f.zz);
  dazu('status = ?', f.status);
  return { wo, werte };
}

// node:sqlite liefert Zeilen ohne Prototyp; für JSON und Vergleiche einfache Objekte
function einfach(zeilen: object[]): object[] {
  return zeilen.map((z) => ({ ...z }));
}

function klausel(wo: string[]): string {
  return wo.length ? `where ${wo.join(' and ')}` : '';
}
