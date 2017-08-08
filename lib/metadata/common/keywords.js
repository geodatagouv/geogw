'use strict'

exports.cleanKeywords = function (keywords = []) {
  return keywords.filter(k => k.length < 768)
}
