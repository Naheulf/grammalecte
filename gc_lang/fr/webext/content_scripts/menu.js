// JavaScript

"use strict";


class GrammalecteMenu {

    constructor (nMenu, xNode) {
        this.xNode = xNode;
        this.sMenuId = "grammalecte_menu" + nMenu;
        this.xButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_main_button", textContent: " "});
        this.xButton.onclick = () => { this.switchMenu(); };
        this.xButton.style.zIndex = (xNode.style.zIndex.search(/^[0-9]+$/) !== -1) ? (parseInt(xNode.style.zIndex) + 1).toString() : xNode.style.zIndex;
        this.xMenu = this._createMenu();

        let style = window.getComputedStyle(this.xNode);
        this.topMargin = -1 * (8 + parseInt(style.marginBottom.replace('px', ''), 10));

        this._insertAfter(this.xButton);
        this.xButton.style.marginTop = this.topMargin + 'px';

        this._insertAfter(this.xMenu);
        this.xMenu.style.marginTop = (this.topMargin + 8) + 'px';

        this._createListenersOnReferenceNode();
    }

    _insertAfter (xNewNode) {
        this.xNode.parentNode.insertBefore(xNewNode, this.xNode.nextSibling);
    }

    _createListenersOnReferenceNode () {
        this.xNode.addEventListener('focus', (e) => {
            this.xButton.style.display = "block";
        });
        this.xNode.addEventListener('blur', (e) => {
            window.setTimeout(() => {this.xButton.style.display = "none";}, 300);
        });
    }

    _getText () {
        return (this.xNode.tagName == "TEXTAREA") ? this.xNode.value : this.xNode.innerText;
    }

    _createMenu () {
        try {
            let xMenu = oGrammalecte.createNode("div", {id: this.sMenuId, className: "grammalecte_menu"});
            let xCloseButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_close_button", textContent: "×"} );
            xCloseButton.onclick = () => { this.switchMenu(); }
            xMenu.appendChild(xCloseButton);
            xMenu.appendChild(oGrammalecte.createNode("div", {className: "grammalecte_menu_header", textContent: "GRAMMALECTE"}));
            // Text formatter
            if (this.xNode.tagName == "TEXTAREA") {
                let xTFButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item", textContent: "Formateur de texte"});
                xTFButton.onclick = () => {
                    this.switchMenu();
                    oGrammalecte.createTFPanel();
                    oGrammalecte.oTFPanel.start(this.xNode);
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
                    dParam: {sText: this._getText()},
                    dInfo: {sTextAreaId: this.xNode.id}
                });
            };
            xMenu.appendChild(xLxgButton);
            // Grammar checker
            let xGCButton = oGrammalecte.createNode("div", {className: "grammalecte_menu_item", textContent: "Correction grammaticale"});
            xGCButton.onclick = () => {
                this.switchMenu();
                oGrammalecte.startGCPanel(this.xNode);
                xGrammalectePort.postMessage({
                    sCommand: "parseAndSpellcheck",
                    dParam: {sText: this._getText(), sCountry: "FR", bDebug: false, bContext: false},
                    dInfo: {sTextAreaId: this.xNode.id}
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
