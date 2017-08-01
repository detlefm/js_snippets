var $Helper = (function () {
    "use strict";

    function _trimChar(str, charToRemove) {
        while (str.charAt(0) == charToRemove) {
            str = str.substring(1);
        }
        while (str.charAt(str.length - 1) == charToRemove) {
            str = str.substring(0, str.length - 1);
        }
        return str;
    }

    function _charCount(str, ch) {
        let n = 0;
        for (let x of str) {
            if (x == ch) n++;
        }
        return n;
    }

    function _replaceAll(str, srch, repl) {
        while (str.indexOf(srch) > -1)
            str = str.replace(srch, repl);
        return str;
    }


    return {
        trimChar: function (str, charToRemove) {
            return _trimChar(str, charToRemove);
        },
        charCount: function (str, ch) {
            return _charCount(str, ch);
        },
        replaceAll: function (str, srch, repl) {
            return _replaceAll(str, srch, repl);
        }

    };
})();

var $DtaHelper = (function () {
    "use strict";

    let buffer = { source: '', is_ref: false, ref: '', text: '' }

    function _is_empty(str) {
        if (str) {
            let s = str.trim();
            if (s.length === 0 ||
                (s.length === 1 && s.charAt(0) === '.')) {
                return true;
            }
            return false;
        }
        return true;
    }

    function __is_in_buffer(str) {
        if (buffer.source === str)
            return true;
        return false;
    }


    
    // urls
    // markdown -> [Text](url) or [Text](url "Title") or http* or <http*
    // woas -> [[url|Text]] or [[url]]
    // short form -> url|Text or just url

    function __is_simplehttp(str) {
        let ls = str.toLowerCase();
        // http(s)://sample.com or <http(s)://sample.com>
        // works for csv (woas) and markdown
        if (ls.startsWith("http") || ls.startsWith("<http"))
            return true;
        return false;
    }

    function __fill_buffer(str) {
        buffer.source = str;
        buffer.is_ref = false;
        buffer.text = str;
        if (str) {
            if ((str.startsWith("[") && str.endsWith(")")) ||
                __is_simplehttp(str)) {
                buffer.is_ref = true;
                if (str.startsWith("<") && str.endsWith(">")) {
                    buffer.href = str.substring(1,str.length-1);
                    buffer.text = buffer.href
                } else if (str.startsWith("http")) {
                    let pos = str.indexOf("|");
                    if (pos > -1) {
                        buffer.href = str.substring(0, pos);
                        buffer.text = str.substring(pos + 1, str.length);
                    } else {
                        buffer.href = str;
                    }
                } else {
                    let tmp = str.substring(1, str.length - 1);
                    tmp = tmp.trim();
                    let pos = tmp.indexOf("](");
                    if (pos > -1) {
                        buffer.text = tmp.substring(0, pos);
                        buffer.href = tmp.substring(pos + 2, tmp.length);
                    }
                }
            }
        }
    }


    function _is_href(str) {
        if (!__is_in_buffer(str))
            __fill_buffer(str);
        return buffer.is_ref;
    }

    function _get_href(str) {
        let result = {}
        if (!__is_in_buffer(str))
            __fill_buffer(str);
        result.text = buffer.text;
        result.url = buffer.href;
        return result;
    }

    
    return {
        is_empty: function (str) {
            return _is_empty(str);
        },
        is_href: function (str) {
            return _is_href(str);
        },
        get_href: function (str) {
            return _get_href(str);
        }
    };
})();


var $ToJson = (function () {
    "use strict";

    function _csv_reader(txt, delimiter, linefeed) {
        let result = [];
        let lines = txt.split(linefeed);
        let headers = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line != '') {
                if (headers.length == 0) {
                    headers = line.toLowerCase().split(delimiter);
                } else {
                    let token = line.split(delimiter);
                    let obj = {};
                    for (let j = 0; j < headers.length; j++) {
                        obj[headers[j]] = token[j];
                    }
                    result.push(obj);
                }
            }
        }
        return { "headers": headers, "result": result };
    }


    function testchars(str, chars) {
        for (let x of str) {
            if (chars.indexOf(x) === -1)
                return false;
        }
        return true;
    }


    function __tst_tblmarker(str) {
        // delete all format info
        let t = $Helper.replaceAll(str, "|:", "|")
        t = $Helper.replaceAll(str, ":|", "|");
        // normalize dashes
        t = $Helper.replaceAll(t, "--", "-");
        // delete all space
        t = $Helper.replaceAll(t, " ", "");
        // because we got a string without trailing and leading delimiter
        // there can't be a trailing and leading delimiter
        if (t.charAt(0) === '|' || t.charAt(t.length - 1) === '|')
            return false;
        // at this point only | and - are allowed
        if (testchars(t, "|-") === false)
            return false;
        // the string must start and end with -
        if (t.charAt(t.length - 1) !== "-" || t.charAt(0) !== "-")
            return false;
        // and two or more | are not allowed 
        if (t.indexOf("||") > -1)
            return false;
        // we need to have n of | and one more of -
        let p = $Helper.charCount(t, '|');
        if ($Helper.charCount(t, '-') === (p + 1))
            return true;
        return false;
    }


    function _markdown(txt, linefeed) {
        let delimiter = "|";
        let result = [];
        let lines = txt.split(linefeed);
        let tablemarker = false;
        let headers = [];
        // for (let i = 0; i < lines.length; i++) {
        for (let line of lines) {
            //let line = lines[i].trim();
            line = line.trim();
            if (line.startsWith(delimiter))
                line = line.substring(1);
            if (line.endsWith(delimiter))
                line = line.substring(0,line.length-1);
            //line = $Helper.trimChar(line, delimiter);
            // check if delimiter exists
            if (line.indexOf(delimiter) === -1) {
                // when no headers exists we search next line
                if (headers.length === 0) {
                    continue;
                }
                // otherwise end of table detected
                else {
                    if (tablemarker) {
                        // tablemarker wasn't found, clear headers
                        headers = [];
                    }
                    break;
                }
            }
            // ok - something is found
            if (line != '') {
                // we have headers and waiting for the tablemarker
                if (tablemarker) {
                    tablemarker = false;
                    if (!__tst_tblmarker(line)) {
                        // problem, no table marker, == wrong headers
                        headers = [];
                    } else {
                        continue;
                    }
                }
                if (headers.length == 0) {
                    headers = line.toLowerCase().split(delimiter);
                    // remove EMPHASIS
                    for (var j = 0; j < headers.length; j++) {
                        headers[j] = headers[j].trim();
                        headers[j] = $Helper.trimChar(headers[j], "*");
                        headers[j] = $Helper.trimChar(headers[j], "_");
                    }

                    // next line must be the table marker -|-
                    tablemarker = true;
                } else {
                    let token = line.split(delimiter);
                    let obj = {};
                    for (let j = 0; j < headers.length; j++) {
                        if (token.length > j){
                            obj[headers[j]] = token[j].trim();
                        } else {
                            console.log("Token "+String(line)+" missing "+ line);
                            obj[headers[j]] ="missing value";
                        }
                    }
                    result.push(obj);
                }
            }
        }
        return { "headers": headers, "result": result };
    }



    return {
        csv: function (txt, delimiter = ',', linefeed = "\n") {
            return _csv_reader(txt, delimiter, linefeed);
        },

        markdown: function (txt, linefeed = "\n") {
            return _markdown(txt, linefeed);
        }
    };
})();

