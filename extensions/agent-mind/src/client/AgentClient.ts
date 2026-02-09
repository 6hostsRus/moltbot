import { Memvid } from "@memvid/sdk";
import MemoryClient from "./MemoryClient";
import SessionClient from "./SessionClient";

class AgentClient {
  private agentMemory: MemoryClient;
  // private sessionClient: SessionClient;
  // TODO: Add a way to access the common knowledge all agents share,
  // or perhaps a way to attach / detach additional memory sources.

  constructor(memoryPath: string) {
    this.agentMemory = new MemoryClient(memoryPath);
    // this.sessionClient = new SessionClient(sessionId);
  }
}

export default AgentClient;
