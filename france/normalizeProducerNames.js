const csvParse = require('csv-parse/lib/sync');
const { readFileSync } = require('fs');
const { removeDiacritics } = require('natural');

const rawData = readFileSync(__dirname + '/data/normalized_producers.csv', { encoding: 'utf8' });
const parsedData = csvParse(rawData, { columns: true });
const renameIndex = {};
const errorIndex = {};

parsedData.forEach(entry => {
  if (entry.producer_type === '90 Non rempli & Erreurs probables') {
    errorIndex[entry.producer_not_harmonized] = true;
  } else {
    renameIndex[entry.producer_not_harmonized] = entry.producer_harmonized;
  }
});

function prepare(typo) {
  return removeDiacritics(typo.toLowerCase()).trim();
}

function normalize(producerName) {
  const preparedTypo = prepare(producerName);
  if (preparedTypo in errorIndex) throw new Error('Rejected value');
  if (preparedTypo in renameIndex) return renameIndex[preparedTypo];
  return producerName;
}

module.exports = normalize;
