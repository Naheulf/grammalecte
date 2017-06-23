// Grammar checker engine

${string}
${regex}
${map}


function capitalizeArray (aArray) {
    // can’t map on user defined function??
    let aNew = [];
    for (let i = 0; i < aArray.length; i = i + 1) {
        aNew[i] = aArray[i]._toCapitalize();
    }
    return aNew;
}

const ibdawg = require("resource://grammalecte/ibdawg.js");
const helpers = require("resource://grammalecte/helpers.js");
const gc_options = require("resource://grammalecte/${lang}/gc_options.js");
const cr = require("resource://grammalecte/${lang}/cregex.js");
const text = require("resource://grammalecte/text.js");
const echo = require("resource://grammalecte/helpers.js").echo;

const lang = "${lang}";
const locales = ${loc};
const pkg = "${implname}";
const name = "${name}";
const version = "${version}";
const author = "${author}";

// commons regexes
const _zEndOfSentence = new RegExp ('([.?!:;…][ .?!… »”")]*|.$)', "g");
const _zBeginOfParagraph = new RegExp ("^[-  –—.,;?!…]*", "ig");
const _zEndOfParagraph = new RegExp ("[-  .,;?!…–—]*$", "ig");

// grammar rules and dictionary
//const _rules = require("./gc_rules.js");
const _rules = require("resource://grammalecte/${lang}/gc_rules.js");
let _dOptions = gc_options.dOpt._shallowCopy();     // duplication necessary, to be able to reset to default
let _aIgnoredRules = new Set();
let _oDict = null;
let _dAnalyses = new Map();                        // cache for data from dictionary


///// Parsing

function parse (sText, sCountry="${country_default}", bDebug=false, bContext=false) {
    // analyses the paragraph sText and returns list of errors
    let dErrors;
    let errs;
    let sAlt = sText;
    let dDA = new Map();        // Disamnbiguator
    let dPriority = new Map();  // Key = position; value = priority
    let sNew = "";

    // parse paragraph
    try {
        [sNew, dErrors] = _proofread(sText, sAlt, 0, true, dDA, dPriority, sCountry, bDebug, bContext);
        if (sNew) {
            sText = sNew;
        }
    }
    catch (e) {
        helpers.logerror(e);
    }

    // cleanup
    if (sText.includes(" ")) {
        sText = sText.replace(/ /g, ' '); // nbsp
    }
    if (sText.includes(" ")) {
        sText = sText.replace(/ /g, ' '); // snbsp
    }
    if (sText.includes("'")) {
        sText = sText.replace(/'/g, "’");
    }
    if (sText.includes("‑")) {
        sText = sText.replace(/‑/g, "-"); // nobreakdash
    }

    // parse sentence
    for (let [iStart, iEnd] of _getSentenceBoundaries(sText)) {
        if (4 < (iEnd - iStart) < 2000) {
            dDA.clear();
            //echo(sText.slice(iStart, iEnd));
            try {
                [_, errs] = _proofread(sText.slice(iStart, iEnd), sAlt.slice(iStart, iEnd), iStart, false, dDA, dPriority, sCountry, bDebug, bContext);
                dErrors._update(errs);
            }
            catch (e) {
                helpers.logerror(e);
            }
        }
    }
    return Array.from(dErrors.values());
}

function* _getSentenceBoundaries (sText) {
    let mBeginOfSentence = _zBeginOfParagraph.exec(sText)
    let iStart = _zBeginOfParagraph.lastIndex;
    let m;
    while ((m = _zEndOfSentence.exec(sText)) !== null) {
        yield [iStart, _zEndOfSentence.lastIndex];
        iStart = _zEndOfSentence.lastIndex;
    }
}

function _proofread (s, sx, nOffset, bParagraph, dDA, dPriority, sCountry, bDebug, bContext) {
    let dErrs = new Map();
    let bChange = false;
    let bIdRule = option('idrule');
    let m;
    let bCondMemo;
    let nErrorStart;

    for (let [sOption, lRuleGroup] of _getRules(bParagraph)) {
        if (!sOption || option(sOption)) {
            for (let [zRegex, bUppercase, sLineId, sRuleId, nPriority, lActions, lGroups, lNegLookBefore] of lRuleGroup) {
                if (!_aIgnoredRules.has(sRuleId)) {
                    while ((m = zRegex._exec2(s, lGroups, lNegLookBefore)) !== null) {
                        bCondMemo = null;
                        /*if (bDebug) {
                            echo(">>>> Rule # " + sLineId + " - Text: " + s + " opt: "+ sOption);
                        }*/
                        for (let [sFuncCond, cActionType, sWhat, ...eAct] of lActions) {
                        // action in lActions: [ condition, action type, replacement/suggestion/action[, iGroup[, message, URL]] ]
                            try {
                                //echo(oEvalFunc[sFuncCond]);
                                bCondMemo = (!sFuncCond || oEvalFunc[sFuncCond](s, sx, m, dDA, sCountry, bCondMemo))
                                if (bCondMemo) {
                                    switch (cActionType) {
                                        case "-":
                                            // grammar error
                                            //echo("-> error detected in " + sLineId + "\nzRegex: " + zRegex.source);
                                            nErrorStart = nOffset + m.start[eAct[0]];
                                            if (!dErrs.has(nErrorStart) || nPriority > dPriority.get(nErrorStart)) {
                                                dErrs.set(nErrorStart, _createError(s, sx, sWhat, nOffset, m, eAct[0], sLineId, sRuleId, bUppercase, eAct[1], eAct[2], bIdRule, sOption, bContext));
                                                dPriority.set(nErrorStart, nPriority);
                                            }
                                            break;
                                        case "~":
                                            // text processor
                                            //echo("-> text processor by " + sLineId + "\nzRegex: " + zRegex.source);
                                            s = _rewrite(s, sWhat, eAct[0], m, bUppercase);
                                            bChange = true;
                                            if (bDebug) {
                                                echo("~ " + s + "  -- " + m[eAct[0]] + "  # " + sLineId);
                                            }
                                            break;
                                        case "=":
                                            // disambiguation
                                            //echo("-> disambiguation by " + sLineId + "\nzRegex: " + zRegex.source);
                                            oEvalFunc[sWhat](s, m, dDA);
                                            if (bDebug) {
                                                echo("= " + m[0] + "  # " + sLineId + "\nDA: " + dDA._toString());
                                            }
                                            break;
                                        case ">":
                                            // we do nothing, this test is just a condition to apply all following actions
                                            break;
                                        default:
                                            echo("# error: unknown action at " + sLineId);
                                    }
                                } else {
                                    if (cActionType == ">") {
                                        break;
                                    }
                                }
                            }
                            catch (e) {
                                echo(s);
                                echo("# line id: " + sLineId + "\n# rule id: " + sRuleId);
                                helpers.logerror(e);
                            }
                        }
                    }
                }
            }
        }
    }
    if (bChange) {
        return [s, dErrs];
    }
    return [false, dErrs];
}

function _createError (s, sx, sRepl, nOffset, m, iGroup, sLineId, sRuleId, bUppercase, sMsg, sURL, bIdRule, sOption, bContext) {
    let oErr = {};
    oErr["nStart"] = nOffset + m.start[iGroup];
    oErr["nEnd"] = nOffset + m.end[iGroup];
    oErr["sLineId"] = sLineId;
    oErr["sRuleId"] = sRuleId;
    oErr["sType"] = (sOption) ? sOption : "notype";
    // suggestions
    if (sRepl[0] === "=") {
        let sugg = oEvalFunc[sRepl.slice(1)](s, m);
        if (sugg) {
            if (bUppercase && m[iGroup].slice(0,1)._isUpperCase()) {
                oErr["aSuggestions"] = capitalizeArray(sugg.split("|"));
            } else {
                oErr["aSuggestions"] = sugg.split("|");
            }
        } else {
            oErr["aSuggestions"] = [];
        }
    } else if (sRepl == "_") {
        oErr["aSuggestions"] = [];
    } else {
        if (bUppercase && m[iGroup].slice(0,1)._isUpperCase()) {
            oErr["aSuggestions"] = capitalizeArray(sRepl._expand(m).split("|"));
        } else {
            oErr["aSuggestions"] = sRepl._expand(m).split("|");
        }
    }
    // Message
    if (sMsg[0] === "=") {
        sMessage = oEvalFunc[sMsg.slice(1)](s, m)
    } else {
        sMessage = sMsg._expand(m);
    }
    if (bIdRule) {
        sMessage += "  #" + sLineId + " #" + sRuleId;
    }
    oErr["sMessage"] = sMessage;
    // URL
    oErr["URL"] = sURL || "";
    // Context
    if (bContext) {
        oErr["sUnderlined"] = sx.slice(m.start[iGroup], m.end[iGroup]);
        oErr["sBefore"] = sx.slice(Math.max(0, m.start[iGroup]-80), m.start[iGroup]);
        oErr["sAfter"] = sx.slice(m.end[iGroup], m.end[iGroup]+80);
    }
    return oErr;
}

function _rewrite (s, sRepl, iGroup, m, bUppercase) {
    // text processor: write sRepl in s at iGroup position"
    let ln = m.end[iGroup] - m.start[iGroup];
    let sNew = "";
    if (sRepl === "*") {
        sNew = " ".repeat(ln);
    } else if (sRepl === ">" || sRepl === "_" || sRepl === "~") {
        sNew = sRepl + " ".repeat(ln-1);
    } else if (sRepl === "@") {
        sNew = "@".repeat(ln);
    } else if (sRepl.slice(0,1) === "=") {
        sNew = oEvalFunc[sRepl.slice(1)](s, m);
        sNew = sNew + " ".repeat(ln-sNew.length);
        if (bUppercase && m[iGroup].slice(0,1)._isUpperCase()) {
            sNew = sNew._toCapitalize();
        }
    } else {
        sNew = sRepl._expand(m);
        sNew = sNew + " ".repeat(ln-sNew.length);
    }
    //echo("\n"+s+"\nstart: "+m.start[iGroup]+" end:"+m.end[iGroup])
    return s.slice(0, m.start[iGroup]) + sNew + s.slice(m.end[iGroup]);
}

function ignoreRule (sRuleId) {
    _aIgnoredRules.add(sRuleId);
}

function resetIgnoreRules () {
    _aIgnoredRules.clear();
}

function reactivateRule (sRuleId) {
    _aIgnoredRules.delete(sRuleId);
}

function listRules (sFilter=null) {
    // generator: returns tuple (sOption, sLineId, sRuleId)
    try {
        for ([sOption, lRuleGroup] of _getRules(true)) {
            for ([_, _, sLineId, sRuleId, _, _] of lRuleGroup) {
                if (!sFilter || sRuleId.test(sFilter)) {
                    yield [sOption, sLineId, sRuleId];
                }
            }
        }
        for ([sOption, lRuleGroup] of _getRules(false)) {
            for ([_, _, sLineId, sRuleId, _, _] of lRuleGroup) {
                if (!sFilter || sRuleId.test(sFilter)) {
                    yield [sOption, sLineId, sRuleId];
                }
            }
        }
    }
    catch (e) {
        helpers.logerror(e);
    }
}


//////// init

function load () {
    try {
        _oDict = new ibdawg.IBDAWG("${dic_name}.json");
    }
    catch (e) {
        helpers.logerror(e);
    }
}

function setOption (sOpt, bVal) {
    if (_dOptions.has(sOpt)) {
        _dOptions.set(sOpt, bVal);
    }
}

function setOptions (dOpt) {
    _dOptions._updateOnlyExistingKeys(dOpt);
}

function getOptions () {
    return _dOptions;
}

function getDefaultOptions () {
    return gc_options.dOpt._shallowCopy();
}

function resetOptions () {
    _dOptions = gc_options.dOpt._shallowCopy();
}

function getDictionary () {
    return _oDict;
}

function _getRules (bParagraph) {
    if (!bParagraph) {
        return _rules.lSentenceRules;
    }
    return _rules.lParagraphRules;
}



//////// common functions

function option (sOpt) {
    // return true if option sOpt is active
    return _dOptions.get(sOpt);
}

function displayInfo (dDA, aWord) {
    // for debugging: info of word
    if (!aWord) {
        echo("> nothing to find");
        return true;
    }
    if (!_dAnalyses.has(aWord[1]) && !_storeMorphFromFSA(aWord[1])) {
        echo("> not in FSA");
        return true;
    }
    if (dDA.has(aWord[0])) {
        echo("DA: " + dDA.get(aWord[0]));
    }
    echo("FSA: " + _dAnalyses.get(aWord[1]));
    return true;
}

function _storeMorphFromFSA (sWord) {
    // retrieves morphologies list from _oDict -> _dAnalyses
    //echo("register: "+sWord + " " + _oDict.getMorph(sWord).toString())
    _dAnalyses.set(sWord, _oDict.getMorph(sWord));
    return !!_dAnalyses.get(sWord);
}

function morph (dDA, aWord, sPattern, bStrict=true, bNoWord=false) {
    // analyse a tuple (position, word), return true if sPattern in morphologies (disambiguation on)
    if (!aWord) {
        //echo("morph: noword, returns " + bNoWord);
        return bNoWord;
    }
    //echo("aWord: "+aWord.toString());
    if (!_dAnalyses.has(aWord[1]) && !_storeMorphFromFSA(aWord[1])) {
        return false;
    }
    let lMorph = dDA.has(aWord[0]) ? dDA.get(aWord[0]) : _dAnalyses.get(aWord[1]);
    //echo("lMorph: "+lMorph.toString());
    if (lMorph.length === 0) {
        return false;
    }
    //echo("***");
    if (bStrict) {
        return lMorph.every(s  =>  (s.search(sPattern) !== -1));
    }
    return lMorph.some(s  =>  (s.search(sPattern) !== -1));
}

function morphex (dDA, aWord, sPattern, sNegPattern, bNoWord=false) {
    // analyse a tuple (position, word), returns true if not sNegPattern in word morphologies and sPattern in word morphologies (disambiguation on)
    if (!aWord) {
        //echo("morph: noword, returns " + bNoWord);
        return bNoWord;
    }
    //echo("aWord: "+aWord.toString());
    if (!_dAnalyses.has(aWord[1]) && !_storeMorphFromFSA(aWord[1])) {
        return false;
    }
    let lMorph = dDA.has(aWord[0]) ? dDA.get(aWord[0]) : _dAnalyses.get(aWord[1]);
    //echo("lMorph: "+lMorph.toString());
    if (lMorph.length === 0) {
        return false;
    }
    //echo("***");
    // check negative condition
    if (lMorph.some(s  =>  (s.search(sNegPattern) !== -1))) {
        return false;
    }
    // search sPattern
    return lMorph.some(s  =>  (s.search(sPattern) !== -1));
}

function analyse (sWord, sPattern, bStrict=true) {
    // analyse a word, return true if sPattern in morphologies (disambiguation off)
    if (!_dAnalyses.has(sWord) && !_storeMorphFromFSA(sWord)) {
        return false;
    }
    if (bStrict) {
        return _dAnalyses.get(sWord).every(s  =>  (s.search(sPattern) !== -1));
    }
    return _dAnalyses.get(sWord).some(s  =>  (s.search(sPattern) !== -1));
}

function analysex (sWord, sPattern, sNegPattern) {
    // analyse a word, returns True if not sNegPattern in word morphologies and sPattern in word morphologies (disambiguation off)
    if (!_dAnalyses.has(sWord) && !_storeMorphFromFSA(sWord)) {
        return false;
    }
    // check negative condition
    if (_dAnalyses.get(sWord).some(s  =>  (s.search(sNegPattern) !== -1))) {
        return false;
    }
    // search sPattern
    return _dAnalyses.get(sWord).some(s  =>  (s.search(sPattern) !== -1));
}

function stem (sWord) {
    // returns a list of sWord's stems
    if (!sWord) {
        return [];
    }
    if (!_dAnalyses.has(sWord) && !_storeMorphFromFSA(sWord)) {
        return [];
    }
    return [ for (s of _dAnalyses.get(sWord))  s.slice(1, s.indexOf(" ")) ];
}


//// functions to get text outside pattern scope

// warning: check compile_rules.py to understand how it works

function nextword (s, iStart, n) {
    // get the nth word of the input string or empty string
    let z = new RegExp("^( +[a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ%_-]+){" + (n-1).toString() + "} +([a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ%_-]+)", "i");
    let m = z.exec(s.slice(iStart));
    if (!m) {
        return null;
    }
    return [iStart + RegExp.lastIndex - m[2].length, m[2]];
}

function prevword (s, iEnd, n) {
    // get the (-)nth word of the input string or empty string
    let z = new RegExp("([a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ%_-]+) +([a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ%_-]+ +){" + (n-1).toString() + "}$", "i");
    let m = z.exec(s.slice(0, iEnd));
    if (!m) {
        return null;
    }
    return [m.index, m[1]];
}

const _zNextWord = new RegExp ("^ +([a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ_][a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ_-]*)", "i");
const _zPrevWord = new RegExp ("([a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ_][a-zà-öA-Zø-ÿÀ-Ö0-9Ø-ßĀ-ʯﬁ-ﬆ_-]*) +$", "i");

function nextword1 (s, iStart) {
    // get next word (optimization)
    let m = _zNextWord.exec(s.slice(iStart));
    if (!m) {
        return null;
    }
    return [iStart + RegExp.lastIndex - m[1].length, m[1]];
}

function prevword1 (s, iEnd) {
    // get previous word (optimization)
    //echo("prev1, s:"+s);
    //echo("prev1, s.slice(0, iEnd):"+s.slice(0, iEnd));
    let m = _zPrevWord.exec(s.slice(0, iEnd));
    //echo("prev1, m:"+m);
    if (!m) {
        return null;
    }
    //echo("prev1: " + m.index + " " + m[1]);
    return [m.index, m[1]];
}

function look (s, zPattern, zNegPattern=null) {
    // seek zPattern in s (before/after/fulltext), if antipattern zNegPattern not in s
    try {
        if (zNegPattern && zNegPattern.test(s)) {
            return false;
        }
        return zPattern.test(s);
    }
    catch (e) {
        helpers.logerror(e);
    }
    return false;
}

function look_chk1 (dDA, s, nOffset, zPattern, sPatternGroup1, sNegPatternGroup1=null) {
    // returns True if s has pattern zPattern and m.group(1) has pattern sPatternGroup1
    let m = zPattern._exec2(s, null);
    if (!m) {
        return false;
    }
    try {
        let sWord = m[1];
        let nPos = m.start[1] + nOffset;
        if (sNegPatternGroup1) {
            return morphex(dDA, [nPos, sWord], sPatternGroup1, sNegPatternGroup1);
        } 
        return morph(dDA, [nPos, sWord], sPatternGroup1, false);
    }
    catch (e) {
        helpers.logerror(e);
        return false;
    }
}


//////// Disambiguator

function select (dDA, nPos, sWord, sPattern, lDefault=null) {
    if (!sWord) {
        return true;
    }
    if (dDA.has(nPos)) {
        return true;
    }
    if (!_dAnalyses.has(sWord) && !_storeMorphFromFSA(sWord)) {
        return true;
    }
    //echo("morph: "+_dAnalyses.get(sWord).toString());
    if (_dAnalyses.get(sWord).length === 1) {
        return true;
    }
    let lSelect = [ for (sMorph of _dAnalyses.get(sWord))  if (sMorph.search(sPattern) !== -1)  sMorph ];
    //echo("lSelect: "+lSelect.toString());
    if (lSelect.length > 0) {
        if (lSelect.length != _dAnalyses.get(sWord).length) {
            dDA.set(nPos, lSelect);
        }
    } else if (lDefault) {
        dDA.set(nPos, lDefaul);
    }
    return true;
}

function exclude (dDA, nPos, sWord, sPattern, lDefault=null) {
    if (!sWord) {
        return true;
    }
    if (dDA.has(nPos)) {
        return true;
    }
    if (!_dAnalyses.has(sWord) && !_storeMorphFromFSA(sWord)) {
        return true;
    }
    if (_dAnalyses.get(sWord).length === 1) {
        return true;
    }
    let lSelect = [ for (sMorph of _dAnalyses.get(sWord))  if (sMorph.search(sPattern) === -1)  sMorph ];
    //echo("lSelect: "+lSelect.toString());
    if (lSelect.length > 0) {
        if (lSelect.length != _dAnalyses.get(sWord).length) {
            dDA.set(nPos, lSelect);
        }
    } else if (lDefault) {
        dDA.set(nPos, lDefault);
    }
    return true;
}

function define (dDA, nPos, lMorph) {
    dDA.set(nPos, lMorph);
    return true;
}

//////// GRAMMAR CHECKER PLUGINS

${pluginsJS}


${callablesJS}




exports.load = load;
exports.parse = parse;
exports.lang = lang;
exports.version = version;
exports.getDictionary = getDictionary;
exports.setOption = setOption;
exports.setOptions = setOptions;
exports.getOptions = getOptions;
exports.getDefaultOptions = getDefaultOptions;
exports.resetOptions = resetOptions;
exports.ignoreRule = ignoreRule;
exports.reactivateRule = reactivateRule;
exports.resetIgnoreRules = resetIgnoreRules;
exports.listRules = listRules;
