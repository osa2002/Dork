import { TwinSnapshot } from "./TwinSnapshot";

export class TwinState {
  private readonly data: TwinSnapshot;

  constructor(data: TwinSnapshot) {
    this.data = Object.freeze(JSON.parse(JSON.stringify(data)));
  }

  public getData(): TwinSnapshot {
    return this.data;
  }

  /**
   * Creates a new TwinState with modified properties, keeping it stateless and immutable.
   */
  public update(updater: (draft: any) => void): TwinState {
    const draft = JSON.parse(JSON.stringify(this.data));
    updater(draft);
    return new TwinState(draft);
  }
}
