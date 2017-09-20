'use strict';

var _ = require("underscore");
//create a ELEMENT_NODE with a tag, and all following argument as a child to this node
function elt(tag) {
	var node = document.createElement(tag);

	_.each(_.map(_.rest(arguments), function (child) {
		return (typeof child === 'string') ? document.createTextNode(child) : child;
	}), _.bind(node.appendChild, node));
	return node;
}

// create a href ELEMENT_NODE
function hrefLink(text, link) {
	var node = elt("a", text);
	node.setAttribute("href", link);
	return node;
}

//create an ELEMENT_NODE with tag=<section> and id=label
function sectionNode(label) {
	var node = elt("section");
	node.setAttribute("id", label);
	return node;
}

function stripHTML(html) {
	return html.replace(/(<([^>]+)>)/ig, "");
}

function stripScripts(html) {
	var div = document.createElement('div'),
		scripts = div.getElementsByTagName('script'),
		i = scripts.length;
	div.innerHTML = html;
	while (i--) {
		scripts[i].parentNode.removeChild(scripts[i]);
	}
	return div.innerHTML;
}

//parse url queryString to json
function queryStringToJSON() {
	var pairs = location.search.slice(1).split('&'),
		result = {};
	pairs.forEach(function (pair) {
		pair = pair.split('=');
		if (pair[0] && pair[1]) {
			result[pair[0]] = decodeURIComponent(pair[1] || '');
		}
	});

	return result;
}

function JSONToqueryString(obj) {
var qString = Object.keys(obj).map(function(k) {
		return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]);
	}).join('&');
	return qString;
}


function tableCreate(row, column) {
	var tbl  = document.createElement('table'), tr, td, i, j;
	tbl.setAttribute("class", "dataSnippetTable");
	for(i = 0; i < row; i++) {
		tr = tbl.insertRow(i);
		for(j = 0; j < column; j++) {
			td = tr.insertCell(j);
			td.innerHTML = "...";
		}
  }
  return tbl;
}

function setTableCellValue (tbl, row, column, value) {
	tbl.rows[row].cells[column].innerHTML = value;
}

module.exports = {
	elt: elt,
	hrefLink: hrefLink,
	sectionNode: sectionNode,
	stripHTML: stripHTML,
	stripScripts: stripScripts,
	tableCreate: tableCreate,
	setTableCellValue: setTableCellValue,
	queryStringToJSON: queryStringToJSON,
	JSONToqueryString: JSONToqueryString
};
