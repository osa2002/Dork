import { playChime } from "../../../lib/audio";

/**
 * Service to encapsulate browser/native audio interactions.
 */
export const audioService = {
  playChimeSound: (): void => {
    try {
      playChime();
    } catch (err) {
      console.warn("audioService: Failed to play chime sound", err);
    }
  }
};
