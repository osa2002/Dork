import { playNewTicketSound, playStatusUpdateSound, playChime } from "../lib/audio";

export const vendorAudioService = {
  playNewTicketSound(): void {
    playNewTicketSound();
  },

  playStatusUpdateSound(): void {
    playStatusUpdateSound();
  },

  playChime(): void {
    playChime();
  }
};
