import { api } from "./api";
import type { ThreadMessage } from "./threads";

/** One detail request at a time, paced below two requests/second. */
export class MailLoader {
  private cache = new Map<string, ThreadMessage>();
  private pending = new Map<string, Promise<ThreadMessage>>();
  private queue: { run: () => Promise<void>; cancel: () => void }[] = [];
  private running = false;
  private disposed = false;

  constructor(private onLoaded: () => void) {}

  private key(mail: ThreadMessage) {
    return `${mail.direction}:${mail.id}`;
  }
  peek(mail: ThreadMessage) {
    return this.cache.get(this.key(mail));
  }

  get(mail: ThreadMessage, priority = true): Promise<ThreadMessage> {
    if (this.disposed) return Promise.reject(new Error("Connection changed."));
    const key = this.key(mail);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const promise = new Promise<ThreadMessage>((resolve, reject) => {
      const item = {
        cancel: () => reject(new Error("Connection changed.")),
        run: async () => {
          try {
            const full =
              mail.direction === "received"
                ? await api.getReceived(mail.id)
                : await api.getSent(mail.id);
            if (this.disposed) {
              item.cancel();
              return;
            }
            const result = { ...mail, ...full, direction: mail.direction };
            this.cache.set(key, result);
            this.onLoaded();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.pending.delete(key);
          }
        },
      };
      if (priority) this.queue.unshift(item);
      else this.queue.push(item);
    });
    this.pending.set(key, promise);
    void this.drain();
    return promise;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    while (!this.disposed && this.queue.length) {
      await this.queue.shift()!.run();
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    this.running = false;
  }

  dispose() {
    this.disposed = true;
    this.queue.splice(0).forEach((item) => item.cancel());
    this.cache.clear();
  }
}
