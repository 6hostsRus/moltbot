import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MemvidClient } from '../MemvidClient';
import { archive_session } from './archive_session';
import { memvidSearch } from './memvid_search';
import { memvidAsk } from './memvid_ask';
import { memvidStore } from './memvid_store';
import { memvidTimeline } from './memvid_timeline';
import { memvidView } from './memvid_view';
import { memvidEnrich } from './memvid_enrich';
import { memvidStats } from './memvid_stats';
import { memvidForget } from './memvid_forget';
import { memvidRepair } from './memvid_repair';
import { capacityCheck } from './capacity_check';
import { capacityExpand } from './capacity_expand';

export const mergeTools = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) => {
     // TODO: there should be a way to just... dynamically register
     // these based on files in the tools directory.
     // Register tools
     archive_session(api, memvidClient);
     memvidSearch(api, memvidClient);
     memvidAsk(api, memvidClient);
     memvidStore(api, memvidClient);
     memvidTimeline(api, memvidClient);
     memvidView(api, memvidClient);
     memvidStats(api, memvidClient);
     memvidEnrich(api, memvidClient);
     memvidForget(api, memvidClient);
     memvidRepair(api, memvidClient);
     capacityCheck(api, memvidClient);
     capacityExpand(api, memvidClient);
};
