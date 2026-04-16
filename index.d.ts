export interface StreamConfig {
  type: "valkey" | "rabbitmq";
  host?: string;
  port?: number;
  url?: string;
  group?: string;
}

export class StreamClient {
  connect(): Promise<void>;
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: Function): Promise<void>;
  disconnect(): Promise<void>;
}

export function createClient(config: StreamConfig): Promise<StreamClient>;

export class WebSocketServer {
  constructor(port: number);
  broadcast(channel: string, message: any): void;
}
