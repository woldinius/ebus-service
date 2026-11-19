// Namen für Telegramme aus den Nachrichtendefinitionen von ebusd (CSV, dieselbe Datei, die ebusd liest).
// Spalten: type,circuit,level,name,comment,qq,zz,pbsb,id,… Eine Nachricht passt, wenn PB/SB gleich sind und die Daten des
// Masters mit der Kennung (id) beginnen; die längste Kennung gewinnt. Werte deutet dieser Dienst nicht, das bleibt ebusd.
import type { Telegramm } from './telegramm.ts';

export interface Treffer {
  name: string;
  kommentar: string;
}

interface Eintrag extends Treffer {
  pbsb: string;
  id: string; // Hex ohne Leerzeichen, kann leer sein
}

// Allgemeine eBus-Dienste, die ohne Definition einen Namen bekommen (Anwendungsschicht der eBUS-Spezifikation)
const STANDARD: Eintrag[] = [
  { pbsb: 'fe01', id: '', name: 'Fehlermeldung', kommentar: 'eBus-Standard: Fehlercode als Text' },
  { pbsb: '0704', id: '', name: 'Identifikation', kommentar: 'eBus-Standard: erstes Datenbyte ist der Hersteller' },
];

export class Definitionen {
  eintraege: Eintrag[];

  constructor(eintraege: Eintrag[]) {
    // Längste Kennung zuerst, damit sie vor kürzeren passt
    this.eintraege = [...eintraege, ...STANDARD].sort((a, b) => b.id.length - a.id.length);
  }

  get anzahl(): number {
    return this.eintraege.length - STANDARD.length;
  }

  static ausCsv(csv: string): Definitionen {
    const eintraege: Eintrag[] = [];
    for (const zeile of csv.split(/\r?\n/)) {
      if (!zeile || zeile.startsWith('#') || zeile.startsWith('*') || zeile.startsWith('type,')) continue;
      const f = zeile.split(',');
      const [typ, , , name, kommentar, , , pbsb, id] = f;
      if (!typ || !name || !pbsb || !/^[rwu]/.test(typ) || !/^[0-9a-fA-F]{4}$/.test(pbsb)) continue;
      eintraege.push({ name, kommentar: kommentar ?? '', pbsb: pbsb.toLowerCase(), id: (id ?? '').toLowerCase() });
    }
    return new Definitionen(eintraege);
  }

  finde(t: Telegramm): Treffer | null {
    const daten = t.daten.replace(/ /g, '');
    const e = this.eintraege.find((x) => x.pbsb === t.pbsb && daten.startsWith(x.id));
    return e ? { name: e.name, kommentar: e.kommentar } : null;
  }
}
