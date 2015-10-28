/*jslint browser: true,  nomen: true*/
/*global define: false */

define(["dom_helper", "session", "xenaQuery", "../css/datapages.css"],
	function (dom_helper, session, xenaQuery) {
	'use strict';

	function newHubNode(host) {
		//build checkbox
		var checkbox = session.hostCheckBox(host),
			 	tmpNode = dom_helper.elt("result2",
			 		dom_helper.hrefLink(host + " (connecting)", "../datapages/?host=" + host));
		tmpNode.setAttribute("id", "statusHub" + host);
		checkbox.appendChild(tmpNode);
		return dom_helper.elt("h4", checkbox);
	}

	function addHost(hosts) {
		var node = document.getElementById("textHub"),

		host = node.value;
		host = host.trim();
		//if host is not start with http(s)
		if (host === "") {
			return;
		}

		// get ride of ending '/''
		if (host[host.length-1]==='/') {
			host = host.slice(0, host.length-1);
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
		node.parentNode.insertBefore(dom_helper.elt("br"), node.previousSibling);
		hosts.push(host);
		node.value = "";
		session.updateHostStatus(host);
	}

	function XenaDataHubSection(hosts){
		var node = dom_helper.sectionNode("hub"),
			labelText,
			newText, addbutton;

		node.appendChild(dom_helper.elt("h2", "Xena Data Hubs"));
		node.appendChild(dom_helper.elt("br"));

		//list of hosts
		hosts.forEach(function (host) {
			node.appendChild(newHubNode(host));
			node.appendChild(dom_helper.elt("br"));
			session.updateHostStatus(host);
			});

		// Add host text box
		node.appendChild(dom_helper.sectionNode("hub"));
		newText = document.createElement("INPUT");
		newText.setAttribute("class", "tb5");
		newText.setAttribute("id", "textHub");
		node.appendChild(newText);

		// Add button
		addbutton = document.createElement("BUTTON");
		addbutton.setAttribute("class","vizbutton");
		addbutton.appendChild(document.createTextNode("Add"));
		addbutton.addEventListener("click", function() {
	  	addHost(hosts);
		});
		addbutton.style.marginLeft="20px";
		addbutton.style.height ="27px";
		node.appendChild(addbutton);
		node.appendChild(dom_helper.elt("br"));

		return node;
	}

	function GA4GHDataHubSection(){
		var node = dom_helper.sectionNode("hub");
		node.appendChild(dom_helper.elt("h2", "GA4GH Data Hubs"));
		node.appendChild(document.createTextNode("http://ec2-54-148-207-224.us-west-2.compute.amazonaws.com:8000/v0.5.1"));
		return node;
	}

	function start (baseNode){
		session.sessionStorageInitialize();

		var node,
			hosts = JSON.parse(sessionStorage.state).allHosts;

		// xena data hub
		node = new XenaDataHubSection(hosts);
		baseNode.appendChild(node);

		// GA4GH data hub
		//node = new GA4GHDataHubSection();
		//baseNode.appendChild(node);
	}

	return {
		start: start
	};
});

