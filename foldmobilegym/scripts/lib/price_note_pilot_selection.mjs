/** Select one caller-owned instance without changing the legacy chain scope. */
export function selectPriceNotePilot(argv, fixtureIds, controllerMode) {
  if (argv.includes('--fixture-id')) throw Error('Use --fixture-id=<known-instance-id>');
  const filters = argv.filter(arg => arg.startsWith('--fixture-id='));
  if (filters.length > 1) throw Error('Select exactly one pilot fixture');
  if (filters.length && !controllerMode) throw Error('Fixture selection requires controller mode');
  const fixtureId = filters.length ? filters[0].slice('--fixture-id='.length) : 'dev';
  if (controllerMode && (!fixtureId || !fixtureIds.includes(fixtureId))) throw Error('Unknown pilot fixture');
  return {
    fixtureId: controllerMode ? fixtureId : null,
    // Known IDs may contain path separators; reports remain a single sibling
    // directory, never a caller-selected path or part of the Vite runtime.
    outputSuffix: controllerMode && fixtureId !== 'dev' ? `_${encodeURIComponent(fixtureId)}` : '',
  };
}
