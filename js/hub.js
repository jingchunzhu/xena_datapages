'use strict';

var domHelper = require("./dom_helper");
var session = require("./session");
var xenaQuery = require("./xenaQuery");

require("../css/hub.css");

var hosts;
function newHubNode(host) {
	//build checkbox
	var checkbox = session.hostCheckBox(host),
		label = session.getHubName(host),
		tmpNode = domHelper.elt("result2",
				domHelper.hrefLink(label + " (connecting)", "../datapages/?host=" + host));
	tmpNode.setAttribute("id", "statusHub" + host);
	checkbox.appendChild(tmpNode);
	return domHelper.elt("h4", checkbox);
}

function addHost() {
	var node = document.getElementById("textHub"),

	host = node.value;
	host = host.trim();
	//if host is not start with http(s)
	if (host === "") {
		return;
	}

	// get ride of ending '/''
	if (host[host.length - 1] === '/') {
		host = host.slice(0, host.length - 1);
	}
	// specially code for galaxyxena.soe.ucsc.edu
	if (host.match(/galaxyxena.*.ucsc.edu/gi))
	{
		host = "https://galaxyxena.soe.ucsc.edu:443/xena";
	}

	host = xenaQuery.server_url(host);

	if (hosts.indexOf(host) !== -1) {
		node.value = "";
		return;
	}

	node.parentNode.insertBefore(newHubNode(host), node.previousSibling);
	node.parentNode.insertBefore(domHelper.elt("br"), node.previousSibling);
	hosts.push(host);
	node.value = "";
	session.updateHostStatus(host);
}

module.exports = function (main) {
	session.sessionStorageInitialize();
	hosts = JSON.parse(sessionStorage.state).allHosts;
	var node = domHelper.sectionNode("hub"),
		newText, addbutton;

	node.appendChild(domHelper.elt("h2", "Data Hubs"));
	node.appendChild(domHelper.elt("br"));

	//list of hosts
	hosts.forEach(function (host) {
		node.appendChild(newHubNode(host));
		node.appendChild(domHelper.elt("br"));
		session.updateHostStatus(host);
	});

	// Add host text box
	node.appendChild(domHelper.sectionNode("hub"));
	newText = document.createElement("INPUT");
	newText.setAttribute("class", "tb5");
	newText.setAttribute("id", "textHub");
	node.appendChild(newText);

	// Add button
	addbutton = document.createElement("BUTTON");
	addbutton.setAttribute("class", "vizbutton");
	addbutton.appendChild(document.createTextNode("Add"));
	addbutton.addEventListener("click", function() {
		addHost();
	});
	addbutton.style.marginLeft = "20px";
	addbutton.style.height = "27px";
	node.appendChild(addbutton);
	node.appendChild(domHelper.elt("br"));

	main.appendChild(node);
};
