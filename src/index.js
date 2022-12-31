window["StatsigABHelper"] = window["StatsigABHelper"] || {
  getCookie: function(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) {
      return match[2];
    }
  },

  setCookie: function(name, value) {
    document.cookie = `${name}=${value}; max-age=31536000; path=/`;
  },

  getStableID: function() {
    const key = 'statsig_stable_id';
    let sid = this.getCookie(key);
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).substring(2);
      this.setCookie(key, sid);
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
          userId: sid,
          customIDs: {
            stableID: sid,
          }
        },
        configName: experimentId,
      }),
    });

    if (resp.ok) {
      return await resp.json();
    }
  },

  redirectToUrl: function(url) {
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(url, window.location.href);
    if (currentUrl.pathname == newUrl.pathname) {
      StatsigABHelper.resetBody();
      return;
    }
    window.location.replace(url);
  },

  performRedirect: function(apiKey, experimentId) {
    this.getExperimentConfig(apiKey, experimentId)
      .then(config => {
        const url = config?.value?.page_url;
        if (url) {
          this.redirectToUrl(url);
          return;
        }
      })
      .catch((reason) => {
        console.log(reason);
        StatsigABHelper.resetBody();
      })
      .finally(() => {
      });      
  },

  resetBody: function() {
    const sbpd = document.getElementById('__sbpd');
    if (sbpd) {
      sbpd.parentElement.removeChild(sbpd);
    }
  }
}

if (document.currentScript && document.currentScript.src) {
  const url = new URL(document.currentScript.src);
  const apiKey = url.searchParams.get('apikey');
  const expId = url.searchParams.get('expid');
  if (apiKey && expId) {
    document.write('<style id="__sbpd">body { display: none; }</style>');
    StatsigABHelper.performRedirect(apiKey, expId);
  }
}