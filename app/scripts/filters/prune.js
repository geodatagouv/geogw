var _s = require('underscore.string');

module.exports = function () {
    return function (value, max) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        return _s.prune(value, max);
    };
};
