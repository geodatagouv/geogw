'use strict'

const { removeDiacritics } = require('natural')

exports.makeStringComparable = function (str) {
  return removeDiacritics(str)
    .replace(/(\s|-|'|,)/g, '')
    .toLowerCase()
}
