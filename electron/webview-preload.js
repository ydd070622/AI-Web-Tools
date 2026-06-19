(function() {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN','zh','en'], configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'language', { get: () => 'zh-CN', configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true })
  } catch(e) {}
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true })
  } catch(e) {}

  // chrome.*
  try {
    const mf = function(){}; mf.toString = () => 'function () { [native code] }'
    if (!window.chrome) window.chrome = {}
    window.chrome.runtime = {
      connect: mf, sendMessage: mf,
      onMessage: { addListener: mf, removeListener: mf },
      onConnect: { addListener: mf, removeListener: mf },
      id: 'chrome', lastError: undefined,
      getManifest: () => ({ name:'Chrome', version:'130.0.6723.44', manifest_version:3 }),
    }
    window.chrome.app = {
      isInstalled: false, getIsInstalled: mf, getDetails: mf,
      InstallState: { DISABLED:'disabled', INSTALLED:'installed', NOT_INSTALLED:'not_installed' },
      RunningState: { CANNOT_RUN:'cannot_run', READY_TO_RUN:'ready_to_run', RUNNING:'running' },
    }
    window.chrome.webstore = {
      onInstallStageChanged: { addListener: mf, removeListener: mf },
      onDownloadProgress: { addListener: mf, removeListener: mf },
    }
    window.chrome.csi = mf
    window.chrome.loadTimes = mf
    if (!window.chrome.sessions) window.chrome.sessions = { getRecentlyClosed: mf }
    if (!window.chrome.extension) window.chrome.extension = { getURL: (p) => p, inIncognitoContext: false }
  } catch(e) {}

  // plugins
  try {
    class P { constructor(n) { this.name=n; this.filename=''; this.description=''; this.length=0 } item(){return null} namedItem(){return null} }
    var a = [new P('Chrome PDF Plugin'), new P('Chrome PDF Viewer'), new P('Native Client')]
    a[0].filename='internal-pdf-viewer'; a[0].description='Portable Document Format'
    a[1].filename='mhjfbmdgcfjbbpaeojofohoefgiehjai'
    a[2].filename='internal-nacl-plugin'
    Object.defineProperty(navigator, 'plugins', {
      get: () => { a.length=a.length; a.item=(i)=>a[i]||null; a.namedItem=(n)=>a.find(p=>p.name===n)||null; a.refresh=()=>{}; return a },
      configurable: true,
    })
  } catch(e) {}

  // userAgentData
  try {
    var brands = [
      { brand: 'Chromium', version: '130' },
      { brand: 'Not)A;Brand', version: '99' },
      { brand: 'Google Chrome', version: '130' },
    ]
    var fullVL = [
      { brand: 'Chromium', version: '130.0.6723.44' },
      { brand: 'Not)A;Brand', version: '99.0.0.0' },
      { brand: 'Google Chrome', version: '130.0.6723.44' },
    ]
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: brands,
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async () => ({
          brands: brands, mobile: false, platform: 'Windows',
          platformVersion: '10.0.0', architecture: 'x86', bitness: '64',
          model: '', uaFullVersion: '130.0.6723.44', fullVersionList: fullVL,
        }),
      }),
      configurable: true,
    })
  } catch(e) {}

  // clipboard permission
  try {
    var p = Permissions.prototype
    var _q = p.query
    p.query = function(d) {
      if (d && d.name === 'clipboard-read') return Promise.resolve({ state: 'prompt', onchange: null })
      return _q.call(this, d).catch(() => Promise.resolve({ state: 'prompt', onchange: null }))
    }
    p.query.toString = () => 'function query() { [native code] }'
  } catch(e) {}

  window.__lingworks_preloaded__ = true
})()
