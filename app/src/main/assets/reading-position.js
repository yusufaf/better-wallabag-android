// Reading-position bookmark: captures/restores a "left off here" anchor.
//
// Uses the same XPath+offset serialization as wallabag's own annotator.js
// (openannotation's xpath-range module, vendored in annotator.min.js): XPath
// segments are 1-based same-tag-sibling indices relative to <article>, and an
// offset is a character position into the concatenated text of every descendant
// text node under the anchor's parent element. Reusing that scheme means a
// bookmark synced to the server renders as a real highlight in wallabag's web
// reader, at the right spot. Self-contained -- doesn't touch annotator.min.js,
// so it works whether or not the "annotations enabled" setting is on.

function wbReadingPositionRoot() {
    return document.querySelector('article');
}

function wbXPathFromNode(el, root) {
    var path = '';
    var node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== root) {
        var tagName = node.tagName;
        var siblings = node.parentNode ? node.parentNode.children : [];
        var index = 0, count = 0;
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i].tagName === tagName) {
                count++;
                if (siblings[i] === node) index = count;
            }
        }
        path = '/' + tagName.toLowerCase() + '[' + index + ']' + path;
        node = node.parentNode;
    }
    return path;
}

function wbNodeFromXPath(xpath, root) {
    try {
        var result = document.evaluate('.' + xpath, root, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
    } catch (e) {
        return null;
    }
}

// All descendant text nodes of `el`, in document order -- matches annotator.js's
// Util.getTextNodes (no whitespace/script filtering, so offsets line up exactly
// with what the web reader's own annotator.js will compute).
function wbAllTextNodes(el) {
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

function wbIsBlockCandidate(el) {
    return /^(P|LI|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION)$/.test(el.tagName);
}

// `viewportTop` is the CSS-px Y (in this document's own coordinate space) that the
// *outer* NestedScrollView is currently scrolled to -- the WebView itself never
// scrolls (it's sized to the full article height), so window.scrollY/innerHeight
// are meaningless here and getBoundingClientRect() already returns
// absolute-in-document coordinates. Java computes viewportTop as the inverse of
// scrollWebViewYToPosition().
function wbGetTopVisibleAnchor(viewportTop) {
    var root = wbReadingPositionRoot();
    if (!root) return JSON.stringify(null);
    if (typeof viewportTop !== 'number') viewportTop = 0;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function (el) {
            return wbIsBlockCandidate(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
    });

    var block = null;
    var el;
    while ((el = walker.nextNode())) {
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.bottom > viewportTop) {
            block = el;
            break;
        }
    }
    if (!block) return JSON.stringify(null);

    var tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
            return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });
    var textNode = tw.nextNode();
    if (!textNode) return JSON.stringify(null);

    var origParent = textNode.parentElement;
    var xpath = wbXPathFromNode(origParent, root);
    var textNodes = wbAllTextNodes(origParent);
    var index = textNodes.indexOf(textNode);

    var offset = 0;
    for (var i = 0; i < index; i++) offset += textNodes[i].nodeValue.length;

    var quoteLen = Math.min(120, textNode.nodeValue.length);

    return JSON.stringify({
        start: xpath,
        end: xpath,
        startOffset: offset,
        endOffset: offset + quoteLen,
        quote: textNode.nodeValue.substring(0, quoteLen)
    });
}

function wbScrollToAnchor(range) {
    var root = wbReadingPositionRoot();
    if (!root) return JSON.stringify({y: -1});

    try {
        var anchorNode = wbNodeFromXPath(range.start, root);
        if (!anchorNode) return JSON.stringify({y: -1});

        var textNodes = wbAllTextNodes(anchorNode);
        var length = 0, target = null, targetOffset = 0;
        for (var i = 0; i < textNodes.length; i++) {
            var tn = textNodes[i];
            if (length + tn.nodeValue.length > range.startOffset) {
                target = tn;
                targetOffset = range.startOffset - length;
                break;
            }
            length += tn.nodeValue.length;
        }
        if (!target && textNodes.length > 0) {
            target = textNodes[textNodes.length - 1];
            targetOffset = target.nodeValue.length;
        }
        if (!target) return JSON.stringify({y: -1});

        targetOffset = Math.min(Math.max(targetOffset, 0), target.nodeValue.length);

        var domRange = document.createRange();
        domRange.setStart(target, targetOffset);
        domRange.setEnd(target, targetOffset);

        var rect = domRange.getBoundingClientRect();
        return JSON.stringify({y: rect.top + window.scrollY});
    } catch (e) {
        return JSON.stringify({y: -1});
    }
}
