import { GPT_LIMITED_URL } from './adsConfig';

// Loads Google Publisher Tag once, from the Limited Ads address, and turns on
// every privacy setting before any ad is requested. Ads never load in tests or
// on the server.
let ready = null;

export function loadGpt() {
  if (ready) return ready;
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return Promise.reject(new Error('Ads are off here.'));
  ready = new Promise((resolve, reject) => {
    window.googletag = window.googletag || { cmd: [] };
    const script = document.createElement('script');
    script.async = true;
    script.src = GPT_LIMITED_URL;
    script.crossOrigin = 'anonymous';
    script.onerror = () => { ready = null; reject(new Error('Ads were blocked or could not load.')); };
    document.head.appendChild(script);
    window.googletag.cmd.push(() => {
      const pubads = window.googletag.pubads();
      pubads.setPrivacySettings({ limitedAds: true, nonPersonalizedAds: true, restrictDataProcessing: true });
      pubads.collapseEmptyDivs();
      pubads.enableLazyLoad({ fetchMarginPercent: 100, renderMarginPercent: 50, mobileScaling: 2 });
      window.googletag.enableServices();
      resolve(window.googletag);
    });
  });
  return ready;
}

// Runs fn(googletag) once GPT is ready
export function withGpt(fn) {
  return loadGpt().then(googletag => new Promise(resolve => googletag.cmd.push(() => resolve(fn(googletag)))));
}
