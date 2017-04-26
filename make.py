#!python3
# coding: UTF-8

import sys
import os
import subprocess
import re
import zipfile
import traceback
import configparser
import datetime
import argparse
import importlib
import unittest
import json

from string import Template
from distutils import dir_util, file_util

import dialog_bundled
import compile_rules


sWarningMessage = "The content of this folder is generated by code and replaced at each build.\n"


class cd:
    """Context manager for changing the current working directory"""
    def __init__ (self, newPath):
        self.newPath = os.path.expanduser(newPath)

    def __enter__ (self):
        self.savedPath = os.getcwd()
        os.chdir(self.newPath)

    def __exit__ (self, etype, value, traceback):
        os.chdir(self.savedPath)


def fileFile (spf, dVars):
    return Template(open(spf, "r", encoding="utf-8").read()).safe_substitute(dVars)


def copyAndFileTemplate (spfSrc, spfDst, dVars):
    s = Template(open(spfSrc, "r", encoding="utf-8").read()).safe_substitute(dVars)
    open(spfDst, "w", encoding="utf-8", newline="\n").write(s)


def addFolderToZipAndFileFile (hZip, spSrc, spDst, dVars, bRecursive):
    # recursive function
    spSrc = spSrc.strip("/ ")
    spDst = spDst.strip("/ ")
    for sf in os.listdir(spSrc):
        spfSrc = (spSrc + "/" + sf).strip("/ ")
        spfDst = (spDst + "/" + sf).strip("/ ")
        if os.path.isdir(spfSrc):
            if bRecursive:
                addFolderToZipAndFileFile(hZip, spfSrc, spfDst, dVars, bRecursive)
        else:
            if spfSrc.endswith((".css", ".js", ".xcu", ".xul", ".rdf", ".dtd", ".properties")):
                #print(spfSrc + " > " + spfDst)
                hZip.writestr(spfDst, fileFile(spfSrc, dVars))
            else:
                #print(spfSrc + " > " + spfDst)
                hZip.write(spfSrc, spfDst)


def unzip (spfZip, spDest, bCreatePath=False):
    if spDest:
        if bCreatePath and not os.path.exists(spDest):
            dir_util.mkpath(spDest)
        print("> unzip in: "+ spDest)
        spInstall = os.path.abspath(spDest)
        if os.path.isdir(spInstall):
            eraseFolder(spInstall)
            with zipfile.ZipFile(spfZip) as hZip:
                hZip.extractall(spDest)
        else:
            print("# folder not found")
    else:
        print("path destination is empty")


def eraseFolder (sp):
    # recursive!!!
    for sf in os.listdir(sp):
        spf = sp + "/" + sf
        if os.path.isdir(spf):
            eraseFolder(spf)
        else:
            try:
                os.remove(spf)
            except:
                print("%s not removed" % spf)


def createCleanFolder (sp):
    if not os.path.exists(sp):
        dir_util.mkpath(sp)
    else:
        eraseFolder(sp)


def getConfig (sLang):
    xConfig = configparser.SafeConfigParser()
    xConfig.optionxform = str
    try:
        xConfig.read("gc_lang/" + sLang + "/config.ini", encoding="utf-8")
    except:
        print("Config file in project [" + sLang + "] not found")
        exit()
    return xConfig


def createOptionsLabelProperties (dOptLbl):
    sContent = ""
    for sOpt, tLabel in dOptLbl.items():
        sContent += sOpt + "=" + tLabel[0] + "\n"
        if tLabel[1]:
            sContent += "hlp_" + sOpt + "=" + tLabel[1] + "\n"
    return sContent


def createDialogOptionsXDL (dVars):
    sFixedline = '<dlg:fixedline dlg:id="{0}" dlg:tab-index="{1}" dlg:top="{2}" dlg:left="5" dlg:width="{3}" dlg:height="10" dlg:value="&amp;{0}" />\n'
    sCheckbox = '<dlg:checkbox dlg:id="{0}" dlg:tab-index="{1}" dlg:top="{2}" dlg:left="{3}" dlg:width="{4}" dlg:height="10" dlg:value="&amp;{0}" dlg:checked="{5}" {6} />\n'
    iTabIndex = 1
    nPosY = 5
    nWidth = 240
    sContent = ""
    dOpt = dVars["dOptPython"]
    dOptLabel = dVars["dOptLabel"][dVars["lang"]]
    for sGroup, lGroupOptions in dVars["lStructOpt"]:
        sContent += sFixedline.format(sGroup, iTabIndex, nPosY, nWidth)
        iTabIndex += 1
        for lLineOptions in lGroupOptions:
            nElemWidth = nWidth // len(lLineOptions)
            nPosY += 10
            nPosX = 10
            for sOpt in lLineOptions:
                sHelp = 'dlg:help-text="&amp;hlp_%s"'%sOpt  if dOptLabel[sOpt][1]  else ""
                sContent += sCheckbox.format(sOpt, iTabIndex, nPosY, nPosX, nElemWidth, "true" if dOpt[sOpt] else "false", sHelp)
                iTabIndex += 1
                nPosX += nElemWidth
        nPosY += 10
    return sContent


def createOXT (spLang, dVars, dOxt, spLangPack, bInstall):
    "create extension for Writer"
    print("Building extension for Writer")
    spfZip = "_build/" + dVars['name'] + "-"+ dVars['lang'] +"-v" + dVars['version'] + '.oxt'
    hZip = zipfile.ZipFile(spfZip, mode='w', compression=zipfile.ZIP_DEFLATED)

    # Package and parser
    copyGrammalectePyPackageInZipFile(hZip, spLangPack, dVars['py_binary_dic'], "pythonpath/")
    hZip.write("cli.py", "pythonpath/cli.py")

    # Extension files
    hZip.writestr("META-INF/manifest.xml", fileFile("gc_core/py/oxt/manifest.xml", dVars))
    hZip.writestr("description.xml", fileFile("gc_core/py/oxt/description.xml", dVars))
    hZip.writestr("Linguistic.xcu", fileFile("gc_core/py/oxt/Linguistic.xcu", dVars))
    hZip.writestr("Grammalecte.py", fileFile("gc_core/py/oxt/Grammalecte.py", dVars))

    for sf in dVars["extras"].split(","):
        hZip.writestr(sf.strip(), fileFile(spLang + '/' + sf.strip(), dVars))

    if "logo" in dVars.keys() and dVars["logo"].strip():
        hZip.write(spLang + '/' + dVars["logo"].strip(), dVars["logo"].strip())

    ## OPTIONS
    # options dialog within LO/OO options panel (legacy)
    #hZip.writestr("pythonpath/lightproof_handler_grammalecte.py", fileFile("gc_core/py/oxt/lightproof_handler_grammalecte.py", dVars))
    #lLineOptions = open(spLang + "/options.txt", "r", encoding="utf-8").readlines()
    #dialog_bundled.c(dVars["implname"], lLineOptions, hZip, dVars["lang"])

    # options dialog
    hZip.writestr("pythonpath/Options.py", fileFile("gc_core/py/oxt/Options.py", dVars))
    hZip.write("gc_core/py/oxt/op_strings.py", "pythonpath/op_strings.py")
    # options dialog within Writer options panel
    dVars["xdl_dialog_options"] = createDialogOptionsXDL(dVars)
    dVars["xcs_options"] = "\n".join([ '<prop oor:name="'+sOpt+'" oor:type="xs:string"><value></value></prop>' for sOpt in dVars["dOptPython"] ])
    dVars["xcu_label_values"] = "\n".join([ '<value xml:lang="'+sLang+'">' + dVars["dOptLabel"][sLang]["__optiontitle__"] + '</value>'  for sLang in dVars["dOptLabel"] ])
    hZip.writestr("dialog/options_page.xdl", fileFile("gc_core/py/oxt/options_page.xdl", dVars))
    hZip.writestr("dialog/OptionsDialog.xcs", fileFile("gc_core/py/oxt/OptionsDialog.xcs", dVars))
    hZip.writestr("dialog/OptionsDialog.xcu", fileFile("gc_core/py/oxt/OptionsDialog.xcu", dVars))
    hZip.writestr("dialog/" + dVars['lang'] + "_en.default", "")
    for sLangLbl, dOptLbl in dVars['dOptLabel'].items():
        hZip.writestr("dialog/" + dVars['lang'] + "_" + sLangLbl + ".properties", createOptionsLabelProperties(dOptLbl))

    ## ADDONS OXT
    print("+ OXT: ", end="")
    for spfSrc, spfDst in dOxt.items():
        print(spfSrc, end=", ")
        if os.path.isdir(spLang+'/'+spfSrc):
            for sf in os.listdir(spLang+'/'+spfSrc):
                hZip.write(spLang+'/'+spfSrc+"/"+sf, spfDst+"/"+sf)
        else:
            if spfSrc.endswith(('.txt', '.py')):
                hZip.writestr(spfDst, fileFile(spLang+'/'+spfSrc, dVars))
            else:
                hZip.write(spLang+'/'+spfSrc, spfDst)
    print()
    hZip.close()

    # Installation in Writer profile
    if bInstall:
        print("> installation in Writer")
        if dVars.get('unopkg', False):
            cmd = '"'+os.path.abspath(dVars.get('unopkg')+'" add -f '+spfZip)
            print(cmd)
            #subprocess.run(cmd)
            os.system(cmd)
        else:
            print("# Error: path and filename of unopkg not set in config.ini")


def createOptionsForFirefox (dVars):
    sHTML = ""
    for sSection, lOpt in dVars['lStructOpt']:
        sHTML += '\n<div id="subsection_' + sSection + '" class="opt_subsection">\n  <h2 data-l10n-id="option_'+sSection+'"></h2>\n'
        for lLineOpt in lOpt:
            for sOpt in lLineOpt:
                sHTML += '  <p><input type="checkbox" id="option_'+sOpt+'" /><label id="option_label_'+sOpt+'" for="option_'+sOpt+'" data-l10n-id="option_'+sOpt+'"></label></p>\n'
        sHTML += '</div>\n'
    # Creating translation data
    dProperties = {}
    for sLang in dVars['dOptLabel'].keys():
        dProperties[sLang] = "\n".join( [ "option_" + sOpt + " = " + dVars['dOptLabel'][sLang][sOpt][0].replace(" [!]", " [!]")  for sOpt in dVars['dOptLabel'][sLang] ] )
    return sHTML, dProperties


def createFirefoxExtension (sLang, dVars):
    "create extension for Firefox"
    print("Building extension for Firefox")
    eraseFolder("_build/xpi/"+sLang)
    dir_util.copy_tree("gc_lang/"+sLang+"/xpi/", "_build/xpi/"+sLang)
    dir_util.copy_tree("grammalecte-js", "_build/xpi/"+sLang+"/grammalecte")
    sHTML, dProperties = createOptionsForFirefox(dVars)
    dVars['optionsHTML'] = sHTML
    copyAndFileTemplate("_build/xpi/"+sLang+"/data/about_panel.html", "_build/xpi/"+sLang+"/data/about_panel.html", dVars)
    for sLocale in dProperties.keys():
        spfLocale = "_build/xpi/"+sLang+"/locale/"+sLocale+".properties"
        if os.path.exists(spfLocale):
            copyAndFileTemplate(spfLocale, spfLocale, dProperties)
        else:
            print("Locale file not found: " + spfLocale)
    with cd("_build/xpi/"+sLang):
        os.system("jpm xpi")


def createOptionsForThunderbird (dVars):
    dVars['sXULTabs'] = ""
    dVars['sXULTabPanels'] = ""
    # dialog options
    for sSection, lOpt in dVars['lStructOpt']:
        dVars['sXULTabs'] += '    <tab label="&option.label.'+sSection+';"/>\n'
        dVars['sXULTabPanels'] += '    <tabpanel orient="vertical">\n      <label class="section" value="&option.label.'+sSection+';" />\n'
        for lLineOpt in lOpt:
            for sOpt in lLineOpt:
                dVars['sXULTabPanels'] += '      <checkbox id="option_'+sOpt+'" class="option" label="&option.label.'+sOpt+';" />\n'
        dVars['sXULTabPanels'] += '    </tabpanel>\n'
    # translation data
    for sLang in dVars['dOptLabel'].keys():
        dVars['gc_options_labels_'+sLang] = "\n".join( [ "<!ENTITY option.label." + sOpt + ' "' + dVars['dOptLabel'][sLang][sOpt][0] + '">'  for sOpt in dVars['dOptLabel'][sLang] ] )
    return dVars


def createThunderbirdExtension (sLang, dVars, spLangPack):
    "create extension for Thunderbird"
    print("Building extension for Thunderbird")
    sExtensionName = dVars['tb_identifier'] + "-v" + dVars['version'] + '.xpi'
    spfZip = "_build/" + sExtensionName
    hZip = zipfile.ZipFile(spfZip, mode='w', compression=zipfile.ZIP_DEFLATED)
    copyGrammalecteJSPackageInZipFile(hZip, spLangPack, dVars['js_binary_dic'])
    for spf in ["LICENSE.txt", "LICENSE.fr.txt"]:
        hZip.write(spf)
    dVars = createOptionsForThunderbird(dVars)
    addFolderToZipAndFileFile(hZip, "gc_lang/"+sLang+"/tb", "", dVars, True)
    hZip.write("gc_lang/"+sLang+"/xpi/gce_worker.js", "worker/gce_worker.js")
    spDict = "gc_lang/"+sLang+"/xpi/data/dictionaries"
    for sp in os.listdir(spDict):
        if os.path.isdir(spDict+"/"+sp):
            hZip.write(spDict+"/"+sp+"/"+sp+".dic", "content/dictionaries/"+sp+"/"+sp+".dic")
            hZip.write(spDict+"/"+sp+"/"+sp+".aff", "content/dictionaries/"+sp+"/"+sp+".aff")
    hZip.close()
    unzip(spfZip, dVars['tb_debug_extension_path'])


def createServerOptions (sLang, dOptData):
    with open("server_options."+sLang+".ini", "w", encoding="utf-8", newline="\n") as hDst:
        hDst.write("# Server options. Lang: " + sLang + "\n\n[gc_options]\n")
        for sSection, lOpt in dOptData["lStructOpt"]:
            hDst.write("\n########## " + dOptData["dOptLabel"][sLang].get(sSection, sSection + "[no label found]")[0] + " ##########\n")
            for lLineOpt in lOpt:
                for sOpt in lLineOpt:
                    hDst.write("# " + dOptData["dOptLabel"][sLang].get(sOpt, "[no label found]")[0] + "\n")
                    hDst.write(sOpt + " = " + ("1" if dOptData["dOptPython"].get(sOpt, None) else "0") + "\n")
        hDst.write("html = 1\n")


def createServerZip (sLang, dVars, spLangPack):
    "create server zip"
    spfZip = "_build/" + dVars['name'] + "-"+ dVars['lang'] +"-v" + dVars['version'] + '.zip'
    hZip = zipfile.ZipFile(spfZip, mode='w', compression=zipfile.ZIP_DEFLATED)
    copyGrammalectePyPackageInZipFile(hZip, spLangPack, dVars['py_binary_dic'])
    for spf in ["cli.py", "server.py", "bottle.py", "server_options._global.ini", "server_options."+sLang+".ini", \
                "README.txt", "LICENSE.txt", "LICENSE.fr.txt"]:
        hZip.write(spf)
    hZip.writestr("setup.py", fileFile("gc_lang/fr/setup.py", dVars))


def copyGrammalectePyPackageInZipFile (hZip, spLangPack, sDicName, sAddPath=""):
    for sf in os.listdir("grammalecte"):
        if not os.path.isdir("grammalecte/"+sf):
            hZip.write("grammalecte/"+sf, sAddPath+"grammalecte/"+sf)
    for sf in os.listdir(spLangPack):
        if not os.path.isdir(spLangPack+"/"+sf):
            hZip.write(spLangPack+"/"+sf, sAddPath+spLangPack+"/"+sf)
    hZip.write("grammalecte/_dictionaries/"+sDicName, sAddPath+"grammalecte/_dictionaries/"+sDicName)


def copyGrammalecteJSPackageInZipFile (hZip, spLangPack, sDicName, sAddPath=""):
    for sf in os.listdir("grammalecte-js"):
        if not os.path.isdir("grammalecte-js/"+sf):
            hZip.write("grammalecte-js/"+sf, sAddPath+"grammalecte-js/"+sf)
    for sf in os.listdir(spLangPack):
        if not os.path.isdir(spLangPack+"/"+sf):
            hZip.write(spLangPack+"/"+sf, sAddPath+spLangPack+"/"+sf)
    hZip.write("grammalecte-js/_dictionaries/"+sDicName, sAddPath+"grammalecte-js/_dictionaries/"+sDicName)


def create (sLang, xConfig, bInstallOXT, bJavaScript):
    oNow = datetime.datetime.now()
    print("============== MAKE GRAMMALECTE [{0}] at {1.hour:>2} h {1.minute:>2} min {1.second:>2} s ==============".format(sLang, oNow))

    #### READ CONFIGURATION
    print("> read configuration...")
    spLang = "gc_lang/" + sLang

    dVars = xConfig._sections['args']
    dVars['locales'] = dVars["locales"].replace("_", "-")
    dVars['loc'] = str(dict([ [s, [s[0:2], s[3:5], ""]] for s in dVars["locales"].split(" ") ]))

    ## COMPILE RULES
    print("> read rules file...")
    try:
        lRules = open(spLang + "/rules.grx", 'r', encoding="utf-8").readlines()
    except:
        print("Rules file in project [" + sLang + "] not found")
        return
    dVars.update(compile_rules.make(lRules, dVars['lang'], bJavaScript))

    ## READ GRAMMAR CHECKER PLUGINS
    print("PYTHON:")
    print("+ Plugins: ", end="")
    sCodePlugins = ""
    for sf in os.listdir(spLang+"/modules"):
        if re.match(r"gce_\w+[.]py$", sf):
            sCodePlugins += "\n\n" + open(spLang+'/modules/'+sf, "r", encoding="utf-8").read()
            print(sf, end=", ")
    print()
    dVars["plugins"] = sCodePlugins

    ## CREATE GRAMMAR CHECKER PACKAGE
    spLangPack = "grammalecte/"+sLang
    createCleanFolder(spLangPack)
    for sf in os.listdir("gc_core/py/lang_core"):
        if not os.path.isdir("gc_core/py/lang_core/"+sf):
            copyAndFileTemplate("gc_core/py/lang_core/"+sf, spLangPack+"/"+sf, dVars)
    print("+ Modules: ", end="")
    for sf in os.listdir(spLang+"/modules"):
        if not sf.endswith(".tpl.py") and not sf.startswith("gce_"):
            file_util.copy_file(spLang+"/modules/"+sf, spLangPack)
            print(sf, end=", ")
    print()

    createOXT(spLang, dVars, xConfig._sections['oxt'], spLangPack, bInstallOXT)

    createServerOptions(sLang, dVars)
    createServerZip(sLang, dVars, spLangPack)

    #### JAVASCRIPT
    if bJavaScript:
        print("JAVASCRIPT:")
        print("+ Plugins: ", end="")
        sCodePlugins = ""
        for sf in os.listdir(spLang+"/modules-js"):
            if re.match(r"gce_\w+[.]js$", sf):
                sCodePlugins += "\n\n" + open(spLang+'/modules-js/'+sf, "r", encoding="utf-8").read()
                print(sf, end=", ")
        print()
        dVars["pluginsJS"] = sCodePlugins

        # options data struct
        dVars["dOptJavaScript"] = json.dumps(list(dVars["dOptJavaScript"].items()))
        
        # create folder
        spLangPack = "grammalecte-js/"+sLang
        createCleanFolder(spLangPack)

        # create files
        for sf in os.listdir("gc_core/js"):
            if not os.path.isdir("gc_core/js/"+sf) and sf.startswith("jsex_"):
                dVars[sf[5:-3]] = open("gc_core/js/"+sf, "r", encoding="utf-8").read()
        for sf in os.listdir("gc_core/js"):
            if not os.path.isdir("gc_core/js/"+sf) and not sf.startswith("jsex_"):
                copyAndFileTemplate("gc_core/js/"+sf, "grammalecte-js/"+sf, dVars)
        open("grammalecte-js/WARNING.txt", "w", encoding="utf-8", newline="\n").write(sWarningMessage)
        for sf in os.listdir("gc_core/js/lang_core"):
            if not os.path.isdir("gc_core/js/lang_core/"+sf) and sf.startswith("gc_"):
                copyAndFileTemplate("gc_core/js/lang_core/"+sf, spLangPack+"/"+sf, dVars)
        print("+ Modules: ", end="")
        for sf in os.listdir(spLang+"/modules-js"):
            if not sf.endswith(".tpl.js") and not sf.startswith("gce_"):
                copyAndFileTemplate(spLang+"/modules-js/"+sf, spLangPack+"/"+sf, dVars)
                print(sf, end=", ")
        print()

        createFirefoxExtension(sLang, dVars)
        createThunderbirdExtension(sLang, dVars, spLangPack)

    return dVars['version']


def main ():
    print("Python: " + sys.version)
    xParser = argparse.ArgumentParser()
    xParser.add_argument("lang", type=str, nargs='+', help="lang project to generate (name of folder in /lang)")
    xParser.add_argument("-b", "--build_data", help="launch build_data.py", action="store_true")
    xParser.add_argument("-d", "--dict", help="generate FSA dictionary", action="store_true")
    xParser.add_argument("-t", "--tests", help="run unit tests", action="store_true")
    xParser.add_argument("-p", "--perf", help="run performance tests", action="store_true")
    xParser.add_argument("-js", "--javascript", help="JavaScript build for Firefox", action="store_true")
    xParser.add_argument("-fx", "--firefox", help="Launch Firefox Nightly for XPI testing", action="store_true")
    xParser.add_argument("-tb", "--thunderbird", help="Launch Thunderbird", action="store_true")
    xParser.add_argument("-i", "--install", help="install the extension in Writer (path of unopkg must be set in config.ini)", action="store_true")
    xArgs = xParser.parse_args()

    dir_util.mkpath("_build")
    dir_util.mkpath("grammalecte")
    dir_util.mkpath("grammalecte-js")

    for sLang in xArgs.lang:
        if os.path.exists("gc_lang/"+sLang) and os.path.isdir("gc_lang/"+sLang):
            xConfig = getConfig(sLang)
            dVars = xConfig._sections['args']

            # copy gc_core common file in Python now to be able to compile dictionary if required
            for sf in os.listdir("gc_core/py"):
                if not os.path.isdir("gc_core/py/"+sf):
                    copyAndFileTemplate("gc_core/py/"+sf, "grammalecte/"+sf, dVars)
            open("grammalecte/WARNING.txt", "w", encoding="utf-8", newline="\n").write(sWarningMessage)

            # build data
            build_module = None
            if xArgs.build_data:
                # lang data
                try:
                    build_module = importlib.import_module("gc_lang."+sLang+".build_data")
                except ImportError:
                    print("# Error. Couldn’t import file build_data.py in folder gc_lang/"+sLang)
            if build_module:
                build_module.before('gc_lang/'+sLang, dVars, xArgs.javascript)
            if xArgs.dict or not os.path.exists("grammalecte/_dictionaries"):
                import grammalecte.dawg as fsa
                from grammalecte.ibdawg import IBDAWG
                # fsa builder
                oDAWG = fsa.DAWG(dVars['lexicon_src'], dVars['lang_name'], dVars['stemming_method'])
                dir_util.mkpath("grammalecte/_dictionaries")
                oDAWG.writeInfo("grammalecte/_dictionaries/" + dVars['py_binary_dic'] + ".info.txt")
                oDAWG.createBinary("grammalecte/_dictionaries/" + dVars['py_binary_dic'], int(dVars['fsa_method']))
                if xArgs.javascript:
                    dir_util.mkpath("grammalecte-js/_dictionaries")
                    oDic = IBDAWG(dVars['py_binary_dic'])
                    #oDic.writeAsJSObject("gc_lang/"+sLang+"/modules-js/dictionary.js")
                    oDic.writeAsJSObject("grammalecte-js/_dictionaries/"+dVars['js_binary_dic'])
            if build_module:
                build_module.after('gc_lang/'+sLang, dVars, xArgs.javascript)

            # make
            sVersion = create(sLang, xConfig, xArgs.install, xArgs.javascript, )

            # tests
            if xArgs.tests or xArgs.perf:
                print("> Running tests")
                try:
                    tests = importlib.import_module("tests."+sLang+"_test")
                    print(tests.__file__)
                except ImportError:
                    print("# Error. Couldn't import file {}_test.py in folder tests".format(sLang))
                else:
                    if xArgs.tests:
                        xTestSuite = unittest.TestLoader().loadTestsFromModule(tests)
                        unittest.TextTestRunner().run(xTestSuite)
                    if xArgs.perf:
                        tests.perf(sVersion)

            # Firefox
            if xArgs.firefox:
                with cd("_build/xpi/"+sLang):
                    os.system("jpm run -b nightly")

            # Thunderbird
            if xArgs.thunderbird:
                os.system("thunderbird -jsconsole -P debug")
        else:
            print("Folder not found: gc_lang/"+sLang)


if __name__ == '__main__':
    main()
