// JavaScript

"use strict";

function onGrammalecteGCPanelClick (xEvent) {
    try {
        let xElem = xEvent.target;
        if (xElem.id) {
            if (xElem.id.startsWith("sugg")) {
                oGCPanelContent.applySuggestion(xElem.id);
            } else if (xElem.id.endsWith("_ignore")) {
                oGCPanelContent.ignoreError(xElem.id);
            } else if (xElem.id.startsWith("grammalecte_check")) {
                oGCPanelContent.recheckParagraph(xElem.id);
            } else if (xElem.id.startsWith("grammalecte_end")) {
                document.getElementById(xElem.id).parentNode.parentNode.style.display = "none";
            } else if (xElem.tagName === "U" && xElem.id.startsWith("err")
                       && xElem.className !== "corrected" && xElem.className !== "ignored") {
                oGrammalecteTooltip.show(xElem.id);
            } else if (xElem.id === "gc_url") {
                oGCPanelContent.openURL(xElem.getAttribute("href"));
            } else {
                oGrammalecteTooltip.hide();
            }
        } else if (xElem.tagName === "A") {
            oGCPanelContent.openURL(xElem.getAttribute("href"));
        } else {
            oGrammalecteTooltip.hide();
        }
    }
    catch (e) {
        showError(e);
    }
}


const oGCPanelContent = {

    bInitDone: false,

    xContentNode: null,
    xParagraphList: null,

    aIgnoredErrors: new Set(),

    init: function () {
        this.xContentNode = createNode("div", {id: "grammalecte_gc_panel_content"});
        this.xParagraphList = createNode("div", {id: "grammalecte_paragraph_list"});
        this.xContentNode.appendChild(this.xParagraphList);
        this.xContentNode.addEventListener("click", onGrammalecteGCPanelClick, false);
        oGrammalecteTooltip.init();
        this.xContentNode.appendChild(oGrammalecteTooltip.xTooltip);
        this.bInitDone = true;
        return this.xContentNode;
    },

    clear: function () {
        while (this.xParagraphList.firstChild) {
            this.xParagraphList.removeChild(this.xParagraphList.firstChild);
        }
        this.aIgnoredErrors.clear();
    },

    recheckParagraph: function (sCheckButtonId) {  // check
        //startWaitIcon();
        let sIdParagr = sCheckButtonId.slice(5);
        self.port.emit("modifyAndCheck", sIdParagr, getPurgedTextOfParagraph("paragr"+sIdParagr));
        //stopWaitIcon();
    },

    addParagraphResult: function (oResult) {
        try {
            if (oResult) {
                let xNodeDiv = createNode("div", {className: "grammalecte_paragraph_block"});
                // actions
                let xActionsBar = createNode("div", {className: "grammalecte_actions"});
                let xAnalyseButton = createNode("div", {id: "grammalecte_check" + oResult.sParaNum, className: "button green", textContent: "Réanalyser"});
                let xCloseButton = createNode("div", {id: "grammalecte_end" + oResult.sParaNum, className: "button red blod", textContent: "×"});
                xActionsBar.appendChild(xAnalyseButton);
                xActionsBar.appendChild(xCloseButton);
                // paragraph
                let xParagraph = createNode("p", {id: "paragr"+oResult.sParaNum, lang: "fr", spellcheck: "false", contenteditable: "true"});
                xParagraph.className = (oResult.aGrammErr.length || oResult.aSpellErr.length) ? "grammalecte_paragraph softred" : "grammalecte_paragraph";
                this._tagParagraph(xParagraph, oResult.sParagraph, oResult.sParaNum, oResult.aGrammErr, oResult.aSpellErr);
                // creation
                xNodeDiv.appendChild(xActionsBar);
                xNodeDiv.appendChild(xParagraph);
                this.xParagraphList.appendChild(xNodeDiv);
            }
        }
        catch (e) {
            showError(e);
        }
    },

    refreshParagraph: function (oResult) {
        try {
            let xParagraph = document.getElementById("paragr"+sIdParagr);
            xParagraph.className = (oResult.aGrammErr.length || oResult.aSpellErr.length) ? "grammalecte_paragraph softred" : "grammalecte_paragraph";
            xParagraph.textContent = "";
            this._tagParagraph(xParagraph, oResult.sParagraph, oResult.sParaNum, oResult.aGrammErr, oResult.aSpellErr);
        }
        catch (e) {
            showError(e);
        }
    },

    _tagParagraph: function (xParagraph, sParagraph, sParaNum, aSpellErr, aGrammErr) {
        try {
            if (aGrammErr.length === 0  &&  aSpellErr.length === 0) {
                xParagraph.textContent = sParagraph;
                return
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
                    oErr['sErrorId'] = sParaNum + "_" + nErr.toString(); // error identifier
                    oErr['sIgnoredKey'] = sParaNum + ":" + nStart.toString() + ":" + nEnd.toString() + ":" + sParagraph.slice(nStart, nEnd);
                    if (nEndLastErr < nStart) {
                        xParagraph.appendChild(document.createTextNode(sParagraph.slice(nEndLastErr, nStart)));
                    }
                    xParagraph.appendChild(this._createError(sParagraph.slice(nStart, nEnd), oErr));
                    xParagraph.insertAdjacentHTML("beforeend", "<!-- err_end -->");
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
    },

    _createError: function (sUnderlined, oErr) {
        let xNodeErr = document.createElement("u");
        xNodeErr.id = "err" + oErr['sErrorId'];
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
        xNodeErr.className = (this.aIgnoredErrors.has(xNodeErr.dataset.ignored_key)) ? "ignored" : "error " + oErr['sType'];
        return xNodeErr;
    },

    applySuggestion: function (sSuggId) { // sugg
        try {
            let sErrorId = document.getElementById(sSuggId).dataset.error_id;
            let sIdParagr = sErrorId.slice(0, sErrorId.indexOf("_"));
            let xNodeErr = document.getElementById("err" + sErrorId);
            xNodeErr.textContent = document.getElementById(sSuggId).textContent;
            xNodeErr.className = "corrected";
            xNodeErr.removeAttribute("style");
            //self.port.emit("correction", sIdParagr, getPurgedTextOfParagraph("paragr"+sIdParagr));
            oGrammalecteTooltip.hide();
        }
        catch (e) {
            showError(e);
        }
    },

    ignoreError: function (sIgnoreButtonId) {  // ignore
        try {
            //console.log("ignore button: " + sIgnoreButtonId + " // error id: " + document.getElementById(sIgnoreButtonId).dataset.error_id);
            let xNodeErr = document.getElementById("err"+document.getElementById(sIgnoreButtonId).dataset.error_id);
            this.aIgnoredErrors.add(xNodeErr.dataset.ignored_key);
            xNodeErr.className = "ignored";
            xNodeErr.removeAttribute("style");
            oGrammalecteTooltip.hide();
        }
        catch (e) {
            showError(e);
        }
    },

    addSummary: function () {
        // todo
    },

    addMessage: function (sMessage) {
        let xNode = createNode("div", {className: "grammalecte_gc_panel_message", textContent: sMessage});
        this.xParagraphList.appendChild(xNode);
    },

    copyToClipboard: function () {
        startWaitIcon();
        try {
            let xClipboardButton = document.getElementById("clipboard_msg");
            xClipboardButton.textContent = "copie en cours…";
            let sText = "";
            for (let xNode of document.getElementById("errorlist").getElementsByClassName("paragraph")) {
                sText += xNode.textContent + "\n";
            }
            self.port.emit('copyToClipboard', sText);
            xClipboardButton.textContent = "-> presse-papiers";
            window.setTimeout(function() { xClipboardButton.textContent = "∑"; } , 3000);
        }
        catch (e) {
            console.log(e.lineNumber + ": " +e.message);
        }
        stopWaitIcon();
    }
}


function getPurgedTextOfParagraph (sNodeParagrId) {
    let sText = document.getElementById(sNodeParagrId).textContent;
    sText = sText.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    return sText;
}


const oGrammalecteTooltip = {

    xTooltip: null,

    xTooltipArrow: createNode("img", {
        id: "grammalecte_tooltip_arrow",
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwQAADsEBuJFr7QAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xNkRpr/UAAAAlSURBVBhXY/j//z8cq/kW/wdhZDEMSXRFWCVhGKwAmwQCF/8HAGUkScGH4cM8AAAAAElFTkSuQmCC",
        alt: "^"
    }),

    xTooltipSuggBlock: null,

    init: function () {
        this.xTooltip = createNode("div", {id: "grammalecte_tooltip"});
        let xMessageBlock = createNode("div", {id: "grammalecte_tooltip_message_block"});
        xMessageBlock.appendChild(createNode("p", {id: "grammalecte_tooltip_rule_id"}));
        xMessageBlock.appendChild(createNode("p", {id: "grammalecte_tooltip_message", textContent: "Erreur."}));
        xMessageBlock.appendChild(createNode("a", {id: "grammalecte_tooltip_ignore", href: "#", onclick: "return false;", textContent: "Ignorer"}));
        xMessageBlock.appendChild(createNode("a", {id: "grammalecte_tooltip_url", href: "#", onclick: "return false;", textContent: "Voulez-vous en savoir plus ?…"}));
        this.xTooltip.appendChild(xMessageBlock);
        this.xTooltip.appendChild(createNode("div", {id: "grammalecte_tooltip_sugg_title", textContent: "SUGGESTIONS :"}));
        this.xTooltipSuggBlock = createNode("div", {id: "grammalecte_tooltip_sugg_block"});
        this.xTooltip.appendChild(this.xTooltipSuggBlock);
    },

    show: function (sNodeErrorId) {  // err
        try {
            let xNodeErr = document.getElementById(sNodeErrorId);
            let nLimit = 500 - 330; // paragraph width - tooltip width
            this.xTooltipArrow.style.top = (xNodeErr.offsetTop + 16) + "px"
            this.xTooltipArrow.style.left = (xNodeErr.offsetLeft + Math.floor((xNodeErr.offsetWidth / 2))-4) + "px" // 4 is half the width of the arrow.
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
                    document.getElementById("grammalecte_tooltip_url").style.display = "inline";
                    document.getElementById("grammalecte_tooltip_url").setAttribute("href", xNodeErr.dataset.gc_url);
                } else {
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
    },

    setTooltipColor: function (bBlue) {
        // todo
    },

    hide () {
        this.xTooltipArrow.style.display = "none";
        this.xTooltip.style.display = "none";
    },

    _createSuggestion: function (sErrId, iSugg, sSugg) {
        let xNodeSugg = document.createElement("a");
        xNodeSugg.id = "sugg" + sErrId + "-" + iSugg.toString();
        xNodeSugg.className = "sugg";
        xNodeSugg.dataset.error_id = sErrId;
        xNodeSugg.textContent = sSugg;
        return xNodeSugg;
    },

    setSpellSuggestionsFor: function (sWord, sSuggestions, sErrId) {
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
