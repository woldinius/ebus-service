import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teilnehmer } from './konfig.ts';

test('TEILNEHMER: Adresse=Name, durch Komma getrennt, Adressen klein', () => {
  assert.deepEqual(teilnehmer('37=CWL, 3C=CWL,fe=alle'), { '37': 'CWL', '3c': 'CWL', fe: 'alle' });
  assert.deepEqual(teilnehmer(''), {});
  assert.deepEqual(teilnehmer(undefined), {});
});

test('TEILNEHMER: Unsinn bricht den Start ab, statt still falsche Namen zu zeigen', () => {
  for (const falsch of ['37', '377=CWL', 'xy=CWL', '37=', '37=<b>']) assert.throws(() => teilnehmer(falsch), falsch);
});
