class SessionClient {
  private sessionId: string;
  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  getSessionId() {
    return this.sessionId;
  }
}

export default SessionClient;
