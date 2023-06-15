window["StatsigABHelper"] = window["StatsigABHelper"] || {
  _redirKey: '_stsgnoredir',
  addStatsigSdk: function(apiKey, nonce) {
    const script = document.createElement('script');
    if (nonce) {
      script.nonce = nonce;
    }
    script.src = 'https://cdn.jsdelivr.net/npm/statsig-js';
    script.addEventListener('load', () => {
      StatsigABHelper._sdkLoaded = true;
      StatsigABHelper.setupStatsigSdk(apiKey);
    });
    document.head.appendChild(script);
  },

  getStableID: function() {
    const key = 'STATSIG_LOCAL_STORAGE_STABLE_ID';
    let sid = window.localStorage ? window.localStorage.getItem(key) : null;
    if (!sid) {
      sid = crypto.randomUUID();
      if (window.localStorage) {
        window.localStorage.setItem(key, sid);
      }
    }
    return sid;
  },

  getExperimentConfig: async function(apiKey, experimentId) {
    const sid = this.getStableID();
    const resp = await fetch('https://featuregates.org/v1/get_config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'statsig-api-key': apiKey,
      },
      body: JSON.stringify({
        user: {
          userID: sid,
          customIDs: {
            stableID: sid,
          },
          custom: {
            url: window.location.href,
            page_url: window.location.href,
            language: window.navigator.language,
          },
        },
        configName: experimentId,
      }),
    });

    if (resp.ok) {
      return await resp.json();
    }
  },

  performRedirect: function(apiKey, experimentId, nonce) {
    const currentUrl = new URL(window.location.href);

    // Force no redir
    if (currentUrl.searchParams.get(StatsigABHelper._redirKey)) {
      StatsigABHelper.resetBody();
      return;
    }

    this.getExperimentConfig(apiKey, experimentId)
      .then(config => {
        const url = config?.value?.page_url;
        if (url) {
          StatsigABHelper.redirectToUrl(apiKey, url, nonce);
          return;
        } else {
          // Could be in pre-start mode
          StatsigABHelper.resetBody();
        }
      })
      .catch((reason) => {
        console.log(reason);
        StatsigABHelper.resetBody();
      })
      .finally(() => {
      });      
  },

  redirectToUrl: function(apiKey, url) {
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(url, window.location.href);

    let cp = currentUrl.pathname;
    cp = cp.endsWith('/') ? cp.substring(0, cp.length - 1) : cp;
    let np = newUrl.pathname;
    np = np.endsWith('/') ? np.substring(0, np.length - 1) : np;
      
    if (cp === np) {
      StatsigABHelper._redirectFinished = true;
      StatsigABHelper.resetBody();
      StatsigABHelper.setupStatsigSdk(apiKey);
      return;
    }
    newUrl.searchParams.set(StatsigABHelper._redirKey, 1);
    window.location.replace(newUrl.href);
  },

  resetBody: function() {
    const sbpd = document.getElementById('__sbpd');
    if (sbpd) {
      sbpd.parentElement.removeChild(sbpd);
    }
  },

  setupStatsigSdk: function(apiKey) {
    if (!window['statsig']) {
      return;
    }
    if (!StatsigABHelper._redirectFinished || !StatsigABHelper._sdkLoaded) {
      return;
    }
    if (!window.statsig.instance) {
      statsig.initialize(apiKey, {});
    }
  },
}

if (document.currentScript && document.currentScript.src) {
  const url = new URL(document.currentScript.src);
  const apiKey = url.searchParams.get('apikey');
  const expId = url.searchParams.get('expid');
  if (apiKey && expId) {
    document.write('<style id="__sbpd">body { display: none; }</style>\n');
    StatsigABHelper.addStatsigSdk(apiKey, document.currentScript.nonce);
    StatsigABHelper.performRedirect(apiKey, expId);
  }
}