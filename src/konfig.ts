// Einstellungen aus der Umgebung, die mehr als eine Zahl sind.

/** TEILNEHMER="37=CWL,3c=CWL,fe=alle": Namen für Adressen am Bus, die die Oberfläche neben die Adresse schreibt. */
export function teilnehmer(wert: string | undefined): Record<string, string> {
  const aus: Record<string, string> = {};
  for (const teil of (wert ?? '').split(',').map((t) => t.trim()).filter(Boolean)) {
    const m = /^([0-9a-fA-F]{2})=([\p{L}\p{N} ._-]{1,30})$/u.exec(teil);
    if (!m) throw new Error(`TEILNEHMER: "${teil}" ist nicht Adresse=Name (zwei Hex-Ziffern, Name bis 30 Zeichen)`);
    aus[m[1]!.toLowerCase()] = m[2]!.trim();
  }
  return aus;
}
