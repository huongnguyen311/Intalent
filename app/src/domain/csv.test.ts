import { toCsv } from './csv';

describe('toCsv', () => {
  it('csv quotes commas and quotes', () => {
    const out = toCsv([{ name: 'Lê, Minh "Châu"', total: 170 }]);
    expect(out).toBe('name,total\r\n"Lê, Minh ""Châu""",170');
  });

  it('quotes embedded line breaks and leaves plain cells bare', () => {
    expect(toCsv([{ a: 'x\ny', b: 'plain' }])).toBe('a,b\r\n"x\ny",plain');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});
