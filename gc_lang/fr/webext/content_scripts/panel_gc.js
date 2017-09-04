// JavaScript

"use strict";

function onGrammalecteGCPanelClick (xEvent) {
    try {
        let xElem = xEvent.target;
        if (xElem.id) {
            if (xElem.id.startsWith("grammalecte_sugg")) {
                oGrammalecte.oGCPanel.applySuggestion(xElem.id);
            } else if (xElem.id === "grammalecte_tooltip_ignore") {
                oGrammalecte.oGCPanel.ignoreError(xElem.id);
            } else if (xElem.id.startsWith("grammalecte_check")) {
                oGrammalecte.oGCPanel.recheckParagraph(parseInt(xElem.dataset.para_num));
            } else if (xElem.id.startsWith("grammalecte_hide")) {
                xElem.parentNode.parentNode.style.display = "none";
            } else if (xElem.id.startsWith("grammalecte_err")
                       && xElem.className !== "grammalecte_error_corrected"
                       && xElem.className !== "grammalecte_error_ignored") {
                oGrammalecte.oGCPanel.oTooltip.show(xElem.id);
            } else if (xElem.id === "grammalecte_tooltip_url") {
                oGrammalecte.oGCPanel.openURL(xElem.dataset.url);
            } else {
                oGrammalecte.oGCPanel.oTooltip.hide();
            }
        } else {
            oGrammalecte.oGCPanel.oTooltip.hide();
        }
    }
    catch (e) {
        showError(e);
    }
}


class GrammalecteGrammarChecker extends GrammalectePanel {
    /*
        KEYS for identifiers:
            grammalecte_paragraph{Id} : [paragraph number]
            grammalecte_check{Id}     : [paragraph number]
            grammalecte_hide{Id}      : [paragraph number]
            grammalecte_error{Id}     : [paragraph number]-[error_number]
            grammalecte_sugg{Id}      : [paragraph number]-[error_number]--[suggestion_number]
    */

    constructor (...args) {
        super(...args);
        this.aIgnoredErrors = new Set();
        this.xContentNode = createNode("div", {id: "grammalecte_gc_panel_content"});
        this.xParagraphList = createNode("div", {id: "grammalecte_paragraph_list"});
        this.xContentNode.appendChild(this.xParagraphList);
        this.xPanelContent.addEventListener("click", onGrammalecteGCPanelClick, false);
        this.oTooltip = new GrammalecteTooltip(this.xContentNode);
        this.xPanelContent.appendChild(this.xContentNode);
        this.oTAC = new GrammalecteTextAreaControl();
    }

    start (xTextArea=null) {
        this.clear();
        if (xTextArea) {
            this.oTAC.setTextArea(xTextArea);
        }
    }

    clear () {
        while (this.xParagraphList.firstChild) {
            this.xParagraphList.removeChild(this.xParagraphList.firstChild);
        }
        this.aIgnoredErrors.clear();
    }

    hide () {
        this.xPanelNode.style.display = "none";
        this.oTAC.clear();
    }

    addParagraphResult (oResult) {
        try {
            if (oResult && oResult.sParagraph.trim() !== "" && (oResult.aGrammErr.length > 0 || oResult.aSpellErr.length > 0)) {
                let xNodeDiv = createNode("div", {className: "grammalecte_paragraph_block"});
                // actions
                let xActionsBar = createNode("div", {className: "grammalecte_paragraph_actions"});
                xActionsBar.appendChild(createNode("div", {id: "grammalecte_check" + oResult.iParaNum, className: "grammalecte_paragraph_button grammalecte_green", textContent: "Réanalyser"}, {para_num: oResult.iParaNum}));
                xActionsBar.appendChild(createNode("div", {id: "grammalecte_hide" + oResult.iParaNum, className: "grammalecte_paragraph_button grammalecte_red", textContent: "×", style: "font-weight: bold;"}));
                // paragraph
                let xParagraph = createNode("p", {id: "grammalecte_paragraph"+oResult.iParaNum, className: "grammalecte_paragraph", lang: "fr", contentEditable: "true"}, {para_num: oResult.iParaNum});
                xParagraph.setAttribute("spellcheck", "false"); // doesn’t seem possible to use “spellcheck” as a common attribute.
                xParagraph.addEventListener("keyup", function (xEvent) {
                    this.oTAC.setParagraph(parseInt(xEvent.target.dataset.para_num), this.purgeText(xEvent.target.textContent));
                    this.oTAC.write();
                }.bind(this)
                , true);
                this._tagParagraph(xParagraph, oResult.sParagraph, oResult.iParaNum, oResult.aGrammErr, oResult.aSpellErr);
                // creation
                xNodeDiv.appendChild(xActionsBar);
                xNodeDiv.appendChild(xParagraph);
                this.xParagraphList.appendChild(xNodeDiv);
            }
        }
        catch (e) {
            showError(e);
        }
    }

    recheckParagraph (iParaNum) {
        let sParagraphId = "grammalecte_paragraph" + iParaNum;
        let xParagraph = document.getElementById(sParagraphId);
        this.blockParagraph(xParagraph);
        let sText = this.purgeText(xParagraph.textContent);
        xGrammalectePort.postMessage({
            sCommand: "parseAndSpellcheck1",
            dParam: {sText: sText, sCountry: "FR", bDebug: false, bContext: false},
            dInfo: {sParagraphId: sParagraphId}
        });
        this.oTAC.setParagraph(iParaNum, sText);
        this.oTAC.write();
    }

    refreshParagraph (sParagraphId, oResult) {
        try {
            let xParagraph = document.getElementById(sParagraphId);
            xParagraph.className = (oResult.aGrammErr.length || oResult.aSpellErr.length) ? "grammalecte_paragraph softred" : "grammalecte_paragraph";
            xParagraph.textContent = "";
            this._tagParagraph(xParagraph, oResult.sParagraph, sParagraphId.slice(21), oResult.aGrammErr, oResult.aSpellErr);
            this.freeParagraph(xParagraph);
        }
        catch (e) {
            showError(e);
        }
    }

    _tagParagraph (xParagraph, sParagraph, iParaNum, aSpellErr, aGrammErr) {
        try {
            if (aGrammErr.length === 0  &&  aSpellErr.length === 0) {
                xParagraph.textContent = sParagraph;
                return;
            }
            aGrammErr.push(...aSpellErr);
            aGrammErr.sort(function (a, b) {
                if (a["nStart"] < b["nStart"])
                    return -1;
                if (a["nStart"] > b["nStart"])
                    return 1;
                return 0;
            });
            let nErr = 0; // we count errors to give them an identifier
            let nEndLastErr = 0;
            for (let oErr of aGrammErr) {
                let nStart = oErr["nStart"];
                let nEnd = oErr["nEnd"];
                if (nStart >= nEndLastErr) {
                    oErr['sErrorId'] = iParaNum + "-" + nErr.toString(); // error identifier
                    oErr['sIgnoredKey'] = iParaNum + ":" + nStart.toString() + ":" + sParagraph.slice(nStart, nEnd);
                    if (nEndLastErr < nStart) {
                        xParagraph.appendChild(document.createTextNode(sParagraph.slice(nEndLastErr, nStart)));
                    }
                    xParagraph.appendChild(this._createError(sParagraph.slice(nStart, nEnd), oErr));
                    nEndLastErr = nEnd;
                }
                nErr += 1;
            }
            if (nEndLastErr <= sParagraph.length) {
                xParagraph.appendChild(document.createTextNode(sParagraph.slice(nEndLastErr)));
            }
        }
        catch (e) {
            showError(e);
        }
    }

    _createError (sUnderlined, oErr) {
        let xNodeErr = document.createElement("mark");
        xNodeErr.id = "grammalecte_err" + oErr['sErrorId'];
        xNodeErr.textContent = sUnderlined;
        xNodeErr.dataset.error_id = oErr['sErrorId'];
        xNodeErr.dataset.ignored_key = oErr['sIgnoredKey'];
        xNodeErr.dataset.error_type = (oErr['sType'] === "WORD") ? "spelling" : "grammar";
        if (xNodeErr.dataset.error_type === "grammar") {
            xNodeErr.dataset.gc_message = oErr['sMessage'];
            xNodeErr.dataset.gc_url = oErr['URL'];
            if (xNodeErr.dataset.gc_message.includes(" #")) {
                xNodeErr.dataset.line_id = oErr['sLineId'];
                xNodeErr.dataset.rule_id = oErr['sRuleId'];
            }
            xNodeErr.dataset.suggestions = oErr["aSuggestions"].join("|");
        }
        xNodeErr.className = (this.aIgnoredErrors.has(xNodeErr.dataset.ignored_key)) ? "grammalecte_error_ignored" : "grammalecte_error grammalecte_error_" + oErr['sType'];
        return xNodeErr;
    }

    blockParagraph (xParagraph) {
        xParagraph.contentEditable = "false";
        document.getElementById("grammalecte_check"+xParagraph.dataset.para_num).textContent = "Analyse…";
    }

    freeParagraph (xParagraph) {
        xParagraph.contentEditable = "true";
        document.getElementById("grammalecte_check"+xParagraph.dataset.para_num).textContent = "Réanalyser";
    }

    applySuggestion (sNodeSuggId) { // sugg
        try {
            let sErrorId = document.getElementById(sNodeSuggId).dataset.error_id;
            //let sParaNum = sErrorId.slice(0, sErrorId.indexOf("-"));
            let xNodeErr = document.getElementById("grammalecte_err" + sErrorId);
            xNodeErr.textContent = document.getElementById(sNodeSuggId).textContent;
            xNodeErr.className = "grammalecte_error_corrected";
            xNodeErr.removeAttribute("style");
            this.oTooltip.hide();
            this.recheckParagraph(parseInt(sErrorId.slice(0, sErrorId.indexOf("-"))));
        }
        catch (e) {
            showError(e);
        }
    }

    ignoreError (sIgnoreButtonId) {  // ignore
        try {
            let sErrorId = document.getElementById(sIgnoreButtonId).dataset.error_id;
            let xNodeErr = document.getElementById("grammalecte_err" + sErrorId);
            this.aIgnoredErrors.add(xNodeErr.dataset.ignored_key);
            xNodeErr.className = "grammalecte_error_ignored";
            this.oTooltip.hide();
        }
        catch (e) {
            showError(e);
        }
    }

    purgeText (sText) {
        return sText.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }

    addSummary () {
        // todo
    }

    addMessage (sMessage) {
        let xNode = createNode("div", {className: "grammalecte_gc_panel_message", textContent: sMessage});
        this.xParagraphList.appendChild(xNode);
    }

    _copyToClipboard (sText)  {
        // recipe from https://github.com/mdn/webextensions-examples/blob/master/context-menu-copy-link-with-types/clipboard-helper.js
        function setClipboardData (xEvent) {
            document.removeEventListener("copy", setClipboardData, true);
            xEvent.stopImmediatePropagation();
            xEvent.preventDefault();
            xEvent.clipboardData.setData("text/plain", sText);
        };

        document.addEventListener("copy", setClipboardData, true);
        document.execCommand("copy");
    }

    copyTextToClipboard () {
        this.startWaitIcon();
        try {
            let xClipboardButton = document.getElementById("grammalecte_clipboard_button");
            xClipboardButton.textContent = "->>";
            let sText = "";
            for (let xNode of document.getElementsByClassName("grammalecte_paragraph")) {
                sText += xNode.textContent + "\n";
            }
            this._copyToClipboard(sText);
            xClipboardButton.textContent = "OK";
            window.setTimeout(function() { xClipboardButton.textContent = "∑"; } , 2000);
        }
        catch (e) {
            showError(e);
        }
        this.stopWaitIcon();
    }
}


class GrammalecteTooltip {

    constructor (xContentNode) {
        this.xTooltip = createNode("div", {id: "grammalecte_tooltip"});
        this.xTooltipArrow = createNode("img", {
            id: "grammalecte_tooltip_arrow",
            src: " data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwAAADsABataJCQAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xNzNun2MAAAAnSURBVChTY/j//z8cq/kW/wdhZDEMSXRFWCVhGKwAmwQyHngFxf8B5fOGYfeFpYoAAAAASUVORK5CYII=",
            alt: "^"
        });
        this.xTooltipSuggBlock = createNode("div", {id: "grammalecte_tooltip_sugg_block"});
        let xMessageBlock = createNode("div", {id: "grammalecte_tooltip_message_block"});
        xMessageBlock.appendChild(createNode("p", {id: "grammalecte_tooltip_rule_id"}));
        xMessageBlock.appendChild(createNode("p", {id: "grammalecte_tooltip_message", textContent: "Erreur."}));
        let xActions = xMessageBlock.appendChild(createNode("div", {id: "grammalecte_tooltip_actions"}));
        xActions.appendChild(createNode("div", {id: "grammalecte_tooltip_ignore", textContent: "Ignorer"}));
        xActions.appendChild(createNode("div", {id: "grammalecte_tooltip_url", textContent: "Voulez-vous en savoir plus ?…"}, {url: ""}));
        xMessageBlock.appendChild(xActions);
        this.xTooltip.appendChild(xMessageBlock);
        this.xTooltip.appendChild(createNode("div", {id: "grammalecte_tooltip_sugg_title", textContent: "SUGGESTIONS :"}));
        this.xTooltip.appendChild(this.xTooltipSuggBlock);
        xContentNode.appendChild(this.xTooltip);
        xContentNode.appendChild(this.xTooltipArrow);
    }

    show (sNodeErrorId) {  // err
        try {
            let xNodeErr = document.getElementById(sNodeErrorId);
            let nLimit = 500 - 330; // paragraph width - tooltip width
            this.xTooltipArrow.style.top = (xNodeErr.offsetTop + 16) + "px";
            this.xTooltipArrow.style.left = (xNodeErr.offsetLeft + Math.floor((xNodeErr.offsetWidth / 2))-4) + "px"; // 4 is half the width of the arrow.
            this.xTooltip.style.top = (xNodeErr.offsetTop + 20) + "px";
            this.xTooltip.style.left = (xNodeErr.offsetLeft > nLimit) ? nLimit + "px" : xNodeErr.offsetLeft + "px";
            if (xNodeErr.dataset.error_type === "grammar") {
                // grammar error
                if (xNodeErr.dataset.gc_message.includes(" ##")) {
                    let n = xNodeErr.dataset.gc_message.indexOf(" ##");
                    document.getElementById("grammalecte_tooltip_message").textContent = xNodeErr.dataset.gc_message.slice(0, n);
                    document.getElementById("grammalecte_tooltip_rule_id").textContent = "Règle : " + xNodeErr.dataset.gc_message.slice(n+2);
                    document.getElementById("grammalecte_tooltip_rule_id").style.display = "block";
                } else {
                    document.getElementById("grammalecte_tooltip_message").textContent = xNodeErr.dataset.gc_message;
                    document.getElementById("grammalecte_tooltip_rule_id").style.display = "none";
                }
                if (xNodeErr.dataset.gc_url != "") {
                    document.getElementById("grammalecte_tooltip_url").dataset.url = xNodeErr.dataset.gc_url;
                    document.getElementById("grammalecte_tooltip_url").style.display = "inline";
                } else {
                    document.getElementById("grammalecte_tooltip_url").dataset.url = "";
                    document.getElementById("grammalecte_tooltip_url").style.display = "none";
                }
                document.getElementById("grammalecte_tooltip_ignore").dataset.error_id = xNodeErr.dataset.error_id;
                let iSugg = 0;
                let xGCSugg = document.getElementById("grammalecte_tooltip_sugg_block");
                xGCSugg.textContent = "";
                if (xNodeErr.dataset.suggestions.length > 0) {
                    for (let sSugg of xNodeErr.dataset.suggestions.split("|")) {
                        xGCSugg.appendChild(this._createSuggestion(xNodeErr.dataset.error_id, iSugg, sSugg));
                        xGCSugg.appendChild(document.createTextNode(" "));
                        iSugg += 1;
                    }
                } else {
                    xGCSugg.textContent = "Aucune.";
                }
            }
            this.xTooltipArrow.style.display = "block";
            this.xTooltip.style.display = "block";
            if (xNodeErr.dataset.error_type === "spelling") {
                // spelling mistake
                document.getElementById("grammalecte_tooltip_message").textContent = "Mot inconnu du dictionnaire.";
                document.getElementById("grammalecte_tooltip_ignore").dataset.error_id = xNodeErr.dataset.error_id;
                while (this.xTooltipSuggBlock.firstChild) {
                    this.xTooltipSuggBlock.removeChild(this.xTooltipSuggBlock.firstChild);
                }
                //console.log("getSuggFor: " + xNodeErr.textContent.trim() + " // error_id: " + xNodeErr.dataset.error_id);
                //self.port.emit("getSuggestionsForTo", xNodeErr.textContent.trim(), xNodeErr.dataset.error_id);
                this.setSpellSuggestionsFor(xNodeErr.textContent.trim(), "", xNodeErr.dataset.error_id);
            }
        }
        catch (e) {
            showError(e);
        }
    }

    setTooltipColor () {
        // todo
    }

    hide () {
        this.xTooltipArrow.style.display = "none";
        this.xTooltip.style.display = "none";
    }

    _createSuggestion (sErrId, iSugg, sSugg) {
        let xNodeSugg = document.createElement("div");
        xNodeSugg.id = "grammalecte_sugg" + sErrId + "--" + iSugg.toString();
        xNodeSugg.className = "grammalecte_tooltip_sugg";
        xNodeSugg.dataset.error_id = sErrId;
        xNodeSugg.textContent = sSugg;
        return xNodeSugg;
    }

    setSpellSuggestionsFor (sWord, sSuggestions, sErrId) {
        // spell checking suggestions
        try {
            // console.log("setSuggestionsFor: " + sWord + " > " + sSuggestions + " // " + sErrId);
            let xSuggBlock = document.getElementById("grammalecte_tooltip_sugg_block");
            xSuggBlock.textContent = "";
            if (sSuggestions === "") {
                xSuggBlock.appendChild(document.createTextNode("Aucune."));
            } else if (sSuggestions.startsWith("#")) {
                xSuggBlock.appendChild(document.createTextNode(sSuggestions));
            } else {
                let lSugg = sSuggestions.split("|");
                let iSugg = 0;
                for (let sSugg of lSugg) {
                    xSuggBlock.appendChild(this._createSuggestion(sErrId, iSugg, sSugg));
                    xSuggBlock.appendChild(document.createTextNode(" "));
                    iSugg += 1;
                }
            }
        }
        catch (e) {
            showError(e);
        }
    }
}


class GrammalecteTextAreaControl {

    constructor () {
        this._xTextArea = null;
        this._dParagraph = new Map();
    }

    setTextArea (xNode) {
        this.clear();
        this._xTextArea = xNode;
        this._xTextArea.disabled = true;
        this._loadText();
    }

    clear () {
        if (this._xTextArea !== null) {
            this._xTextArea.disabled = false;
            this._xTextArea = null;
        }
        this._dParagraph.clear();
    }

    setParagraph (iParagraph, sText) {
        if (this._xTextArea !== null) {
            this._dParagraph.set(iParagraph, sText);
        }
    }

    _loadText () {
        let sText = this._xTextArea.value;
        let i = 0;
        let iStart = 0;
        let iEnd = 0;
        sText = sText.replace("\r\n", "\n").replace("\r", "\n");
        while ((iEnd = sText.indexOf("\n", iStart)) !== -1) {
            this._dParagraph.set(i, sText.slice(iStart, iEnd));
            i++;
            iStart = iEnd+1;
        }
        this._dParagraph.set(i, sText.slice(iStart));
        console.log("Paragraphs number: " + (i+1));
    }

    write () {
        if (this._xTextArea !== null) {
            let sText = "";
            this._dParagraph.forEach(function (val, key) {
                sText += val + "\n";
            });
            this._xTextArea.value = sText.slice(0,-1);
        }
    }
}