// Speicher für die mitgelesenen Telegramme: eine SQLite-Datei, Zeit in Millisekunden seit 1970 (UTC).
// Aufbewahrt wird eine feste Zahl Tage (Standard 7), aufgeräumt per aufraeumen(), das main.ts regelmäßig aufruft.
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
`;

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

  /** Löscht alles, was älter als `tage` Tage vor `jetzt` ist. Gibt die Zahl gelöschter Telegramme zurück. */
  aufraeumen(jetzt: number, tage: number): number {
    const r = this.db.prepare('delete from telegramme where zeit < ?').run(jetzt - tage * 86_400_000);
    return Number(r.changes);
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
