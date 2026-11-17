import { describe, expect, it } from 'vitest';
import { objectContains } from '../foldagent_rules';
import cases from './fixtures/objectContainsCases.json';

describe('FoldAgent JSON containment compatibility cases', () => {
  for (const sample of cases) {
    it(sample.name, () => expect(objectContains(sample.actual, sample.expected)).toBe(sample.passed));
  }
});
