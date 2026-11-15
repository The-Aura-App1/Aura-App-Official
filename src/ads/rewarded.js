import { withGpt } from './gpt';
import { REWARDED_UNIT } from './adsConfig';

// Shows one Google rewarded ad (web). Resolves once Google says the reward is
// earned (rewardedSlotGranted); rejects if no ad is available, it fails, or
// the person closes it early. The server pays only for a session it opened
// at least AD_MIN_WATCH seconds earlier (aura-aura watchAd).
export function watchRewardedAd() {
  return withGpt(googletag => new Promise((resolve, reject) => {
    const slot = googletag.defineOutOfPageSlot(REWARDED_UNIT, googletag.enums.OutOfPageFormat.REWARDED);
    if (!slot) { reject(new Error('Rewarded ads aren\'t available on this device yet.')); return; }
    slot.addService(googletag.pubads());
    const pubads = googletag.pubads();
    let granted = false;
    const done = (fn, value) => {
      pubads.removeEventListener('rewardedSlotReady', onReady);
      pubads.removeEventListener('rewardedSlotGranted', onGranted);
      pubads.removeEventListener('rewardedSlotClosed', onClosed);
      pubads.removeEventListener('slotRenderEnded', onRendered);
      googletag.destroySlots([slot]);
      fn(value);
    };
    const onReady = e => { if (e.slot === slot) e.makeRewardedVisible(); };
    const onGranted = e => { if (e.slot === slot) granted = true; };
    const onClosed = e => {
      if (e.slot !== slot) return;
      if (granted) done(resolve, true);
      else done(reject, new Error('Watch the whole ad to earn the aura.'));
    };
    const onRendered = e => { if (e.slot === slot && e.isEmpty) done(reject, new Error('No ad is available right now. Try again in a bit.')); };
    pubads.addEventListener('rewardedSlotReady', onReady);
    pubads.addEventListener('rewardedSlotGranted', onGranted);
    pubads.addEventListener('rewardedSlotClosed', onClosed);
    pubads.addEventListener('slotRenderEnded', onRendered);
    googletag.display(slot);
  }));
}
