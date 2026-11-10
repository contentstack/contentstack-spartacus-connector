import { firstValueFrom } from 'rxjs';
import { ContentstackClientService } from './contentstack-client.service';

/**
 * By-uid fetches feed the component adapter, which Spartacus calls for every
 * mounted component on a language switch. Their results must normalize exactly
 * like the page payload's referenced entries.
 */
function makeClient(entries: Record<string, unknown>[]) {
  const calls = { includeReference: [] as unknown[] };
  const chain = {
    includeReference: (...refs: unknown[]) => (calls.includeReference.push(refs), chain),
    locale: () => chain,
    includeFallback: () => chain,
    query: () => ({ where: () => ({ find: async () => ({ entries }) }) }),
    fetch: async () => entries[0],
  };
  const client = new ContentstackClientService(
    { contentstack: {} } as never,
    { hasKey: () => false, set: () => undefined } as never,
    { warn: () => undefined, error: () => undefined } as never,
    { cacheKeySuffix: () => '' } as never,
    'browser',
  );
  const internals = client as unknown as { _stack: unknown; _livePreviewActive: boolean };
  internals._livePreviewActive = false;
  internals._stack = { contentType: () => ({ entry: () => chain }) };
  return { client, calls };
}

describe('ContentstackClientService by-uid fetches', () => {
  it('stamps the queried content type on entries (query results lack _content_type_uid)', async () => {
    const { client } = makeClient([{ uid: 'blt1' }]);
    const [entry] = await firstValueFrom(
      client.getEntriesByUids('simple_banner_component', ['blt1'], 'de'),
    );
    expect(entry._content_type_uid).toBe('simple_banner_component');
    const single = await firstValueFrom(
      client.getEntryByUid('simple_banner_component', 'blt1', 'de'),
    );
    expect(single?._content_type_uid).toBe('simple_banner_component');
  });

  it('keeps a content type the entry already carries', async () => {
    const { client } = makeClient([{ uid: 'blt1', _content_type_uid: 'own_type' }]);
    const [entry] = await firstValueFrom(client.getEntriesByUids('other_type', ['blt1']));
    expect(entry._content_type_uid).toBe('own_type');
  });

  it('expands the requested references, and none by default', async () => {
    const { client, calls } = makeClient([{ uid: 'blt1' }]);
    await firstValueFrom(client.getEntriesByUids('category_navigation_flat', ['blt1']));
    expect(calls.includeReference).toEqual([]);
    await firstValueFrom(
      client.getEntriesByUids('category_navigation_flat', ['blt1'], 'de', undefined, [
        'all_nodes',
        'all_nodes.links',
      ]),
    );
    await firstValueFrom(
      client.getEntryByUid('category_navigation_flat', 'blt1', 'de', undefined, ['all_nodes']),
    );
    expect(calls.includeReference).toEqual([[['all_nodes', 'all_nodes.links']], [['all_nodes']]]);
  });
});
