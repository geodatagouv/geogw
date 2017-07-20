'use strict'

const { Router } = require('express')
const handleLinkAnalyzerIncomingWebHook = require('./linkAnalyzer').handleIncomingWebHook

const router = new Router()

router.post('/link-analyzer', handleLinkAnalyzerIncomingWebHook)

module.exports = router
