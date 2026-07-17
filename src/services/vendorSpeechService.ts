export const vendorSpeechService = {
  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  cancel(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.error("speechSynthesis.cancel failed", e);
      }
    }
  },

  speak(text: string, rate: number, isRtl: boolean, voiceLanguage: string): void {
    if (!this.isSupported()) return;
    try {
      this.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;

      const voices = window.speechSynthesis.getVoices();
      if (isRtl || voiceLanguage === "ar") {
        const arVoice = voices.find(v => v.lang.startsWith("ar"));
        if (arVoice) utterance.voice = arVoice;
        utterance.lang = "ar-EG";
      } else {
        const enVoice = voices.find(v => v.lang.startsWith("en"));
        if (enVoice) utterance.voice = enVoice;
        utterance.lang = "en-US";
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("speechSynthesis.speak failed", e);
    }
  }
};
