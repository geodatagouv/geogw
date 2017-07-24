'use strict'

const fs = require('fs')
const path = require('path')

// recursively walk modules path and callback for each file
function walk(modulesPath, excludeDir, callback) {
  fs.readdirSync(modulesPath).forEach(function(file) {
    const newPath = path.join(modulesPath, file)
    const stat = fs.statSync(newPath)
    if (stat.isFile() && /(.*)\.(js|coffee)$/.test(file)) {
      callback(newPath)
    } else if (stat.isDirectory() && file !== excludeDir) {
      walk(newPath, excludeDir, callback)
    }
  })
}

module.exports = walk
