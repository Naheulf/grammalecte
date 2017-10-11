// Modify page

/*
    JS sucks (again, and again, and again, and again…)
    Not possible to load content from within the extension:
    https://bugzilla.mozilla.org/show_bug.cgi?id=1267027
    No SharedWorker, no images allowed for now…
*/

"use strict";


function showError (e) {
    console.error(e.fileName + "\n" + e.name + "\nline: " + e.lineNumber + "\n" + e.message);
}

// Chrome don’t follow the W3C specification:
// https://browserext.github.io/browserext/
let bChrome = false;
if (typeof(browser) !== "object") {
    var browser = chrome;
    bChrome = true;
}


/*
function loadImage (sContainerClass, sImagePath) {
    let xRequest = new XMLHttpRequest();
    xRequest.open('GET', browser.extension.getURL("")+sImagePath, false);
    xRequest.responseType = "arraybuffer";
    xRequest.send();
    let blobTxt = new Blob([xRequest.response], {type: 'image/png'});
    let img = document.createElement('img');
    img.src = (URL || webkitURL).createObjectURL(blobTxt); // webkitURL is obsolete: https://bugs.webkit.org/show_bug.cgi?id=167518
    Array.filter(document.getElementsByClassName(sContainerClass), function (oElem) {
        oElem.appendChild(img);
    });
}
*/

const oGrammalecte = {

    nMenu: 0,
    lMenu: [],

    oTFPanel: null,
    oLxgPanel: null,
    oGCPanel: null,

    createMenus: function () {
        let lNode = document.getElementsByTagName("textarea");
        for (let xNode of lNode) {
            if (xNode.style.display !== "none" && xNode.style.visibility !== "hidden") {
                this.lMenu.push(new GrammalecteMenu(this.nMenu, xNode));
                this.nMenu += 1;
            }
        }
    },

    createMenus2 () {
        let lNode = document.querySelectorAll("[contenteditable]");
        for (let xNode of lNode) {
            this.lMenu.push(new GrammalecteMenu(this.nMenu, xNode));
            this.nMenu += 1;
        }
    },

    rescanPage: function () {
        if (this.oTFPanel !== null) { this.oTFPanel.hide(); }
        if (this.oLxgPanel !== null) { this.oLxgPanel.hide(); }
        if (this.oGCPanel !== null) { this.oGCPanel.hide(); }
        for (let oMenu of this.lMenu) {
            oMenu.deleteNodes();
        }
        this.lMenu.length = 0; // to clear an array
        this.createMenus();
    },

    createTFPanel: function () {
        if (this.oTFPanel === null) {
            this.oTFPanel = new GrammalecteTextFormatter("grammalecte_tf_panel", "Formateur de texte", 760, 600, false);
            //this.oTFPanel.logInnerHTML();
            this.oTFPanel.insertIntoPage();
            this.oTFPanel.adjustHeight();
        }
    },

    createLxgPanel: function () {
        if (this.oLxgPanel === null) {
            this.oLxgPanel = new GrammalecteLexicographer("grammalecte_lxg_panel", "Lexicographe", 500, 700);
            this.oLxgPanel.insertIntoPage();
        }
    },

    createGCPanel: function () {
        if (this.oGCPanel === null) {
            this.oGCPanel = new GrammalecteGrammarChecker("grammalecte_gc_panel", "Grammalecte", 500, 700);
            this.oGCPanel.insertIntoPage();
        }
    },

    startGCPanel: function (xNode=null) {
        oGrammalecte.createGCPanel();
        oGrammalecte.oGCPanel.clear();
        oGrammalecte.oGCPanel.show();
        oGrammalecte.oGCPanel.start(xNode);
        oGrammalecte.oGCPanel.startWaitIcon();
    },

    startLxgPanel: function () {
        oGrammalecte.createLxgPanel();
        oGrammalecte.oLxgPanel.clear();
        oGrammalecte.oLxgPanel.show();
        oGrammalecte.oLxgPanel.startWaitIcon();
    },

    createNode: function (sType, oAttr, oDataset=null) {
        try {
            let xNode = document.createElement(sType);
            Object.assign(xNode, oAttr);
            if (oDataset) {
                Object.assign(xNode.dataset, oDataset);
            }
            return xNode;
        }
        catch (e) {
            showError(e);
        }
    }
}


/*
    Node where a right click is done
    Bug report: https://bugzilla.mozilla.org/show_bug.cgi?id=1325814
*/
let xRightClickedNode = null;
document.addEventListener('contextmenu', function (xEvent) {
    xRightClickedNode = xEvent.target;
}, true);


/*
    Connexion to the background
*/
let xGrammalectePort = browser.runtime.connect({name: "content-script port"});

xGrammalectePort.onMessage.addListener(function (oMessage) {
    let {sActionDone, result, dInfo, bEnd, bError} = oMessage;
    let sText = "";
    switch (sActionDone) {
        case "parseAndSpellcheck":
            if (!bEnd) {
                oGrammalecte.oGCPanel.addParagraphResult(result);
            } else {
                oGrammalecte.oGCPanel.stopWaitIcon();
            }
            break;
        case "parseAndSpellcheck1":
            oGrammalecte.oGCPanel.refreshParagraph(dInfo.sParagraphId, result);
            break;
        case "getListOfTokens":
            if (!bEnd) {
                oGrammalecte.oLxgPanel.addListOfTokens(result);
            } else {
                oGrammalecte.oLxgPanel.stopWaitIcon();
            }
            break;
        case "getSpellSuggestions":
            oGrammalecte.oGCPanel.oTooltip.setSpellSuggestionsFor(result.sWord, result.aSugg, dInfo.sErrorId);
            break;
        /*
            Commands received from the context menu
            (Context menu are initialized in background)
        */
        // Grammar checker commands
        case "rightClickGCEditableNode":
            oGrammalecte.startGCPanel(xRightClickedNode);
            sText = (xRightClickedNode.tagName == "TEXTAREA") ? xRightClickedNode.value : xRightClickedNode.textContent;
            xGrammalectePort.postMessage({
                sCommand: "parseAndSpellcheck",
                dParam: {sText: sText, sCountry: "FR", bDebug: false, bContext: false},
                dInfo: {sTextAreaId: xRightClickedNode.id}
            });
            break;
        case "rightClickGCPage":
            oGrammalecte.startGCPanel();
            xGrammalectePort.postMessage({
                sCommand: "parseAndSpellcheck",
                dParam: {sText: document.body.textContent, sCountry: "FR", bDebug: false, bContext: false},
                dInfo: {sTextAreaId: xRightClickedNode.id}
            });
            break;
        case "rightClickGCSelectedText":
            oGrammalecte.startGCPanel();
            // selected text is sent to the GC worker in the background script.
            break;
        // Lexicographer commands
        case "rightClickLxgEditableNode":
            oGrammalecte.startLxgPanel();
            sText = (xRightClickedNode.tagName == "TEXTAREA") ? xRightClickedNode.value : xRightClickedNode.textContent;
            xGrammalectePort.postMessage({
                sCommand: "getListOfTokens",
                dParam: {sText: sText},
                dInfo: {sTextAreaId: xRightClickedNode.id}
            });
            break;
        case "rightClickLxgPage":
            oGrammalecte.startLxgPanel();
            xGrammalectePort.postMessage({
                sCommand: "getListOfTokens",
                dParam: {sText: document.body.textContent},
                dInfo: {sTextAreaId: xRightClickedNode.id}
            });
            break;
        case "rightClickLxgSelectedText":
            oGrammalecte.startLxgPanel();
            // selected text is sent to the GC worker in the background script.
            break;
        // rescan page command
        case "rescanPage":
            oGrammalecte.rescanPage();
            break;
        default:
            console.log("[Content script] Unknown command: " + sActionDone);
    }
});


/*
    Start
*/
oGrammalecte.createMenus();
oGrammalecte.createMenus2();
