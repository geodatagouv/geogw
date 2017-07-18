const handleLinkAnalyzerIncomingWebHook = require('../linkAnalyzer').handleIncomingWebHook;

module.exports = function(app) {
    app.post('/hooks/link-analyzer', handleLinkAnalyzerIncomingWebHook);
};
