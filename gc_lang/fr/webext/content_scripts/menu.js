// JavaScript

"use strict";


class GrammalecteMenu {

    constructor (nMenu, xNode) {
        this.sMenuId = "grammalecte_menu" + nMenu;
        this.xButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_main_button", textContent: " "});
        this.xButton.onclick = () => { this.switchMenu(); };
        this.xMenu = this._createMenu(xNode);
        this._insertAfter(this.xButton, xNode);
        this._insertAfter(this.xMenu, xNode);
    }

    _insertAfter (xNewNode, xReferenceNode) {
        xReferenceNode.parentNode.insertBefore(xNewNode, xReferenceNode.nextSibling);
    }

    _createMenu (xNode) {
        try {
            let sText = (xNode.tagName == "TEXTAREA") ? xNode.value : xNode.textContent;
            let xMenu = oGrammalecte.createNode("div", {id: this.sMenuId, className: "grammalecte_menu"});
            xMenu.appendChild(oGrammalecte.createNode("div", {className: "grammalecte_menu_header", textContent: "GRAMMALECTE"}));
            // Text formatter
            if (xNode.tagName == "TEXTAREA") {
                let xTFButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item", textContent: "Formateur de texte"});
                xTFButton.onclick = () => {
                    this.switchMenu();
                    oGrammalecte.createTFPanel();
                    oGrammalecte.oTFPanel.start(xNode);
                    oGrammalecte.oTFPanel.show();
                };
                xMenu.appendChild(xTFButton);
            }
            // lexicographe
            let xLxgButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item", textContent: "Lexicographe"});
            xLxgButton.onclick = () => {
                this.switchMenu();
                oGrammalecte.startLxgPanel();
                xGrammalectePort.postMessage({
                    sCommand: "getListOfTokens",
                    dParam: {sText: sText},
                    dInfo: {sTextAreaId: xNode.id}
                });
            };
            xMenu.appendChild(xLxgButton);
            // Grammar checker
            let xGCButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item", textContent: "Correction grammaticale"});
            xGCButton.onclick = () => {
                this.switchMenu();
                oGrammalecte.startGCPanel(xNode);
                xGrammalectePort.postMessage({
                    sCommand: "parseAndSpellcheck",
                    dParam: {sText: sText, sCountry: "FR", bDebug: false, bContext: false},
                    dInfo: {sTextAreaId: xNode.id}
                });
            };
            xMenu.appendChild(xGCButton);
            // Conjugation tool
            let xConjButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item_block", textContent: "Conjugueur"});
            let xConjButtonTab = oGrammalecte.createNode("div", {className: "grammalecte_menu_button", textContent: "Onglet"});
            xConjButtonTab.onclick = () => {
                this.switchMenu();
                xGrammalectePort.postMessage({sCommand: "openConjugueurTab", dParam: null, dInfo: null});
            };
            let xConjButtonWin = oGrammalecte.createNode("div", {className: "grammalecte_menu_button", textContent: "Fenêtre"});
            xConjButtonWin.onclick = () => {
                this.switchMenu();
                xGrammalectePort.postMessage({sCommand: "openConjugueurWindow", dParam: null, dInfo: null});
            };
            xConjButton.appendChild(xConjButtonTab);
            xConjButton.appendChild(xConjButtonWin);
            xMenu.appendChild(xConjButton);
            //xMenu.appendChild(oGrammalecte.createNode("img", {scr: browser.extension.getURL("img/logo-16.png")}));
            // can’t work, due to content-script policy: https://bugzilla.mozilla.org/show_bug.cgi?id=1267027
            xMenu.appendChild(oGrammalecte.createNode("div", {className: "grammalecte_menu_footer"}));
            return xMenu;
        }
        catch (e) {
            showError(e);
        }
    }

    deleteNodes () {
        this.xMenu.parentNode.removeChild(this.xMenu);
        this.xButton.parentNode.removeChild(this.xButton);
    }

    switchMenu () {
        let xMenu = document.getElementById(this.sMenuId);
        xMenu.style.display = (xMenu.style.display == "block") ? "none" : "block";
    }
}
