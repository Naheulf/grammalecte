//// IBDAWG
/*jslint esversion: 6*/
/*global console,require,exports*/

"use strict";


if (typeof(require) !== 'undefined') {
    var str_transform = require("resource://grammalecte/str_transform.js");
    var helpers = require("resource://grammalecte/helpers.js");
    var char_player = require("resource://grammalecte/char_player.js");
}


// Don’t remove <string>. Necessary in TB.
${string}
${map}
${set}


class SuggResult {
    // Structure for storing, classifying and filtering suggestions

    constructor (sWord, nDistLimit=-1) {
        this.sWord = sWord;
        this.sCleanWord = char_player.cleanWord(sWord);
        this.nDistLimit = (nDistLimit >= 0) ? nDistLimit :  Math.floor(sWord.length / 3) + 1;
        this.nMinDist = 1000;
        this.aSugg = new Set();
        this.dSugg = new Map([ [0, []],  [1, []] ]);
    }

    addSugg (sSugg, nDeep=0) {
        // add a suggestion
        if (!this.aSugg.has(sSugg)) {
            let nDist = str_transform.distanceDamerauLevenshtein(this.sCleanWord, char_player.cleanWord(sSugg));
            if (nDist <= this.nDistLimit) {
                if (!this.dSugg.has(nDist)) {
                    this.dSugg.set(nDist, []);
                }
                this.dSugg.get(nDist).push(sSugg);
                this.aSugg.add(sSugg);
                if (nDist < this.nMinDist) {
                    this.nMinDist = nDist;
                }
                this.nDistLimit = Math.min(this.nDistLimit, this.nMinDist+2);
            }
        }
    }

    getSuggestions (nSuggLimit=10, nDistLimit=-1) {
        // return a list of suggestions
        let lRes = [];
        if (this.dSugg.get(0).length) {
            // we sort the better results with the original word
            let dDistTemp = new Map();
            lRes.forEach((sSugg) => { dDistTemp.set(sSugg, str_transform.distanceDamerauLevenshtein(this.sWord, sSugg)); });
            lRes = lRes.sort((sA, sB) => { return dDistTemp.get(sA) - dDistTemp.get(sB); });
            dDistTemp.clear();
        }
        for (let lSugg of this.dSugg.values()) {
            for (let sSugg of lSugg) { lRes.push(sSugg); }
            if (lRes.length > nSuggLimit) {
                break;
            }
        }
        lRes = char_player.filterSugg(lRes);
        if (this.sWord.gl_isTitle()) {
            lRes = lRes.map((sSugg) => { return sSugg.gl_toCapitalize(); });
        }
        else if (this.sWord.gl_isUpperCase()) {
            lRes = lRes.map((sSugg) => { return sSugg.toUpperCase(); });
        }
        return lRes.slice(0, nSuggLimit);
    }

    reset () {
        this.aSugg.clear();
        this.dSugg.clear();
    }
}


class IBDAWG {
    // INDEXABLE BINARY DIRECT ACYCLIC WORD GRAPH

    constructor (sDicName, sPath="") {
        try {
            let sURL = (sPath !== "") ? sPath + "/" + sDicName : "resource://grammalecte/_dictionaries/"+sDicName;
            const dict = JSON.parse(helpers.loadFile(sURL));
            Object.assign(this, dict);
        }
        catch (e) {
            throw Error("# Error. File not found or not loadable.\n" + e.message + "\n");
        }
        /*
            Properties:
            sName, nVersion, sHeader, lArcVal, nArcVal, byDic, sLang, nChar, nBytesArc, nBytesNodeAddress,
            nEntries, nNode, nArc, nAff, cStemming, nTag, dChar, _arcMask, _finalNodeMask, _lastArcMask, _addrBitMask, nBytesOffset,
        */

        /*
            Bug workaround.
            Mozilla’s JS parser sucks. Can’t read file bigger than 4 Mb!
            So we convert huge hexadecimal string to list of numbers…
            https://github.com/mozilla/addons-linter/issues/1361
        */
        let lTemp = [];
        for (let i = 0;  i < this.byDic.length;  i+=2) {
            lTemp.push(parseInt(this.byDic.slice(i, i+2), 16));
        }
        this.byDic = lTemp;
        /* end of bug workaround */

        if (!this.sHeader.startsWith("/pyfsa/")) {
            throw TypeError("# Error. Not a pyfsa binary dictionary. Header: " + this.sHeader);
        }
        if (!(this.nVersion == "1" || this.nVersion == "2" || this.nVersion == "3")) {
            throw RangeError("# Error. Unknown dictionary version: " + this.nVersion);
        }
        // <dChar> to get the value of an arc, <dCharVal> to get the char of an arc with its value
        this.dChar = helpers.objectToMap(this.dChar);
        this.dCharVal = this.dChar.gl_reverse();
        //this.byDic = new Uint8Array(this.byDic);  // not quicker, even slower

        if (this.cStemming == "S") {
            this.funcStemming = str_transform.getStemFromSuffixCode;
        } else if (this.cStemming == "A") {
            this.funcStemming = str_transform.getStemFromAffixCode;
        } else {
            this.funcStemming = str_transform.noStemming;
        }

        // Configuring DAWG functions according to nVersion
        switch (this.nVersion) {
            case 1:
                this.morph = this._morph1;
                this.stem = this._stem1;
                this._lookupArcNode = this._lookupArcNode1;
                this._getArcs = this._getArcs1;
                this._writeNodes = this._writeNodes1;
                break;
            case 2:
                this.morph = this._morph2;
                this.stem = this._stem2;
                this._lookupArcNode = this._lookupArcNode2;
                this._getArcs = this._getArcs2;
                this._writeNodes = this._writeNodes2;
                break;
            case 3:
                this.morph = this._morph3;
                this.stem = this._stem3;
                this._lookupArcNode = this._lookupArcNode3;
                this._getArcs = this._getArcs3;
                this._writeNodes = this._writeNodes3;
                break;
            default:
                throw ValueError("# Error: unknown code: " + this.nVersion);
        }
        //console.log(this.getInfo());
        this.bOptNumSigle = true;
        this.bOptNumAtLast = false;
    }

    getInfo () {
        return  `  Language: ${this.sLang}      Version: ${this.nVersion}      Stemming: ${this.cStemming}FX\n` +
                `  Arcs values:  ${this.nArcVal} = ${this.nChar} characters,  ${this.nAff} affixes,  ${this.nTag} tags\n` +
                `  Dictionary: ${this.nEntries} entries,    ${this.nNode} nodes,   ${this.nArc} arcs\n` +
                `  Address size: ${this.nBytesNodeAddress} bytes,  Arc size: ${this.nBytesArc} bytes\n`;
    }

    isValidToken (sToken) {
        // checks if sToken is valid (if there is hyphens in sToken, sToken is split, each part is checked)
        if (this.isValid(sToken)) {
            return true;
        }
        if (sToken.includes("-")) {
            if (sToken.gl_count("-") > 4) {
                return true;
            }
            return sToken.split("-").every(sWord  =>  this.isValid(sWord)); 
        }
        return false;
    }

    isValid (sWord) {
        // checks if sWord is valid (different casing tested if the first letter is a capital)
        if (!sWord) {
            return null;
        }
        if (sWord.includes("’")) { // ugly hack
            sWord = sWord.replace("’", "'");
        }
        if (this.lookup(sWord)) {
            return true;
        }
        if (sWord.charAt(0).gl_isUpperCase()) {
            if (sWord.length > 1) {
                if (sWord.gl_isTitle()) {
                    return !!this.lookup(sWord.toLowerCase());
                }
                if (sWord.gl_isUpperCase()) {
                    if (this.bOptNumSigle) {
                        return true;
                    }
                    return !!(this.lookup(sWord.toLowerCase()) || this.lookup(sWord.gl_toCapitalize()));
                }
                return !!this.lookup(sWord.slice(0, 1).toLowerCase() + sWord.slice(1));
            } else {
                return !!this.lookup(sWord.toLowerCase());
            }
        }
        return false;
    }

    _convBytesToInteger (aBytes) {
        // Byte order = Big Endian (bigger first)
        let nVal = 0;
        let nWeight = (aBytes.length - 1) * 8;
        for (let n of aBytes) {
            nVal += n << nWeight;
            nWeight = nWeight - 8;
        }
        return nVal;
    }

    lookup (sWord) {
        // returns true if sWord in dictionary (strict verification)
        let iAddr = 0;
        for (let c of sWord) {
            if (!this.dChar.has(c)) {
                return false;
            }
            iAddr = this._lookupArcNode(this.dChar.get(c), iAddr);
            if (iAddr === null) {
                return false;
            }
        }
        return Boolean(this._convBytesToInteger(this.byDic.slice(iAddr, iAddr+this.nBytesArc)) & this._finalNodeMask);
    }

    getMorph (sWord) {
        // retrieves morphologies list, different casing allowed
        let l = this.morph(sWord);
        if (sWord[0].gl_isUpperCase()) {
            l = l.concat(this.morph(sWord.toLowerCase()));
            if (sWord.gl_isUpperCase() && sWord.length > 1) {
                l = l.concat(this.morph(sWord.gl_toCapitalize()));
            }
        }
        return l;
    }

    suggest (sWord, nMaxSugg=10) {
        // returns a array of suggestions for <sWord>
        let sPfx = "";
        let sSfx = "";
        [sPfx, sWord, sSfx] = char_player.cut(sWord);
        let nMaxSwitch = Math.max(Math.floor(sWord.length / 3), 1);
        let nMaxDel = Math.floor(sWord.length / 5);
        let nMaxHardRepl = Math.max(Math.floor((sWord.length - 5) / 4), 1);
        let oSuggResult = new SuggResult(sWord);
        this._suggest(oSuggResult, sWord, nMaxSwitch, nMaxDel, nMaxHardRepl);
        if (sWord.gl_isTitle()) {
            this._suggest(oSuggResult, sWord.toLowerCase(), nMaxSwitch, nMaxDel, nMaxHardRepl);
        }
        else if (sWord.gl_isLowerCase()) {
            this._suggest(oSuggResult, sWord.gl_toCapitalize(), nMaxSwitch, nMaxDel, nMaxHardRepl);
        }
        let aSugg = oSuggResult.getSuggestions();
        if (sSfx || sPfx) {
            // we add what we removed
            return aSugg.map( (sSugg) => { return sPfx + sSugg + sSfx } );
        }
        return aSugg;
    }

    _suggest (oSuggResult, sRemain, nMaxSwitch=0, nMaxDel=0, nMaxHardRepl=0, nDeep=0, iAddr=0, sNewWord="", bAvoidLoop=false) {
        // returns a set of suggestions
        // recursive function
        if (sRemain == "") {
            if (this._convBytesToInteger(this.byDic.slice(iAddr, iAddr+this.nBytesArc)) & this._finalNodeMask) {
                oSuggResult.addSugg(sNewWord);
            }
            for (let sTail of this._getTails(iAddr)) {
                oSuggResult.addSugg(sNewWord+sTail);
            }
            return;
        }
        let cCurrent = sRemain.slice(0, 1);
        for (let [cChar, jAddr] of this._getSimilarCharArcs(cCurrent, iAddr)) {
            this._suggest(oSuggResult, sRemain.slice(1), nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, jAddr, sNewWord+cChar);
        }
        if (!bAvoidLoop) { // avoid infinite loop
            if (sRemain.length > 1) {
                if (cCurrent == sRemain.slice(1, 2)) {
                    // same char, we remove 1 char without adding 1 to <sNewWord>
                    this._suggest(oSuggResult, sRemain.slice(1), nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord);
                }
                else {
                    // switching chars
                    if (nMaxSwitch > 0) {
                        this._suggest(oSuggResult, sRemain.slice(1, 2)+sRemain.slice(0, 1)+sRemain.slice(2), nMaxSwitch-1, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                    }
                    // delete char
                    if (nMaxDel > 0) {
                        this._suggest(oSuggResult, sRemain.slice(1), nMaxSwitch, nMaxDel-1, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                    }
                }
                // Phonetic replacements
                for (let sRepl of char_player.get1toXReplacement(sNewWord.slice(-1), cCurrent, sRemain.slice(1,2))) {
                    this._suggest(oSuggResult, sRepl + sRemain.slice(1), nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                }
                for (let sRepl of char_player.d2toX.gl_get(sRemain.slice(0, 2), [])) {
                    this._suggest(oSuggResult, sRepl + sRemain.slice(2), nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                }
                // Hard replacements
                if (nDeep > 3 && nMaxHardRepl && sRemain.length >= 2) {
                    for (let [cChar, kAddr] of this._getCharArcs(iAddr)) {
                        if (!char_player.d1to1.gl_get(cCurrent, "").includes(cChar)) {
                            this._suggest(oSuggResult, sRemain.slice(1), nMaxSwitch, nMaxDel, nMaxHardRepl-1, nDeep+1, kAddr, sNewWord+cChar, true);
                        }
                    }
                }
            }
            // end of word
            if (sRemain.length == 2) {
                for (let sRepl of char_player.dFinal2.gl_get(sRemain, [])) {
                    this._suggest(oSuggResult, sRepl, nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                }
            }
            else if (sRemain.length == 1) {
                this._suggest(oSuggResult, "", nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true); // remove last char and go on
                for (let sRepl of char_player.dFinal1.gl_get(sRemain, [])) {
                    this._suggest(oSuggResult, sRepl, nMaxSwitch, nMaxDel, nMaxHardRepl, nDeep+1, iAddr, sNewWord, true);
                }
            }
        }
    }

    * _getCharArcs (iAddr) {
        // generator: yield all chars and addresses from node at address <iAddr>
        for (let [nVal, jAddr] of this._getArcs(iAddr)) {
            if (nVal < this.nChar) {
                yield [this.dCharVal.get(nVal), jAddr];
            }
        }
    }

    * _getSimilarCharArcs (cChar, iAddr) {
        // generator: yield similar char of <cChar> and address of the following node
        for (let c of char_player.d1to1.gl_get(cChar, [cChar])) {
            if (this.dChar.has(c)) {
                let jAddr = this._lookupArcNode(this.dChar.get(c), iAddr);
                if (jAddr) {
                    yield [c, jAddr];
                }
            }
        }
    }

    _getTails (iAddr, sTail="", n=2) {
        // return a list of suffixes ending at a distance of <n> from <iAddr>
        let aTails = new Set();
        for (let [nVal, jAddr] of this._getArcs(iAddr)) {
            if (nVal < this.nChar) {
                if (this._convBytesToInteger(this.byDic.slice(jAddr, jAddr+this.nBytesArc)) & this._finalNodeMask) {
                    aTails.add(sTail + this.dCharVal.get(nVal));
                }
                if (n && aTails.size == 0) {
                    aTails.gl_update(this._getTails(jAddr, sTail+this.dCharVal.get(nVal), n-1));
                }
            }
        }
        return aTails;
    }

    // morph (sWord) {
    //     is defined in constructor
    // }
    
    // VERSION 1
    _morph1 (sWord) {
        // returns morphologies of sWord
        let iAddr = 0;
        for (let c of sWord) {
            if (!this.dChar.has(c)) {
                return [];
            }
            iAddr = this._lookupArcNode(this.dChar.get(c), iAddr);
            if (iAddr === null) {
                return [];
            }
        }
        if (this._convBytesToInteger(this.byDic.slice(iAddr, iAddr+this.nBytesArc)) & this._finalNodeMask) {
            let l = [];
            let nRawArc = 0;
            while (!(nRawArc & this._lastArcMask)) {
                let iEndArcAddr = iAddr + this.nBytesArc;
                nRawArc = this._convBytesToInteger(this.byDic.slice(iAddr, iEndArcAddr));
                let nArc = nRawArc & this._arcMask;
                if (nArc >= this.nChar) {
                    // This value is not a char, this is a stemming code 
                    let sStem = ">" + this.funcStemming(sWord, this.lArcVal[nArc]);
                    // Now , we go to the next node and retrieve all following arcs values, all of them are tags
                    let iAddr2 = this._convBytesToInteger(this.byDic.slice(iEndArcAddr, iEndArcAddr+this.nBytesNodeAddress));
                    let nRawArc2 = 0;
                    while (!(nRawArc2 & this._lastArcMask)) {
                        let iEndArcAddr2 = iAddr2 + this.nBytesArc;
                        nRawArc2 = this._convBytesToInteger(this.byDic.slice(iAddr2, iEndArcAddr2));
                        l.push(sStem + " " + this.lArcVal[nRawArc2 & this._arcMask]);
                        iAddr2 = iEndArcAddr2+this.nBytesNodeAddress;
                    }
                }
                iAddr = iEndArcAddr + this.nBytesNodeAddress;
            }
            return l;
        }
        return [];
    }

    _stem1 (sWord) {
        // returns stems list of sWord
        let iAddr = 0;
        for (let c of sWord) {
            if (!this.dChar.has(c)) {
                return [];
            }
            iAddr = this._lookupArcNode(this.dChar.get(c), iAddr);
            if (iAddr === null) {
                return [];
            }
        }
        if (this._convBytesToInteger(this.byDic.slice(iAddr, iAddr+this.nBytesArc)) & this._finalNodeMask) {
            let l = [];
            let nRawArc = 0;
            while (!(nRawArc & this._lastArcMask)) {
                let iEndArcAddr = iAddr + this.nBytesArc;
                nRawArc = this._convBytesToInteger(this.byDic.slice(iAddr, iEndArcAddr));
                let nArc = nRawArc & this._arcMask;
                if (nArc >= this.nChar) {
                    // This value is not a char, this is a stemming code 
                    l.push(this.funcStemming(sWord, this.lArcVal[nArc]));
                }
                iAddr = iEndArcAddr + this.nBytesNodeAddress;
            }
            return l;
        }
        return [];
    }

    _lookupArcNode1 (nVal, iAddr) {
        // looks if nVal is an arc at the node at iAddr, if yes, returns address of next node else None
        while (true) {
            let iEndArcAddr = iAddr+this.nBytesArc;
            let nRawArc = this._convBytesToInteger(this.byDic.slice(iAddr, iEndArcAddr));
            if (nVal == (nRawArc & this._arcMask)) {
                // the value we are looking for 
                // we return the address of the next node
                return this._convBytesToInteger(this.byDic.slice(iEndArcAddr, iEndArcAddr+this.nBytesNodeAddress));
            }
            else {
                // value not found
                if (nRawArc & this._lastArcMask) {
                    return null;
                }
                iAddr = iEndArcAddr + this.nBytesNodeAddress;
            }
        }
    }

    * _getArcs1 (iAddr) {
        "generator: return all arcs at <iAddr> as tuples of (nVal, iAddr)"
        while (true) {
            let iEndArcAddr = iAddr+this.nBytesArc;
            let nRawArc = this._convBytesToInteger(this.byDic.slice(iAddr, iEndArcAddr));
            yield [nRawArc & this._arcMask, this._convBytesToInteger(this.byDic.slice(iEndArcAddr, iEndArcAddr+this.nBytesNodeAddress))];
            if (nRawArc & this._lastArcMask) {
                break;
            }
            iAddr = iEndArcAddr+this.nBytesNodeAddress;
        }
    }

    // VERSION 2
    _morph2 (sWord) {
        // to do
    }

    _stem2 (sWord) {
        // to do
    }

    _lookupArcNode2 (nVal, iAddr) {
        // to do
    }


    // VERSION 3
    _morph3 (sWord) {
        // to do
    }

    _stem3 (sWord) {
        // to do
    }

    _lookupArcNode3 (nVal, iAddr) {
        // to do
    }
}


if (typeof(exports) !== 'undefined') {
    exports.IBDAWG = IBDAWG;
}
