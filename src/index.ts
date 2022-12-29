export default class {
  static getCookie(name: string) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) {
      return match[2];
    }
  }

  static setCookie(name: string, value: string) {
    document.cookie = `${name}=${value}; max-age=31536000; path=/`;
  }

  static getStableID() {
    const key = 'statsig_stable_id';
    let sid = this.getCookie(key);
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).substring(2);
      this.setCookie(key, sid);
    }
    return sid;
  }

  static async getExperimentConfig(
    apiKey: string,
    experimentName: string,
  ) {
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
        configName: experimentName,
      }),
    });

    if (resp.ok) {
      return await resp.json();
    }
  }

  static redirectToUrl(url: string) {
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(url, window.location.href);
    if (currentUrl.pathname == newUrl.pathname) {
      return;
    }
    window.location.replace(url);
  }

  static performRedirect(
    apiKey: string,
    experimentName: string,
  ) {
    this.getExperimentConfig(apiKey, experimentName)
      .then(config => {
        const url = config?.value?.page_url;
        if (url) {
          this.redirectToUrl(url);
          return;
        }
      })
      .catch((reason) => {
        console.log(reason);
      });
  }
}
