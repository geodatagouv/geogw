'use strict'

const convertFromDublinCore = require('./dc').convert
const convertFromIso = require('./iso').convert

module.exports = {
  convertFromIso,
  convertFromDublinCore,
}
