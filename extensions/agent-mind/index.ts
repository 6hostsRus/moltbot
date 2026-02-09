import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Memvid } from "@memvid/sdk";
import { DmConfigSchema, emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { Agent } from "undici";
import AgentClient from "./src/client/AgentClient";
import agentMindSchema from "./src/utils/config";

const agentMindPlugin = {
  id: "agent-mind",
  name: "Agent Mind",
  description:
    "A plugin designed to enhance the cognitive capabilities of agents by providing advanced reasoning, decision-making, and learning functionalities. Backed by Memvid, it enables agents to process and analyze information more effectively, leading to improved performance in complex tasks and dynamic environments.",
  kind: "memory",
  configSchema: agentMindSchema,
  register(api: OpenClawPluginApi) {
    let agentClient: AgentClient;
    const cfg = agentMindSchema.parse(api.pluginConfig);

    api.registerService({
      id: "agent-mind",
      start: (ctx) => {
        if (!api.pluginConfig?.enabled) {
          ctx.logger.info("Agent Mind plugin is disabled. Skipping initialization.");
          return;
        }
        ctx.logger.info("Agent Mind service started.");
        ctx.logger.info(`StateDir: ${ctx.stateDir}`);
        ctx.logger.info(`WorkspaceDir: ${ctx.workspaceDir}`);
        ctx.logger.info(`Plugin Config: ${JSON.stringify(api.pluginConfig)}`);
        ctx.logger.info(`Memory Save path: ${cfg.defaultMemorySubPath}`); // Log the config for debugging
      },
      stop: (ctx) => {
        ctx.logger.info("Agent Mind service stopped.");
      },
    });

    // Registration logic for the Agent Mind plugin goes here.
    // This may include registering tools, providers, or other functionalities that leverage Memvid for enhanced agent cognition.
  },
};

export default agentMindPlugin;
