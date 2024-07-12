let adBlockingEnabled = false;
let adsBlockedCount = 0;

chrome.storage.local.get(['adBlockingEnabled', 'adsBlockedCount'], function(result) {
  adBlockingEnabled = result.adBlockingEnabled || false;
  adsBlockedCount = result.adsBlockedCount || 0;
  updateAdBlockingRules();
});

function updateAdBlockingRules() {
  const urlFilters = [
    "*://*.doubleclick.net/*",
    "*://*.googleadservices.com/*",
    "*://*.zedo.com/*",
    "*://*.adservice.google.com/*",
    "*://*.googlesyndication.com/*",
    "*://*.analytics.google.com/*",
    "*://*.google-analytics.com/*",
    "*://*.hotjar.com/*",
    "*://*.ads.youtube.com/*",
    "*://*.ad.youtube.com/*",
    "*://*/*cookie_notice*",
    "*://*/*cookie-policy*",
    "*://*.amazon-adsystem.com/*",
    "*://*.aaxads.com/*",
    "*://*.mads.amazon-adsystem.com/*",
    "*://*.ads-twitter.com/*",
    "*://*.ads-api.reddit.com/*",
    "*://*.ads.linkedin.com/*",
    "*://*.ads.reddit.com/*",
    "*://*.connect.facebook.net/*",
    "*://*.adtechus.com/*",
    "*://*.bidswitch.net/*",
    "*://*.pubmatic.com/*",
    "*://*.rubiconproject.com/*",
    "*://*.openx.net/*",
    "*://*.adnxs.com/*",
    "*://*.taboola.com/*",
    "*://*.criteo.com/*",
    "*://*.quantserve.com/*",
    "*://*.scorecardresearch.com/*",
    "*://*.mathtag.com/*",
    "*://*.rlcdn.com/*",
    "*://*.ib.adnxs.com/*",
    "*://*.contextweb.com/*",
    "*://*.advertising.com/*",
    "*://*.yldbt.com/*",
    "*://*.tracking.klick2contact.com/*",
    "*://*.tealium.com/*",
    "*://*.webtrends.com/*",
    "*://*.krxd.net/*",
    "*://*.bizographics.com/*",
    "*://*.bizographicscdn.com/*",
    "*://*.outbrain.com/*",
    "*://*.adcolony.com/*",
    "*://*.media.net/*",
    "*://*.googleanalytics.com/*",
    "*://*.mouseflow.com/*",
    "*://*.freshmarketer.com/*",
    "*://*.luckyorange.com/*",
    "*://pixel.facebook.com/*",
    "*://an.facebook.com/*",
    "*://analytics.pointdrive.linkedin.com/*",
    "*://ads.pinterest.com/*",
    "*://analytics.pinterest.com/*",
    "*://ads.tiktok.com/*",
    "*://analytics.tiktok.com/*",
    "*://ads-api.tiktok.com/*",
    "*://events.reddit.com/*",
    "*://events.redditmedia.com/*",
    "*://ads.yahoo.com/*",
    "*://analytics.yahoo.com/*",
    "*://samsungads.com/*",
    "*://adtago.s3.amazonaws.com/*",
    "*://analyticsengine.s3.amazonaws.com/*",
    "*://analytics.s3.amazonaws.com/*",
    "*://advice-ads.s3.amazonaws.com/*",
    "*://*.luckyorange.net/*",
    "*://stats.wp.com/*",
    "*://notify.bugsnag.com/*",
    "*://sessions.bugsnag.com/*",
    "*://api.bugsnag.com/*",
    "*://app.bugsnag.com/*",
    "*://browser.sentry-cdn.com/*",
    "*://app.getsentry.com/*",
    "*://extmaps-api.yandex.net/*",
    "*://appmetrica.yandex.ru/*",
    "*://adfstat.yandex.ru/*",
    "*://metrika.yandex.ru/*",
    "*://offerwall.yandex.net/*",
    "*://adfox.yandex.ru/*",
    "*://auction.unityads.unity3d.com/*",
    "*://webview.unityads.unity3d.com/*",
    "*://config.unityads.unity3d.com/*",
    "*://adserver.unityads.unity3d.com/*",
    "*://iot-eu-logser.realme.com/*",
    "*://iot-logser.realme.com/*",
    "*://bdapi-ads.realmemobile.com/*",
    "*://bdapi-in-ads.realmemobile.com/*",
    "*://api.ad.xiaomi.com/*",
    "*://data.mistat.xiaomi.com/*",
    "*://data.mistat.india.xiaomi.com/*",
    "*://data.mistat.rus.xiaomi.com/*",
    "*://sdkconfig.ad.xiaomi.com/*",
    "*://sdkconfig.ad.intl.xiaomi.com/*",
    "*://tracking.rus.miui.com/*",
    "*://adsfs.oppomobile.com/*",
    "*://adx.ads.oppomobile.com/*",
    "*://ck.ads.oppomobile.com/*",
    "*://data.ads.oppomobile.com/*",
    "*://metrics.data.hicloud.com/*",
    "*://metrics2.data.hicloud.com/*",
    "*://grs.hicloud.com/*",
    "*://logservice.hicloud.com/*",
    "*://logservice1.hicloud.com/*",
    "*://logbak.hicloud.com/*",
    "*://click.oneplus.cn/*",
    "*://open.oneplus.net/*",
    "*://samsungads.com/*",
    "*://smetrics.samsung.com/*",
    "*://nmetrics.samsung.com/*",
    "*://samsung-com.112.2o7.net/*",
    "*://analytics-api.samsunghealthcn.com/*",
    "*://iadsdk.apple.com/*",
    "*://metrics.icloud.com/*",
    "*://metrics.mzstatic.com/*",
    "*://api-adservices.apple.com/*",
    "*://books-analytics-events.apple.com/*",
    "*://weather-analytics-events.apple.com/*",
    "*://notes-analytics-events.apple.com/*",
    "*://ads-api.twitter.com/*",
    "*://log.pinterest.com/*",
    "*://trk.pinterest.com/*",
    "*://ads-sg.tiktok.com/*",
    "*://analytics-sg.tiktok.com/*",
    "*://business-api.tiktok.com/*",
    "*://ads.tiktok.com/*",
    "*://log.byteoversea.com/*",
    "*://geo.yahoo.com/*",
    "*://udc.yahoo.com/*",
    "*://udcm.yahoo.com/*",
    "*://analytics.query.yahoo.com/*",
    "*://partnerads.ysm.yahoo.com/*",
    "*://log.fc.yahoo.com/*",
    "*://gemini.yahoo.com/*",
    "*://adtech.yahooinc.com/*",
    "*://ads.facebook.com/*",
    "*://advertising.twitter.com/*",
    "*://ads-dev.pinterest.com/*",
    "*://d.reddit.com/*",
    "*://affiliationjs.s3.amazonaws.com/*",
    "*://advertising-api-eu.amazon.com/*",
    "*://securemetrics.apple.com/*",
    "*://supportmetrics.apple.com/*",
    "*://config.samsungads.com/*"
  ];

  const rules = urlFilters.map((urlFilter, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
    }
  }));

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: adBlockingEnabled ? rules : []
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getAdBlockingStatus') {
    sendResponse({ adBlockingEnabled });
  } else if (request.action === 'toggleAdBlocking') {
    adBlockingEnabled = !adBlockingEnabled;
    chrome.storage.local.set({ adBlockingEnabled }, function() {
      updateAdBlockingRules();
      sendResponse({ adBlockingEnabled });
    });
    return true; // Will respond asynchronously
  }
});
