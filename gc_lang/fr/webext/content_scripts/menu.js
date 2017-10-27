// JavaScript

"use strict";


class GrammalecteMenu {

    constructor (nMenu, xNode) {
        this.sMenuId = "grammalecte_menu" + nMenu;
        this.xButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_main_button", textContent: " "});
        this.xButton.onclick = () => { this.switchMenu(); };
        this.xButton.style.zIndex = (xNode.style.zIndex.search(/^[0-9]+$/) !== -1) ? (parseInt(xNode.style.zIndex) + 1).toString() : xNode.style.zIndex;
        this.xMenu = this._createMenu(xNode);
        this._insertAfter(this.xButton, xNode);
        this._insertAfter(this.xMenu, xNode);
        this._createListenersOnReferenceNode(xNode);
    }

    _insertAfter (xNewNode, xReferenceNode) {
        xReferenceNode.parentNode.insertBefore(xNewNode, xReferenceNode.nextSibling);
    }

    _createListenersOnReferenceNode (xNode) {
        xNode.addEventListener('focus', (e) => {
            this.xButton.style.display = "block";
        });
        xNode.addEventListener('blur', (e) => {
            window.setTimeout(() => {this.xButton.style.display = "none";}, 300);
        });
    }

    _createMenu (xNode) {
        try {
            let xMenu = oGrammalecte.createNode("div", {id: this.sMenuId, className: "grammalecte_menu"});
            let xCloseButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_close_button", textContent: "×"} );
            xCloseButton.onclick = () => { this.switchMenu(); }
            xMenu.appendChild(xCloseButton);
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
                let sText = (xNode.tagName == "TEXTAREA") ? xNode.value : xNode.innerText;
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
                let sText = (xNode.tagName == "TEXTAREA") ? xNode.value : xNode.innerText;
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
        this.xMenu.style.display = (this.xMenu.style.display == "block") ? "none" : "block";
    }
}
