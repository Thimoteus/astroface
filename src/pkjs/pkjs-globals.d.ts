export {};

declare global {
  type AppMessageDict = Record<string | number, string | number | boolean | Array<number>>;

  interface AppMessageEvent {
    payload: AppMessageDict;
  }

  interface PebbleReadyEvent {}

  interface ActiveWatchInfo {
    platform: string;
    model: string;
    language: string;
    firmware: {
      major: number;
      minor: number;
      patch: number;
      suffix: string;
    };
  }

  interface PebbleStatic {
    addEventListener(event: "ready", cb: (e: PebbleReadyEvent) => void): void;
    addEventListener(event: "appmessage", cb: (e: AppMessageEvent) => void): void;
    addEventListener(event: "showConfiguration", cb: () => void): void;
    addEventListener(event: "webviewclosed", cb: (e: { response: string }) => void): void;

    removeEventListener(event: string, cb: (...args: unknown[]) => void): void;

    sendAppMessage(
      dict: AppMessageDict,
      onSuccess?: (e: { data: { transactionId: number } }) => void,
      // The bridge's failure payload is not documented and is NOT shaped like
      // { error: { message } }; treat it as unknown and print it with describe().
      onError?: (e: unknown) => void
    ): number;

    getAccountToken(): string;
    getWatchToken(): string;
    getActiveWatchInfo(): ActiveWatchInfo;
    showSimpleNotificationOnPebble(title: string, body: string): void;
  }

  const Pebble: PebbleStatic;
}
