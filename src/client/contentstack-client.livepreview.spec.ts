import { ContentstackClientService } from './contentstack-client.service';
import { readLivePreviewContext } from '../live-preview/live-preview-gate';

type Query = Record<string, string>;

function makeClient(opts: {
  active: boolean;
  boot?: string;
  stackConfig?: { live_preview?: { contentTypeUid?: string; entryUid?: string } };
}) {
  const calls: Query[] = [];
  const client = new ContentstackClientService(
    {} as never,
    {} as never,
    { warn: () => undefined } as never,
    {} as never,
    {} as object,
  );
  const internals = client as unknown as {
    _livePreviewActive: boolean;
    _bootContext: ReturnType<typeof readLivePreviewContext>;
    _stack: unknown;
  };
  internals._livePreviewActive = opts.active;
  internals._bootContext = readLivePreviewContext(opts.boot ?? '');
  internals._stack = {
    config: opts.stackConfig ?? {},
    livePreviewQuery: (q: Query) => calls.push(q),
  };
  return { client, calls };
}

describe('ContentstackClientService.applyLivePreviewContext', () => {
  it('forwards the hash and keeps the Timeline context from the boot URL', () => {
    const { client, calls } = makeClient({
      active: true,
      boot: '?live_preview=boot&release_id=rel1&preview_timestamp=2026-11-11T09:00:00Z',
    });
    client.applyLivePreviewContext('edit-hash');
    expect(calls).toEqual([
      {
        live_preview: 'edit-hash',
        release_id: 'rel1',
        preview_timestamp: '2026-11-11T09:00:00Z',
      },
    ]);
  });

  it('keeps forwarding Timeline on every later edit', () => {
    const { client, calls } = makeClient({ active: true, boot: '?release_id=rel1' });
    client.applyLivePreviewContext('h1');
    client.applyLivePreviewContext('h2');
    expect(calls.map((q) => q['release_id'])).toEqual(['rel1', 'rel1']);
  });

  it('omits Timeline keys outside a Timeline preview, so the SDK clears its headers', () => {
    const { client, calls } = makeClient({ active: true, boot: '?live_preview=boot' });
    client.applyLivePreviewContext('h');
    expect(calls[0]).toEqual({ live_preview: 'h' });
    expect('release_id' in calls[0]).toBe(false);
    expect('preview_timestamp' in calls[0]).toBe(false);
  });

  it('prefers the entry the SDK is editing over the one in the boot URL', () => {
    const { client, calls } = makeClient({
      active: true,
      boot: '?content_type_uid=landing_page&entry_uid=bootEntry',
      stackConfig: {
        live_preview: { contentTypeUid: 'cms_paragraph_component', entryUid: 'edited' },
      },
    });
    client.applyLivePreviewContext('h');
    expect(calls[0]).toMatchObject({
      content_type_uid: 'cms_paragraph_component',
      entry_uid: 'edited',
    });
  });

  it('falls back to the boot hash and does nothing without any hash', () => {
    const withBoot = makeClient({ active: true, boot: '?live_preview=boot' });
    withBoot.client.applyLivePreviewContext(undefined);
    expect(withBoot.calls[0]).toEqual({ live_preview: 'boot' });

    const none = makeClient({ active: true });
    none.client.applyLivePreviewContext(undefined);
    expect(none.calls).toEqual([]);
  });

  it('is a no-op when Live Preview is not active', () => {
    const { client, calls } = makeClient({ active: false, boot: '?release_id=rel1' });
    client.applyLivePreviewContext('h');
    expect(calls).toEqual([]);
  });
});
