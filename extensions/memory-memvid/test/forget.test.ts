import { describe, it, expect } from 'vitest';
import { ForgetCli } from '../src/cli/forget';

describe('forget CLI dry-run', () => {
  it('logs affected frames and does not call forget on dry-run', async () => {
    let registeredTool: any = null;
    const tempAudit = '/tmp/memvid-audit-test.log';
    process.env.MEMVID_AUDIT_LOG = tempAudit;

    const mockApi: any = {
      registerCli: (fn: any) => fn({ program: { command: () => ({ description: () => ({ command: () => ({ description: () => ({ argument: () => ({ option: () => ({ action: () => {} }) }) }) }) }) }) }) },
    };

    // Simpler mock: capture registration through a fake register function
    const api: any = {
      registerCli: (fn: any) => {
        // simulate commander wrapper
        const registered = { execute: null };
        const program = {
          command: () => ({ description: () => ({ command: () => ({ argument: () => ({ option: () => ({ action: (act: any) => { registered.execute = act; } }) }) }) }) })
        };
        fn({ program });
        registeredTool = registered;
      },
    };

    const sampleResults = [
      { frameId: 'f1' },
      { frameId: 'f2' },
    ];

    const mockClient: any = {
      validateArchiveDir: (name: string) => name,
      search: async (q: string, archive: string, limit: number) => sampleResults,
      forget: async (archive: string, id: string) => { throw new Error('should not be called in dry-run'); },
    };

    ForgetCli(api, mockClient);
    expect(registeredTool).not.toBeNull();

    // execute the registered action
    await registeredTool.execute('call', { archive: 'test', query: 'q', dryRun: true });

    // read audit log
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(tempAudit, 'utf-8');
    expect(content).toContain('forget-request');
    expect(content).toContain('f1');
    expect(content).toContain('f2');
  });
});
