const tld = require('tldjs');
const ipaddr = require('ipaddr.js');
const URI = require('urijs');

function checkUrl(location) {
  const urlObj = new URI(location);

  if (!urlObj.is('url') || urlObj.is('relative')) return false;
  if (urlObj.protocol() !== 'http' && urlObj.protocol() !== 'https') return false;
  if (!urlObj.is('ip') && !urlObj.is('name')) return false;

  if (urlObj.is('ip')) {
    const addr = ipaddr.parse(urlObj.hostname());
    const range = addr.range();
    const rangesToExclude = [
      'unspecified',
      'broadcast',
      'multicast',
      'linkLocal',
      'loopback',
      'private',
      'reserved'
    ];
    if (range && rangesToExclude.includes(range)) return false;
  }

  if (urlObj.is('name')) {
    if (!tld.tldExists(urlObj.hostname())) return false;
    if (urlObj.hostname().endsWith('ader.gouv.fr')) return false;
  }

  return true;
}

module.exports = checkUrl;
