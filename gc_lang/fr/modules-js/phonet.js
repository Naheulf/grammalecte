// Grammalecte - Suggestion phonétique

if (typeof(require) !== 'undefined') {
    var helpers = require("resource://grammalecte/helpers.js");
}


var phonet = {
    _dWord: {},
    _lSet: [],
    _dMorph: {},

    init: function (sJSONData) {
        try {
            let _oData = JSON.parse(sJSONData);
            this._dWord = helpers.objectToMap(_oData.dWord);
            this._lSet = _oData.lSet;
            this._dMorph = helpers.objectToMap(_oData.dMorph);
        }
        catch (e) {
            console.error(e);
        }
    },

    hasSimil: function (sWord, sPattern=null) {
        // return True if there is list of words phonetically similar to sWord
        if (!sWord) {
            return false;
        }
        if (this._dWord.has(sWord)) {
            if (sPattern) {
                return this.getSimil(sWord).some(sSimil => this._dMorph.gl_get(sSimil, []).some(sMorph => sMorph.search(sPattern) >= 0));
            }
            return true;
        }
        if (sWord.slice(0,1).gl_isUpperCase()) {
            sWord = sWord.toLowerCase();
            if (this._dWord.has(sWord)) {
                if (sPattern) {
                    return this.getSimil(sWord).some(sSimil => this._dMorph.gl_get(sSimil, []).some(sMorph => sMorph.search(sPattern) >= 0));
                }
                return true;
            }
        }
        return false;
    },

    getSimil: function (sWord) {
        // return list of words phonetically similar to sWord
        if (!sWord) {
            return [];
        }
        if (this._dWord.has(sWord)) {
            return this._lSet[this._dWord.get(sWord)];
        }
        if (sWord.slice(0,1).gl_isUpperCase()) {
            sWord = sWord.toLowerCase();
            if (this._dWord.has(sWord)) {
                return this._lSet[this._dWord.get(sWord)];
            }
        }
        return [];
    },

    selectSimil: function (sWord, sPattern) {
        // return list of words phonetically similar to sWord and whom POS is matching sPattern
        if (!sPattern) {
            return new Set(this.getSimil(sWord));
        }
        let aSelect = new Set();
        for (let sSimil of this.getSimil(sWord)) {
            for (let sMorph of this._dMorph.gl_get(sSimil, [])) {
                if (sMorph.search(sPattern) >= 0) {
                    aSelect.add(sSimil);
                }
            }
        }
        return aSelect;
    }
}


// Initialization
if (typeof(browser) !== 'undefined') {
    // WebExtension
    phonet.init(helpers.loadFile(browser.extension.getURL("grammalecte/fr/phonet_data.json")));
} else if (typeof(require) !== 'undefined') {
    // Add-on SDK and Thunderbird
    phonet.init(helpers.loadFile("resource://grammalecte/fr/phonet_data.json"));
} else {
    console.log("Error: Impossible d’initialiser le module phonet");
}


if (typeof(exports) !== 'undefined') {
    exports._dWord = phonet._dWord;
    exports._lSet = phonet._lSet;
    exports._dMorph = phonet._dMorph;
    exports.init = phonet.init;
    exports.hasSimil = phonet.hasSimil;
    exports.getSimil = phonet.getSimil;
    exports.selectSimil = phonet.selectSimil;
}
