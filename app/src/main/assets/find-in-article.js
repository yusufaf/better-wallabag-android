// Find-in-article: highlights matches via the CSS Custom Highlight API so the
// DOM (and annotator.js's XPath-based annotation anchors) is never mutated.

var wbFindMatches = [];
var wbFindCurrentIndex = -1;

function wbFindClear() {
    if (window.CSS && CSS.highlights) {
        CSS.highlights.delete('wb-find');
        CSS.highlights.delete('wb-find-current');
    }
    wbFindMatches = [];
    wbFindCurrentIndex = -1;
}

function wbFindCollectTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            var parentTag = node.parentElement ? node.parentElement.tagName : '';
            if (parentTag === 'SCRIPT' || parentTag === 'STYLE') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

function wbFind(query) {
    wbFindClear();

    if (!query) return JSON.stringify({count: 0, currentY: -1});

    var root = document.querySelector('article') || document.body;
    if (!root || !(window.CSS && CSS.highlights)) {
        return JSON.stringify({count: 0, currentY: -1});
    }

    var needle = query.toLowerCase();
    var textNodes = wbFindCollectTextNodes(root);
    var ranges = [];

    for (var i = 0; i < textNodes.length; i++) {
        var node = textNodes[i];
        var text = node.nodeValue.toLowerCase();
        var start = 0;
        var idx;
        while ((idx = text.indexOf(needle, start)) !== -1) {
            var range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + needle.length);
            ranges.push(range);
            start = idx + needle.length;
        }
    }

    wbFindMatches = ranges;

    if (ranges.length > 0) {
        CSS.highlights.set('wb-find', new Highlight(...ranges));
        wbFindCurrentIndex = 0;
        CSS.highlights.set('wb-find-current', new Highlight(ranges[0]));
    }

    var currentY = wbFindCurrentIndex >= 0 ? wbFindRangeY(ranges[wbFindCurrentIndex]) : -1;

    return JSON.stringify({count: ranges.length, currentY: currentY});
}

function wbFindRangeY(range) {
    var rect = range.getBoundingClientRect();
    return rect.top + window.scrollY;
}

function wbFindGoTo(index) {
    if (wbFindMatches.length === 0) return JSON.stringify({y: -1, index: -1});

    var count = wbFindMatches.length;
    wbFindCurrentIndex = ((index % count) + count) % count;

    var range = wbFindMatches[wbFindCurrentIndex];
    CSS.highlights.set('wb-find-current', new Highlight(range));

    return JSON.stringify({y: wbFindRangeY(range), index: wbFindCurrentIndex});
}
