import { describe, expect, it } from 'vitest';
import { type AnalysisFormValues, parseChannelInput, validateAnalysisForm } from './validation';

const TODAY = '2026-11-11';
const ID = 'UCabcdefghijklmnopqrstuv'; // UC + 22 chars

describe('parseChannelInput', () => {
  it.each([
    ['@CreatorLab', '@creatorlab'],
    ['creator.lab', '@creator.lab'],
    ['  @mkbhd  ', '@mkbhd'],
    ['https://www.youtube.com/@CreatorLab', '@creatorlab'],
    ['youtube.com/@creator_lab/videos', '@creator_lab'],
    ['m.youtube.com/@creatorlab', '@creatorlab'],
  ])('normalizes handle %s → %s', (input, expected) => {
    expect(parseChannelInput(input)).toEqual({ ok: true, channel: { kind: 'handle', value: expected } });
  });

  it('accepts channel IDs and channel URLs, keeping case', () => {
    expect(parseChannelInput(ID)).toEqual({ ok: true, channel: { kind: 'id', value: ID } });
    expect(parseChannelInput(`https://youtube.com/channel/${ID}`)).toEqual({
      ok: true,
      channel: { kind: 'id', value: ID },
    });
  });

  it.each([
    ['', /Enter a YouTube channel/],
    ['   ', /Enter a YouTube channel/],
    ['@ab', /3–30 characters/],
    [`@${'a'.repeat(31)}`, /3–30 characters/],
    ['@bad handle', /spaces/],
    ['@bad!handle', /only use letters/],
    ['https://youtu.be/dQw4w9WgXcQ', /video link/],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', /video link/],
    ['https://www.youtube.com/c/OldName', /Legacy/],
    ['https://vimeo.com/@someone', /YouTube/],
    ['ucabcdefghijklmnopqrstuv', /uppercase/],
  ])('rejects %j', (input, message) => {
    const result = parseChannelInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});

describe('validateAnalysisForm', () => {
  const valid: AnalysisFormValues = {
    channel: '@creatorlab',
    periodA: { start: '2026-05-01', end: '2026-07-31' },
    periodB: { start: '2026-08-01', end: '2026-10-31' },
  };

  it('returns no errors for a valid form', () => {
    expect(validateAnalysisForm(valid, TODAY)).toEqual({});
  });

  it('requires every date', () => {
    const errors = validateAnalysisForm({ ...valid, periodA: { start: '', end: '' } }, TODAY);
    expect(errors['periodA.start']).toMatch(/start date/);
    expect(errors['periodA.end']).toMatch(/end date/);
  });

  it('rejects a range that ends before it starts', () => {
    const errors = validateAnalysisForm({ ...valid, periodB: { start: '2026-10-31', end: '2026-08-01' } }, TODAY);
    expect(errors.periodB).toMatch(/starts after it ends/);
  });

  it('rejects future dates', () => {
    const errors = validateAnalysisForm({ ...valid, periodB: { start: '2026-11-01', end: '2026-11-12' } }, TODAY);
    expect(errors['periodB.end']).toMatch(/future/);
  });

  it('rejects overlapping periods', () => {
    const errors = validateAnalysisForm({ ...valid, periodB: { start: '2026-07-31', end: '2026-09-30' } }, TODAY);
    expect(errors.periodB).toMatch(/overlap/);
  });

  it('rejects periods longer than a year', () => {
    const errors = validateAnalysisForm({ ...valid, periodA: { start: '2024-01-01', end: '2025-06-30' } }, TODAY);
    expect(errors.periodA).toMatch(/longer than 366 days/);
  });

  it('rejects dates before YouTube existed', () => {
    const errors = validateAnalysisForm({ ...valid, periodA: { start: '2004-01-01', end: '2004-02-01' } }, TODAY);
    expect(errors['periodA.start']).toMatch(/April 2005/);
  });
});
