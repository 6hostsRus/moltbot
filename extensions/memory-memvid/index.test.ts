import { describe, it, expect, beforeEach } from "vitest";
import memvidPlugin from "./index.js";
import { DEFAULT_CONFIG } from "./src/types/types.js";
import { mergeConfig } from "./src/utils/config.js";

describe("memory-memvid plugin", () => {
  it("should export plugin object with correct properties", () => {
    expect(memvidPlugin.id).toBe("memory-memvid");
    expect(memvidPlugin.name).toBe("Memory (Memvid)");
    expect(memvidPlugin.kind).toBe("memory");
    expect(memvidPlugin.description).toContain("Memvid");
    expect(typeof memvidPlugin.register).toBe("function");
  });

  it("should have valid config schema", () => {
    expect(memvidPlugin.configSchema).toBeDefined();
  });

  describe("config", () => {
    it("should merge user config with defaults", () => {
      const userConfig = {
        memvidPath: "/custom/path/memvid",
        autoCapture: false,
      };

      const merged = mergeConfig(userConfig);

      expect(merged.memvidPath).toBe("/custom/path/memvid");
      expect(merged.autoCapture).toBe(false);
      expect(merged.autoRecall).toBe(DEFAULT_CONFIG.autoRecall);
      expect(merged.archivesDir).toBe(DEFAULT_CONFIG.archivesDir);
    });

    it("should use default values when user config is empty", () => {
      const merged = mergeConfig({});

      expect(merged.memvidPath).toBe(DEFAULT_CONFIG.memvidPath);
      expect(merged.archivesDir).toBe(DEFAULT_CONFIG.archivesDir);
      expect(merged.enrichmentEngine).toBe(DEFAULT_CONFIG.enrichmentEngine);
      expect(merged.autoCapture).toBe(DEFAULT_CONFIG.autoCapture);
      expect(merged.autoRecall).toBe(DEFAULT_CONFIG.autoRecall);
      expect(merged.ticketSource).toBe(DEFAULT_CONFIG.ticketSource);
      expect(merged.ticketIssuer).toBe(DEFAULT_CONFIG.ticketIssuer);
    });

    it("should resolve environment variables", () => {
      process.env.TEST_MEMVID_PATH = "/env/memvid";
      const userConfig = {
        memvidPath: "${TEST_MEMVID_PATH}",
      };

      const merged = mergeConfig(userConfig);

      expect(merged.memvidPath).toBe("/env/memvid");
      delete process.env.TEST_MEMVID_PATH;
    });

    it("should use self-hosted as default ticket source", () => {
      const merged = mergeConfig({});
      expect(merged.ticketSource).toBe("self-hosted");
    });

    it("should use openclaw.local as default ticket issuer", () => {
      const merged = mergeConfig({});
      expect(merged.ticketIssuer).toBe("openclaw.local");
    });

    it("should default to auto-expand capacity", () => {
      const merged = mergeConfig({});
      expect(merged.autoExpandCapacity).toBe(true);
      expect(merged.capacityThresholdPercent).toBe(80);
    });
  });

  describe("plugin registration", () => {
    it("should register without errors", () => {
      const mockApi = {
        getConfig: () => ({}),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: () => {},
        registerCli: () => {},
        registerService: () => {},
        on: () => {},
        getAgentId: () => "test-agent",
      };

      expect(() => {
        memvidPlugin.register(mockApi as any);
      }).not.toThrow();
    });
  });

  describe("tool expectations", () => {
    const toolNames = [
      "memvid_archive_session",
      "memvid_search",
      "memvid_ask",
      "memvid_store",
      "memvid_timeline",
      "memvid_view",
      "memvid_stats",
      "memvid_forget",
      "memvid_enrich",
      "memvid_repair",
      "memvid_capacity_check",
      "memvid_capacity_expand",
    ];

    it("should register all expected tools", () => {
      const registeredTools: string[] = [];
      const mockApi = {
        getConfig: () => ({}),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: (tool: any) => {
          registeredTools.push(tool.name);
        },
        registerCli: () => {},
        registerService: () => {},
        on: () => {},
        getAgentId: () => "test-agent",
      };

      memvidPlugin.register(mockApi as any);

      for (const toolName of toolNames) {
        expect(registeredTools).toContain(toolName);
      }
    });
  });

  describe("CLI commands expectations", () => {
    it("should register CLI commands", () => {
      let cliRegistered = false;
      const mockApi = {
        getConfig: () => ({}),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: () => {},
        registerCli: () => {
          cliRegistered = true;
        },
        registerService: () => {},
        on: () => {},
        getAgentId: () => "test-agent",
      };

      memvidPlugin.register(mockApi as any);

      expect(cliRegistered).toBe(true);
    });
  });

  describe("lifecycle hooks", () => {
    it("should register lifecycle hooks when enabled", () => {
      const hooks: string[] = [];
      const mockApi = {
        getConfig: () => ({
          autoRecall: true,
          autoCapture: true,
          autoArchiveSessions: true,
        }),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: () => {},
        registerCli: () => {},
        registerService: () => {},
        on: (eventName: string) => {
          hooks.push(eventName);
        },
        getAgentId: () => "test-agent",
      };

      memvidPlugin.register(mockApi as any);

      expect(hooks).toContain("before_agent_start");
      expect(hooks).toContain("agent_end");
      expect(hooks.filter((h) => h === "agent_end").length).toBeGreaterThanOrEqual(2); // auto-capture + auto-archive
    });

    it("should not register hooks when disabled", () => {
      const hooks: string[] = [];
      const mockApi = {
        getConfig: () => ({
          autoRecall: false,
          autoCapture: false,
          autoArchiveSessions: false,
        }),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: () => {},
        registerCli: () => {},
        registerService: () => {},
        on: (eventName: string) => {
          hooks.push(eventName);
        },
        getAgentId: () => "test-agent",
      };

      memvidPlugin.register(mockApi as any);

      expect(hooks.length).toBe(0);
    });
  });

  describe("service registration", () => {
    it("should register service", () => {
      let serviceRegistered = false;
      const mockApi = {
        getConfig: () => ({}),
        resolvePath: (path: string) => path.replace("~", "/mock/home"),
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        registerTool: () => {},
        registerCli: () => {},
        registerService: () => {
          serviceRegistered = true;
        },
        on: () => {},
        getAgentId: () => "test-agent",
      };

      memvidPlugin.register(mockApi as any);

      expect(serviceRegistered).toBe(true);
    });
  });
});
