// CSInterface wrapper for Adobe CEP panel interaction
var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

function CSInterface() {
    this.checkAdobeCep = function() {
        return (typeof window.__adobe_cep__ !== 'undefined');
    };
}

CSInterface.prototype.evalScript = function(script, callback) {
    if (this.checkAdobeCep()) {
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Fallback mock for browser-based testing / debugging
        console.warn("CSInterface not running inside Adobe. Mocking evalScript for: ", script);
        if (callback) {
            if (script.indexOf("getActiveInfo") !== -1) {
                callback(JSON.stringify({
                    success: true,
                    width: 1080,
                    height: 1920,
                    name: "Mock 9:16 Comp",
                    aspectRatio: "0.563"
                }));
            } else if (script.indexOf("analyzeLayers") !== -1) {
                callback(JSON.stringify({
                    success: true,
                    layers: [
                        { name: "My Title Text", index: 1, status: "critical", violations: ["Username & Caption"], bounds: { left: 50, top: 1600, right: 600, bottom: 1700 } },
                        { name: "Subscribe Callout", index: 2, status: "warning", violations: ["Header Navigation"], bounds: { left: 400, top: 50, right: 800, bottom: 120 } }
                    ]
                }));
            } else if (script.indexOf("createOverlay") !== -1 || script.indexOf("fixLayers") !== -1) {
                callback(JSON.stringify({ success: true, fixedCount: 2 }));
            } else {
                callback(JSON.stringify({ success: true }));
            }
        }
    }
};

CSInterface.prototype.getSystemPath = function(pathType) {
    if (this.checkAdobeCep()) {
        return window.__adobe_cep__.getSystemPath(pathType);
    }
    return "";
};

CSInterface.prototype.getHostEnvironment = function() {
    if (this.checkAdobeCep()) {
        try {
            return JSON.parse(window.__adobe_cep__.getHostEnvironment());
        } catch (e) {
            return { appId: "UNKNOWN" };
        }
    }
    return { appId: "UNKNOWN" };
};

CSInterface.prototype.getApplicationID = function() {
    if (this.checkAdobeCep()) {
        try {
            var hostInfo = JSON.parse(window.__adobe_cep__.getHostEnvironment());
            if (hostInfo && hostInfo.appId) return hostInfo.appId;
        } catch (e) {
            return "UNKNOWN";
        }
    }
    return "UNKNOWN";
};

CSInterface.prototype.closeExtension = function() {
    if (this.checkAdobeCep()) {
        window.__adobe_cep__.closeExtension();
    }
};
