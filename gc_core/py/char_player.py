# list of similar chars
# useful for suggestion mechanism


# Method: Remove Useless Chars

_dUselessChar = {
    'a': '',  'e': '',  'i': '',  'o': '',  'u': '',  'y': '',
    'à': '',  'é': '',  'î': '',  'ô': '',  'û': '',  'ÿ': '',
    'â': '',  'è': '',  'ï': '',  'ö': '',  'ù': '',  'ŷ': '',
    'ä': '',  'ê': '',  'í': '',  'ó': '',  'ü': '',  'ý': '',
    'á': '',  'ë': '',  'ì': '',  'ò': '',  'ú': '',  'ỳ': '',
    'ā': '',  'ē': '',  'ī': '',  'ō': '',  'ū': '',  'ȳ': '',
    'h': '',  'œ': '',  'æ': ''
 }

_CHARMAP = str.maketrans(_dUselessChar)

aUselessChar = frozenset(_dUselessChar.keys())

def clearWord (sWord):
    "remove vovels and h"
    return sWord.translate(_CHARMAP)


# Similar chars

d1to1 = {
    "1": "li",
    "2": "e",
    "3": "e",
    "4": "aà",
    "5": "ge",
    "6": "bd",
    "7": "lt",
    "8": "b",
    "9": "gbd",

    "a": "aàâáäæ",
    "à": "aàâáäæ",
    "â": "aàâáäæ",
    "á": "aàâáäæ",
    "ä": "aàâáäæ",

    "æ": "éa",

    "c": "cçskqśŝ",
    "ç": "cçskqśŝ",

    "e": "eéèêëœ",
    "é": "eéèêëœ",
    "ê": "eéèêëœ",
    "è": "eéèêëœ",
    "ë": "eéèêëœ",

    "f": "fv",

    "g": "gjq",
    
    "i": "iîïylíìÿ",
    "î": "iîïylíìÿ",
    "ï": "iîïylíìÿ",
    "í": "iîïylíìÿ",
    "ì": "iîïylíìÿ",

    "j": "jg",

    "k": "kcq",

    "l": "li",

    "n": "nñr",

    "o": "oôóòöœ",
    "ô": "oôóòöœ",
    "ó": "oôóòöœ",
    "ò": "oôóòöœ",
    "ö": "oôóòöœ",

    "œ": "œoôeéèêë",

    "p": "pb",

    "q": "ckg",

    "r": "rn",

    "s": "sśŝcç",
    "ś": "sśŝcç",
    "ŝ": "sśŝcç",

    "u": "uûùüú",
    "û": "uûùüú",
    "ù": "uûùüú",
    "ü": "uûùüú",
    "ú": "uûùüú",

    "v": "vwf",

    "w": "wv",

    "x": "xck",

    "y": "yÿiîŷýỳ",
    "ÿ": "yÿiîŷýỳ",
    "ŷ": "yÿiîŷýỳ",
    "ý": "yÿiîŷýỳ",
    "ỳ": "yÿiîŷýỳ",

    "z": "zs",
}

d1toX = {
    "æ": ("ae",),
    "b": ("bb",),
    "c": ("cc", "ss", "qu", "ch"),
    "ç": ("ss", "cc", "qh", "ch"),
    "d": ("dd",),
    "f": ("ff", "ph"),
    "g": ("gu", "ge", "gg", "gh"),
    "i": ("ii",),
    "j": ("jj", "dj"),
    "k": ("qu", "ck", "ch", "cu", "kk", "kh"),
    "l": ("ll",),
    "m": ("mm", "mn"),
    "n": ("nn", "nm", "mn"),
    "o": ("au", "eau", "aut"),
    "œ": ("oe", "eu"),
    "p": ("pp", "ph"),
    "q": ("qu", "ch", "cq", "ck", "kk"),
    "r": ("rr",),
    "s": ("ss", "sh"),
    "t": ("tt", "th"),
    "x": ("cc", "ct", "xx"),
    "z": ("ss", "zh")
}

d2toX = {
    "an": ("en",),
    "en": ("an",),
    "ai": ("ei", "é", "è", "ê", "ë"),
    "ei": ("ai", "ait", "ais", "é", "è", "ê", "ë"),
    "ch": ("sh", "c", "ss"),
    "ct": ("x", "cc"),
    "oa": ("oi",),
    "oi": ("oa", "oie"),
    "qu": ("q", "cq", "ck", "c", "k"),
}


# End of word

dFinal1 = {
    "a": ("as", "at", "ant"),

    "e": ("et", "er", "ets", "ée", "ez", "ai", "ais", "ait", "ent"),
    "é": ("et", "er", "ets", "ée", "ez", "ai", "ais", "ait"),
    "è": ("et", "er", "ets", "ée", "ez", "ai", "ais", "ait"),
    "ê": ("et", "er", "ets", "ée", "ez", "ai", "ais", "ait"),
    "ë": ("et", "er", "ets", "ée", "ez", "ai", "ais", "ait"),

    "i": ("is", "it", "ie", "in"),

    "n": ("nt", "nd", "ns"),

    "o": ("aut", "ot", "os"),
    "ô": ("aut", "ot", "os"),
    "ö": ("aut", "ot", "os"),

    "u": ("ut", "us"),
}

dFinal2 = {
    "ai": ("aient", "ais", "et"),
    "an": ("ant", "ent"),
    "en": ("ent", "ant"),
    "ei": ("ait", "ais"),
    "on": ("ons", "ont"),
    "oi": ("ois", "oit", "oix"),
}


# Préfixes

aPfx1 = frozenset([
    "anti", "archi", "contre", "hyper", "mé", "méta", "im", "in", "ir", "par", "proto",
    "pseudo", "pré", "re", "ré", "sans", "sous", "supra", "sur", "ultra"
])
aPfx2 = frozenset([
    "belgo", "franco", "génito", "gynéco", "médico", "russo"
])
