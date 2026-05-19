// Uber Driver App — Sound Manager
// Handles order notification sound playback
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let orderSound: Sound | null = null;
let soundTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Play order notification sound (loops continuously)
 */
export function playOrderSound(): void {
  stopOrderSound(); // stop any existing sound
  orderSound = new Sound(
    'driver_app_order_ringtone.mp3',
    Sound.MAIN_BUNDLE,
    (err) => {
      if (!err && orderSound) {
        orderSound.setNumberOfLoops(-1); // loop indefinitely
        orderSound.setVolume(1.0);
        orderSound.play();
      }
    },
  );
}

/**
 * Stop order notification sound
 */
export function stopOrderSound(): void {
  if (orderSound) {
    orderSound.stop(() => {
      orderSound?.release();
      orderSound = null;
    });
  }
}

/**
 * Play order sound with auto-stop after 15 seconds
 * @param onTimeout callback when 15 seconds expire
 */
export function startOrderSoundWithTimeout(onTimeout?: () => void): void {
  playOrderSound();
  if (soundTimer) {
    clearTimeout(soundTimer);
  }
  soundTimer = setTimeout(() => {
    stopOrderSound();
    onTimeout?.();
  }, 15000);
}

/**
 * Cancel sound timer and stop sound
 */
export function cancelSoundTimer(): void {
  if (soundTimer) {
    clearTimeout(soundTimer);
    soundTimer = null;
  }
  stopOrderSound();
}
