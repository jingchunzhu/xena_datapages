/*global define: false, confirm: true */
/*global require: false, module: false */

define(["./dom_helper", "./xenaQuery", "./session", "underscore", "rx", "./xenaAdmin",
	'lunr',  "rx-dom", "../css/datapages.css"],
	function (dom_helper, xenaQuery, session,  _,  Rx, xenaAdmin, lunr) {
	'use strict';

	var React = require('react');
	var ReactDOM = require('react-dom');
	var Modal = require('react-bootstrap/lib/Modal');
	var Button = require('react-bootstrap/lib/Button');
	var showdown  = require('showdown');  /* https://github.com/showdownjs/showdown */

	// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
	function checkGenomicDataset(hosts, cohort, goodStatus) {
		return xenaQuery.dataset_list(hosts, cohort).map(function (s) {
			return s.some(function (r) {
				if (r.datasets) {
					return r.datasets.some(function (dataset) {
						var format = dataset.type,
								status = dataset.status;
						return ((goodStatus? (status === goodStatus): true) && (NOT_GENOMICS.indexOf(format) === -1));
					});
				}
				return false;
			});
		});
	}

	// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
	function checkGenomicDatasetAllBad(hosts, cohort, goodStatus) {
		return xenaQuery.dataset_list(hosts, cohort).map(function (s) {
			return s.every(function (r) {
				if (r.datasets && r.datasets.length>0) {
					return r.datasets.some(function (dataset) {
						var format = dataset.type,
								status = dataset.status;
						return ((goodStatus? (status !== goodStatus): false) || (NOT_GENOMICS.indexOf(format) !== -1));
					});
				}
				return true;
			});
		});
	}

	// test if a legit chort exits, (i.e. with real genomic data), carry out action
	function ifCohortExistDo(cohort, hosts, goodStatus, action ) {
		checkGenomicDataset(hosts, cohort, goodStatus).subscribe(function (s) {
			if (s) {
				action.apply(null, arguments);
			}
		});
	}

	// test if a chort illegit, (i.e. no real genomic data), carry out action
	function ifCohortDoesNotExistDo(cohort, hosts, goodStatus, action ) {
		checkGenomicDatasetAllBad(hosts, cohort, goodStatus).subscribe(function (s) {
			if (s) {
				action.apply(null, arguments);
			}
		});
	}

	function deleteDataButton (dataset){
		var name = JSON.parse(dataset.dsID).name,
				host= JSON.parse(dataset.dsID).host;

		if((host ===localHost) && ((dataset.status === session.GOODSTATUS ) || (dataset.status === "error"))) {
			var deletebutton = document.createElement("BUTTON");
			deletebutton.setAttribute("class","vizbutton");
		  deletebutton.appendChild(document.createTextNode("Remove"));
			deletebutton.addEventListener("click", function() {
				var r = confirm("Delete \""+name + "\" from my computer hub.");
				if (r === true) {
					xenaAdmin.delete(localHost, name).subscribe();
				  location.reload(); // reload current page
				}
		  });
		  return deletebutton;
		}
	}

	function cohortHeatmapButton(cohort, hosts, vizbuttonParent) {
		var vizbutton,
			goodStatus = session.GOODSTATUS;

  		ifCohortExistDo(cohort, _.intersection(_.intersection(activeHosts, hosts), userHosts), goodStatus, function(){
			vizbutton = document.createElement("BUTTON");
			vizbutton.setAttribute("class","vizbutton");
			vizbutton.appendChild(document.createTextNode("Visualize"));
			vizbutton.addEventListener("click", function() {
  				session.xenaHeatmapSetCohort(cohort);
  				location.href = "../heatmap/"; //goto heatmap page
			});
			vizbuttonParent.appendChild(vizbutton);
		});
	}

	function configHubButton () {
		var button = document.createElement("BUTTON");
		button.setAttribute("class","vizbutton");
		button.appendChild(document.createTextNode("Configure my data hubs"));
		button.addEventListener("click", function() {
			location.href = "../hub/";
		 });
		return button;
	}

	function warningPopUp (node, loaderWarning){
		node.onclick = function(){
			alert("Load Waring:\n"+JSON.stringify(loaderWarning));
		};
	}

	// the short COHORT section with no detail, just name, vizbutton (if valid), img (optional)
	function eachCohortMultiple(cohortName, hosts, node) {
		var liNode = document.createElement("li"),
			img,
			link = "?cohort=" + encodeURIComponent(cohortName),
			nodeTitle = dom_helper.hrefLink(cohortName, link),
			tmpNode,
			d1,d2,dGap;

		//info image
		tmpNode = document.createElement("a");
		tmpNode.setAttribute("href", link);
		tmpNode.appendChild(buildInfoImage("click for cohort detail ..."));
		liNode.appendChild(tmpNode);

		//treehouse img
		img = buildTreeHouseImage(cohortName);
		if (img){
			liNode.appendChild(img);
		}

		//for single active host but not selected by user senario
		if ((hosts.length===1) &&  (userHosts.indexOf(hosts[0])===-1)){
			nodeTitle.style.color="gray";
		}

		//title
		liNode.appendChild(nodeTitle);

		//viz button
		tmpNode = document.createElement("span");
		liNode.appendChild(tmpNode);
		cohortHeatmapButton(cohortName, _.intersection(activeHosts, userHosts), tmpNode);

		// new status
		tmpNode = document.createElement("span");
		liNode.appendChild(tmpNode);

		xenaQuery.dataset_list(hosts, cohortName).subscribe( function (s) {
			var datasetsList= _.flatten(s.map(function(obj){
				return _.values(_.pick(obj,'datasets'));
			}));
		});

		node.appendChild(liNode);

		//remove extra
		if (cohortName===COHORT_NULL){
			ifCohortDoesNotExistDo(cohortName, hosts, session.GOODSTATUS, function (){
				node.removeChild(liNode);
			});
		}
	}

	function buildTreeHouseImage (cohortName){
		var img;
		if (cohortName.search(/^Treehouse/gi) !== -1){
			img = new Image();
			img.src = treehouseImg;
			img.height = "40";
		}
		return img;
	}

	function buildInfoImage (tipMessage) {
		var node = document.createElement("span"),
			img = new Image();

		img.src = infoImgSource;
		img.height = "20";
		node.appendChild(img);

		adhocTooltip (node, img, tipMessage);

		return node;
	}

	function adhocTooltip (outsideDiv, tooltipDOM, tipMessage ){
		var fadeSpeed = 25; // a value between 1 and 1000 where 1000 will take 10
		                    // seconds to fade in and out and 1 will take 0.01 sec.

		var showTip = function(){
			var tip = document.createElement("span");
	    tip.className = "tooltip";
	    tip.id = "tip";
	    tip.innerHTML = tipMessage;
		  outsideDiv.appendChild(tip);
	    tip.style.opacity="0"; // to start with...
	    var intId = setInterval(function(){
	        var newOpacity = parseFloat(tip.style.opacity)+0.1;
	        tip.style.opacity = newOpacity.toString();
	        if(tip.style.opacity === "1"){
	            clearInterval(intId);
	        }
	    }, fadeSpeed);
		};
		var hideTip = function(){
		    var tip = document.getElementById("tip");
		    var intId = setInterval(function(){
		        var newOpacity = parseFloat(tip.style.opacity)-0.1;
		        tip.style.opacity = newOpacity.toString();
		        if(tip.style.opacity === "0"){
		            clearInterval(intId);
		            tip.remove();
		        }
		    }, fadeSpeed);
		    tip.remove();
		};

		tooltipDOM.addEventListener("mouseover", showTip, false);
		tooltipDOM.addEventListener("mouseout", hideTip, false);
	}

	function cohortListPage(hosts, rootNode) {
		if (!hosts || hosts.length <= 0) {
			return;
		}

		var node = document.createElement("div");
		node.setAttribute("id","cohortList");

		var source = Rx.Observable.zipArray(
			hosts.map(function (host) {
				return xenaQuery.all_cohorts(host);
			})
		);

		source.subscribe(function (x) {
			var cohortC = [];

			_.flatten(x).forEach(function(cohort){
				if (cohortC.indexOf(cohort) === -1) {
						cohortC.push(cohort);
					}
				});

			rootNode.appendChild(dom_helper.elt("h2", cohortC.filter(cohortName => cohortName!==COHORT_NULL).length+" Cohorts"));
			rootNode.appendChild(node);

			cohortC.sort(function (a,b){
				if (a===COHORT_NULL){
					return 1;
				}
				else if (b===COHORT_NULL){
					return -1;
				}
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});

			cohortC.map(function(cohort){
				eachCohortMultiple(cohort, hosts, node);
			});
		});

		rootNode.appendChild(document.createElement("br"));
	}

	//	build single COHORT page
	function cohortPage(cohortName, hosts, rootNode) {
		//cohort section
		var tmpNode,img,
	    node = dom_helper.sectionNode("cohort"),
	    vizbuttonParent;

		rootNode.appendChild(node);

		//title
		vizbuttonParent = dom_helper.elt("h2", "cohort: ");
		node.appendChild(vizbuttonParent);

		img = buildTreeHouseImage(cohortName);
			if (img){
				vizbuttonParent.appendChild(img);
		}
		vizbuttonParent.appendChild(document.createTextNode(cohortName));
		cohortHeatmapButton(cohortName, _.intersection(activeHosts, userHosts), vizbuttonParent);
		//node.appendChild(document.createElement("br"));

		ifCohortExistDo (cohortName, hosts, undefined, function() {
			//dataset list
			xenaQuery.dataset_list(hosts, cohortName).subscribe(
				function (s) {
					//collection information
					var dataType = {},
						dataLabel = {},
						dataDescription = {},
						dataHost = {},
						dataHostShortLabel ={},
						dataName = {},
						dataStatus ={},
						dataVersion ={},
						dataWarning={},
						dataCollection={};

					s.forEach(function (r) {
						var host = r.server,
							datasets = r.datasets;
						datasets.forEach(function (dataset) {
							var type = dataset.dataSubType,
								format = dataset.type,
								label = dataset.label? dataset.label: dataset.name,
								description = dataset.description,
								name = dataset.name,
								status = dataset.status,
								loaderWarning = dataset.loader,
								fullname = host + name,
								version = dataset.version;

							if (NOT_GENOMICS.indexOf(format) === -1) {
								if (!label) {
									label = name;
								}
								if (!(dataType[type])) {
									dataType[type] = [];
								}
								dataType[type].push(fullname);
								dataLabel[fullname] = label;
								dataDescription[fullname] = description;
								dataHost[fullname] = host;
								dataHostShortLabel[fullname]= session.getHubName(host);
								dataName[fullname] = name;
								dataStatus[fullname] = status;
								dataVersion[fullname] = version;
								dataWarning[fullname] = loaderWarning;
								dataCollection[fullname]= dataset;
							}
						});
					});

					// dataType section
					var nodeDataType = dom_helper.sectionNode("dataType");

					var dataTypes = _.keys(dataType).sort(),
						displayType,
						listNode;

					dataTypes.map(function (type) {
						if (type === "filter" || type ==="Filter"){
							return;
						}
						displayType = type;
						if (type === "undefined") {
							displayType = "others";
						}
						nodeDataType.appendChild(dom_helper.elt("header", displayType));
						listNode = dom_helper.elt("div");

						dataType[type].map(function(fullname){
							return [ dataLabel[fullname],fullname];
						}).sort().forEach(function (item){
							// name
							var fullname = item[1],
								link = "?dataset=" + dataName[fullname] + "&host=" + dataHost[fullname],
								datasetNode = document.createElement("ul");

							//info image
							tmpNode = document.createElement("a");
							tmpNode.setAttribute("href", link);
							tmpNode.appendChild(buildInfoImage("click for dateset detail ..."));
							datasetNode.appendChild(tmpNode);

							//dataset name and link
							datasetNode.appendChild(dom_helper.hrefLink(dataLabel[fullname], link));

							//status
							if (dataStatus[fullname] === session.GOODSTATUS ) { // good data, with or without warning
								datasetNode.appendChild(dom_helper.valueNode(fullname + "sampleN"));
								xenaQuery.dataset_samples(dataHost[fullname], dataName[fullname]).subscribe(function (s) {
									document.getElementById(fullname + "sampleN").
									appendChild(dom_helper.elt("label", document.createTextNode(" (n=" + s.length.toLocaleString() + ")")));
								});
							} else if (dataStatus[fullname] === "error") {  // show error status
								tmpNode = dom_helper.elt("span"," ["+dataStatus[fullname]+"] ");
								tmpNode.style.color="red";
								datasetNode.appendChild(tmpNode);
							} else {
								datasetNode.appendChild(document.createTextNode(" ["+dataStatus[fullname]+"] "));
							}

							// host
							tmpNode = dom_helper.hrefLink(dataHostShortLabel[fullname], "?host=" + dataHost[fullname]);
							tmpNode.setAttribute("id", "status" + dataHost[fullname]);
							datasetNode.appendChild(tmpNode);
							session.updateHostStatus(dataHost[fullname]);

							// delete and reload button
							var deletebutton = deleteDataButton (dataCollection[fullname]);
							if(deletebutton) {
								datasetNode.appendChild(deletebutton);
							}

							//dataset description
							if (dataDescription[fullname]) {
								var descriptionNode = dom_helper.elt("div");
								descriptionNode.setAttribute("class", "line-clamp");
								descriptionNode.appendChild(dom_helper.elt("summary", dom_helper.stripHTML(dataDescription[fullname])));

								datasetNode.appendChild(descriptionNode);
							}
							listNode.appendChild(datasetNode);
						});
						nodeDataType.appendChild(listNode);
					});

					rootNode.appendChild(nodeDataType);
			});
		});
	}

	// build single DATASET page
	function datasetPage(dataset, host, baseNode) {
		// collection
		var name = dataset.name,
				label = dataset.label || name,
				description = dataset.description,
				longTitle = dataset.longTitle,
				cohort = dataset.cohort || COHORT_NULL,
				dataType = dataset.dataSubType,
				platform = dataset.platform,
				unit = dataset.unit,
				assembly = dataset.assembly,
				version = dataset.version,
				url = dataset.url,
				articletitle = dataset.articletitle,
				citation = dataset.citation,
				pmid = dataset.pmid,
				author = dataset.author || dataset.dataproducer,
				wrangling_procedure = dataset.wrangling_procedure,
				type = dataset.type || TYPE_NULL,
				urls,
				link, metalink,
				status = dataset.status,
				loaderWarning = dataset.loader,
				probeMap = dataset.probeMap,
				goodStatus = session.GOODSTATUS,
				nodeTitle, vizbuttonParent, hostNode, tmpNode;


		if (description) {
			description = dom_helper.stripScripts(description);
		}

		if (wrangling_procedure) {
			wrangling_procedure = dom_helper.stripScripts(wrangling_procedure);
		}

		if (url) {
			urls = _.uniq(url.split(","));
		}

		// layout
		var sectionNode = dom_helper.sectionNode("dataset");

		// dataset title
		sectionNode.appendChild(dom_helper.elt("h2", "dataset: "+label));
		sectionNode.appendChild(dom_helper.elt("br"));

		// long title
		if (longTitle) {
			sectionNode.appendChild(document.createTextNode(longTitle));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		//description
		if (description) {
			sectionNode.appendChild(dom_helper.elt("br"));

			tmpNode = dom_helper.elt("result2");
			tmpNode.innerHTML = description;

			sectionNode.appendChild(tmpNode);
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// cohort:xxx
		sectionNode.appendChild(dom_helper.elt("labelsameLength","cohort"));
		nodeTitle = dom_helper.hrefLink(cohort, "?cohort=" + encodeURIComponent(cohort));
		vizbuttonParent = dom_helper.elt("multiple", nodeTitle);
		sectionNode.appendChild(dom_helper.elt("resultsameLength", vizbuttonParent));

		// viz button
		if (status === goodStatus){
			cohortHeatmapButton(cohort,
				_.intersection( _.intersection(activeHosts, userHosts), [host]),
				vizbuttonParent);
		}
		sectionNode.appendChild(dom_helper.elt("br"));

		// ID
		sectionNode.appendChild(dom_helper.elt("labelsameLength","dataset ID"));
		sectionNode.appendChild(dom_helper.elt("resultsameLength", name));
		sectionNode.appendChild(dom_helper.elt("br"));


		// status and loader warning
		if (status===goodStatus && !loaderWarning){ // perfect data
		} else if (status===goodStatus && loaderWarning){ // loaded with warning
			tmpNode = dom_helper.hrefLink(status+" with warning","#");
			warningPopUp (tmpNode, loaderWarning);
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		} else if (status === "error") { // error
			tmpNode = dom_helper.elt("span",status);
			tmpNode.style.color="red";
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		else {
			tmpNode = dom_helper.elt("span", status);
			tmpNode.style.color="blue";
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// Downlaod
		sectionNode.appendChild(dom_helper.elt("labelsameLength","download"));
		link = downloadLink (dataset);
		metalink = metaDataLink (dataset);

		sectionNode.appendChild(dom_helper.elt("resultsameLength",
			dom_helper.hrefLink(link, link),
			document.createTextNode("; "),
			dom_helper.hrefLink("Full metadata", metalink)));

		sectionNode.appendChild(dom_helper.elt("br"));

		// samples: n
		sectionNode.appendChild(dom_helper.elt("labelsameLength", "samples"));
		sectionNode.appendChild(dom_helper.valueNode(dataset+"SampleN"));
		updataDOM_xenaDataSet_sampleN(dataset + "SampleN", host, name);
		sectionNode.appendChild(dom_helper.elt("br"));

		// update on: xxx
		if (version) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","version"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", version));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// host: host
		sectionNode.appendChild(dom_helper.elt("labelsameLength","hub"));
		hostNode = dom_helper.elt("resultsameLength",
			dom_helper.hrefLink(session.getHubName(host), "?host=" + host));
		hostNode.setAttribute("id", "status" + host);
		sectionNode.appendChild(hostNode);
		session.updateHostStatus(host);
		sectionNode.appendChild(dom_helper.elt("br"));

		// type of data
		if (dataType) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","type of data"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", dataType));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// assembly
		if (assembly) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","assembly"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", assembly));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//unit
		if (unit) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","unit"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", unit));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//platform
		if (platform) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","platform"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", platform));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//probeMap
		if (probeMap) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","ID/Gene mapping"));
			if (host === "https://genome-cancer.ucsc.edu:443/proj/public/xena") {
				link = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//,"");
				metalink = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//,"")+".json";
			}
			else {
				link = host+"/download/"+probeMap;
				metalink = host+"/download/"+probeMap+".json";
			}

			sectionNode.appendChild(dom_helper.elt("resultsameLength",
				dom_helper.hrefLink(probeMap, link),
				document.createTextNode(";  "),
				dom_helper.hrefLink("Metadata", metalink)));

			sectionNode.appendChild(dom_helper.elt("br"));
		}

		if (articletitle) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "publication"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", articletitle));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (citation) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "citation"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", citation));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (author) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "author"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", author));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (pmid) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "PMID"));
			sectionNode.appendChild(
				dom_helper.elt("resultsameLength", dom_helper.hrefLink(
					pmid.toString(), "http://www.ncbi.nlm.nih.gov/pubmed/?term=" + pmid.toString())));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (urls) {
			urls.forEach(function (url) {
				sectionNode.appendChild(dom_helper.elt("labelsameLength", "raw data"));
				sectionNode.appendChild(dom_helper.elt("resultsameLength", dom_helper.hrefLink(url, url)));
				sectionNode.appendChild(dom_helper.elt("br"));
			});
		}

		if (wrangling_procedure) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "wrangling"));

			tmpNode = dom_helper.elt("resultsameLength");
			tmpNode.innerHTML = wrangling_procedure;

			sectionNode.appendChild(tmpNode);
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// input file format
		sectionNode.appendChild(dom_helper.elt("labelsameLength","input data format"));
		sectionNode.appendChild(dom_helper.elt("resultsameLength",FORMAT_MAPPING[type]));
		sectionNode.appendChild(dom_helper.elt("br"));
		baseNode.appendChild(sectionNode);

		if (status !== goodStatus){
			baseNode.appendChild(sectionNode);
			return;
		}

		sectionNode.appendChild(dom_helper.elt("br"));
		// dimentions
		var oldNode = dom_helper.elt("span"),
			spaceHolderNode = dom_helper.elt("span"),
			node =  dom_helper.elt("span"),
			node2 = dom_helper.elt("span");

		sectionNode.appendChild(oldNode);
		sectionNode.appendChild(dom_helper.elt("br"));

		if (type === "genomicMatrix") {
			//identifiers count
			spaceHolderNode.appendChild(node2);
			spaceHolderNode.appendChild(document.createTextNode(" x "));
			// samples: n
			spaceHolderNode.appendChild(node);
			spaceHolderNode.appendChild(dom_helper.elt("span"," "));
		} else if (type === "clinicalMatrix") {
			// samples: n
			spaceHolderNode.appendChild(node);
			spaceHolderNode.appendChild(document.createTextNode(" x "));
			//identifiers count
			spaceHolderNode.appendChild(node2);
			spaceHolderNode.appendChild(dom_helper.elt("span"," "));
		} else if (type === "mutationVector") {
			node = undefined;
			node2= undefined;
		}

		xenaQuery.dataset_samples(host, name).subscribe(function (s) {
			if (node){
				node.innerHTML= s.length.toLocaleString()+" samples ";
			}
			xenaQuery.dataset_field(host, name).subscribe(function(probes){
				if (node2) {
					node2.innerHTML = probes.length.toLocaleString() +" identifiers ";
				}
				sectionNode.replaceChild(spaceHolderNode, oldNode);

				tmpNode =dom_helper.elt("a","Show More Data");
				tmpNode.setAttribute("class","textLink");
				addMoreDataLink(dataset,probes.length,tmpNode);
				spaceHolderNode.appendChild(tmpNode);

				tmpNode =dom_helper.elt("a","All Identifiers");
				tmpNode.setAttribute("class","textLink");
				addAllIdLink(dataset, tmpNode);
				spaceHolderNode.appendChild(tmpNode);

				tmpNode =dom_helper.elt("a","All Samples");
				tmpNode.setAttribute("class","textLink");
				addAllSampleLink(dataset, tmpNode);
				spaceHolderNode.appendChild(tmpNode);
			});
		});

		tmpNode = dom_helper.tableCreate(11,11);
		sectionNode.appendChild(tmpNode);
		sectionNode.appendChild(dom_helper.elt("br"));

		dataSnippets(dataset, 10, 10, tmpNode);

		baseNode.appendChild(sectionNode);
	}

	function allIdentifiersPage (host, dataset, label){
		var textNode, text,
			rootNode = dom_helper.sectionNode("bigDataSnippet");

		document.body.appendChild(rootNode);
		rootNode.appendChild(dom_helper.elt("h3","dataset: "+label, backtoDatasetButton(host, dataset)));
		textNode = document.createElement("pre");
		rootNode.appendChild(textNode);

		text="Identifiers\n";
		xenaQuery.dataset_field(host, dataset).subscribe(function(probes){
			probes.forEach(function(probe){
				text = text +probe.name+"\n";
			});
			textNode.innerHTML=text;
		});
	}

	function allSamplesPage (host, dataset, label){
		var textNode, text,
			rootNode = dom_helper.sectionNode("bigDataSnippet");

		document.body.appendChild(rootNode);
		rootNode.appendChild(dom_helper.elt("h3","dataset: "+label, backtoDatasetButton(host, dataset)));
		textNode = document.createElement("pre");
		rootNode.appendChild(textNode);

		text="Samples\n";
		xenaQuery.dataset_samples(host, dataset).subscribe(function(samples){
			samples.forEach(function(sample){
				text = text + sample+"\n";
			});
			textNode.innerHTML=text;
		});
	}

	function addAllIdLink (dataset, linkNode){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host,
			label = dataset.label?dataset.label: name,
			link, qString,
			qStringObj = {
				"host": host,
				"dataset": name,
				"label": label,
				"allIdentifiers": true
			};

		qString= dom_helper.JSONToqueryString(qStringObj);
		link = "../datapages/?"+qString;
		linkNode.setAttribute("href", link);
	}

	function addAllSampleLink (dataset, linkNode){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host,
			label = dataset.label?dataset.label: name,
			link, qString,
			qStringObj = {
				"host": host,
				"dataset": name,
				"label": label,
				"allSamples": true
			};

		qString= dom_helper.JSONToqueryString(qStringObj);
		link = "../datapages/?"+qString;
		linkNode.setAttribute("href", link);
	}

	function addMoreDataLink (dataset, probesLength, linkNode){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host,
			format = dataset.type,
			qString,
			qStringObj = {
				"host": host,
				"dataset": name,
				"nSamples": 10,
				"nProbes": probesLength
			},
			link;

		if (format==="mutationVector" ){
			qStringObj.nProbes = 1000;
		}
		if (format==="genomicMatrix" ){
			qStringObj.nProbes = 1000;
		}
		if (format === "clinicalMatrix") {
			qStringObj.nSamples= 500;
		}
		qString= dom_helper.JSONToqueryString(qStringObj);
		link = "../datapages/?"+qString;
		linkNode.setAttribute("href", link);
	}

	// almost dup of fn in plotMutationVector.js. Should factor this out.
	function mutation_attrs(list) {
		return _.map(list, function (row) {
			return {
				"sampleid": row.sampleID,
				"chrom": row.position.chrom,
				"chromstart": row.position.chromstart,
				"chromend": row.position.chromend,
				"gene": row.genes,
				"ref": row.ref,
				"alt": row.alt,
				"effect": row.effect,
				"amino_acid": row['amino-acid'],
				"rna_vaf": row['rna-vaf'],
				"dna_vaf": row['dna-vaf']
			};
		});
	}

	// dup of fn in plotMutationVector.js. Should factor this out.
	function collateRows(rows) {
		var keys = _.keys(rows);
		return _.map(_.range(rows[keys[0]].length), i => _.object(keys, _.map(keys, k => rows[k][i])));
	}

	function dataSnippets (dataset, nSamples, nProbes, node){
		var table,
			host = JSON.parse(dataset.dsID).host,
			name = dataset.name,
			type = dataset.type,
			allSamples, allProbes;

		if (!type ) {  // when type is not specified, xena loader treat the file as genomicMatrix
			type = "genomicMatrix";
		}

		if ((type === "genomicMatrix")  || (type ==="clinicalMatrix")) {
			//data snippet samples, probes
			xenaQuery.dataset_samples(host, name).subscribe(
				function (samples) {
					allSamples = samples.length;
					samples= samples.slice(0, nSamples);

					var query = xenaQuery.dataset_field(host, name);

					query.subscribe(function (s) {
						allProbes = s.map(function (probe) {
							return probe.name;
						});
						var probes = allProbes.slice(0, nProbes);
						allProbes = allProbes.length;

						xenaQuery.code_list(host, name, probes).subscribe(function(codemap){
							//return probes by all_samples
							var row, column,
									dataRow, dataCol,
									i,j,text,
									firstRow, firstCol;

							xenaQuery.dataset_probe_values(host, name, samples, probes).subscribe( function (s) {
								if (type==="genomicMatrix"){
									firstCol = probes;
									firstRow = samples;
								} else {
									firstCol = samples;
									firstRow = probes;
								}

								column = firstRow.length;
								row = firstCol.length;

								table = dom_helper.tableCreate(row+1, column+1);

								node.parentNode.replaceChild(table,node);

								if (type==="genomicMatrix"){
									dataCol = (column>=allSamples) ? column: nSamples-1;    //sample
									dataRow = (row >=allProbes)? row: nProbes-1; //probe
								} else if (type==="clinicalMatrix"){
									dataCol = (column >=allProbes)? column:nProbes-1; //probe
									dataRow = (row>=allSamples) ? row: nSamples-1; //sample
								}

								//first row -- labels
								text ="\t";
								for (j=1; j< dataCol+1; j++){
									dom_helper.setTableCellValue (table, 0, j, firstRow[j-1]);
								}

								//first col
								for (i=1; i< dataRow+1; i++){
									dom_helper.setTableCellValue (table, i, 0, firstCol[i-1]);
								}

								//data cell
								for(i = 1; i < s.length+1; i++){
									var probe = probes[i-1],
										value, code;

									text = firstCol[i-1];
									for (j=1; j< samples.length+1; j++){
										if (type==="genomicMatrix"){
											value = s[i-1][j-1];
										} else {
											value = s[i-1][j-1];
										}
										code = undefined;
										if (codemap[probe]) {
											if(!isNaN(value)){
												code = codemap[probe][value];
											}
										}

										if ((type==="genomicMatrix") && (i<dataRow+1) && (j<dataCol+1)) {
											dom_helper.setTableCellValue (table, i, j, code? code:value);
										} else if ((type==="clinicalMatrix") && (j<dataRow+1) && (i<dataCol+1)) {
											dom_helper.setTableCellValue (table, j, i, code? code:value);
										}
									}
								}
								dom_helper.setTableCellValue (table, 0, 0, " ");
							});
						});
					});
				});
			}
		else if(type ==="mutationVector"){
			xenaQuery.sparse_data_examples(host, name, nProbes).map(r => mutation_attrs(collateRows(r.rows))).subscribe(function(rows){
				if (rows && rows.length>0) {
					var i, j, key,
						keys = Object.keys(rows[0]),
						column = keys.length,
						row = rows.length,
						dataRow = (row<nProbes) ? row:nProbes-2,  //number of lines of data
						tableRow = (row<nProbes) ? row:nProbes-1;  //table row number excluding header

					// put chrom chromstart chromend together to be more readable
					keys.sort();
					var start = keys.indexOf("chromstart"),
						end = keys.indexOf("chromend"),
						keysP={};
					keys[start]="chromend";
					keys[end]="chromstart";

					table = dom_helper.tableCreate(tableRow+1, column+1);
					node.parentNode.replaceChild(table,node);

					//first row -- labels
					for (j=1; j<keys.length+1; j++){
						dom_helper.setTableCellValue (table, 0, j, keys[j-1]);
						keysP[keys[j-1]]=j;
					}

					//data cell
					for(i = 1; i < dataRow+1; i++){
						for (key in rows[i-1]) {
							if (rows[i - 1].hasOwnProperty(key)) {
								j = keysP[key];
								dom_helper.setTableCellValue (table, i, j, rows[i-1][key]);
								//first column
								if (key ==="sampleid"){
									dom_helper.setTableCellValue (table, i, 0, rows[i-1][key]);
								}
							}
						}
					}
					dom_helper.setTableCellValue (table, 0, 0, " ");
				}
			});
		}
	}

	// build single SAMPLE page
	function samplePage(baseNode, sample, cohort) {
		// layout
		var sectionNode = dom_helper.sectionNode("dataset");

		// sample title
		sectionNode.appendChild(dom_helper.elt("h2", "sample: "+sample));
		sectionNode.appendChild(document.createElement("br"));
		sectionNode.appendChild(dom_helper.elt("label", "cohort:"));
		sectionNode.appendChild(dom_helper.elt("result", dom_helper.hrefLink(cohort, "?&cohort=" + cohort)));

		baseNode.appendChild(sectionNode);
	}

	// sidebar active hub list with checkboxes
	function hubSideBar(hosts) {
		var sideNode = dom_helper.elt("div");
		sideNode.setAttribute("id", "sidebar");

		var checkNode = dom_helper.sectionNode("sidehub");

		checkNode.appendChild(dom_helper.elt("h3", dom_helper.hrefLink("Active Data Hubs", "../hub/")));
		checkNode.appendChild(dom_helper.elt("h3"));

		hosts.forEach(function (host) {
			session.updateHostStatus(host);
			var checkbox = session.metaDataFilterCheckBox(host),
				tmpNode = dom_helper.elt("result2",
					dom_helper.hrefLink(session.getHubName(host) + " (connecting)", "../datapages/?host=" + host));

			tmpNode.setAttribute("id", "sidebar" + host);
			checkbox.setAttribute("id", "sidebarCheck" + host);
			checkNode.appendChild(dom_helper.elt("h4", checkbox, " ", tmpNode));
			checkNode.appendChild(dom_helper.elt("h4"));
		});
		sideNode.appendChild(checkNode);

		//apply button
		var applybutton = document.createElement("BUTTON");
			applybutton.setAttribute("class","vizbutton");
			applybutton.appendChild(document.createTextNode("Apply"));
			applybutton.addEventListener("click", function() {
  			location.reload();
			});
		sideNode.appendChild(applybutton);

		return sideNode;
	}

	// sidebar datasets action
	function datasetSideBar(dataset, sideNode) {
		//visualize button
		var tmpNode = document.createElement("div");
		sideNode.appendChild(tmpNode);
		if (dataset.status === session.GOODSTATUS){
			cohortHeatmapButton(dataset.cohort,
				_.intersection( _.intersection(activeHosts, userHosts), [JSON.parse(dataset.dsID).host]),
				tmpNode);
		}

		//download button
		var button = downloadDataButton (dataset);
		if (button) {
			sideNode.appendChild(button);
			sideNode.appendChild(document.createElement("br"));
		}

		//download selected samples' data
		/*
		var mountPoint = document.createElement("div");
		if (downloadSelecedSampleButton (dataset, mountPoint)){
		  sideNode.appendChild(mountPoint);
		  sideNode.appendChild(document.createElement("br"));
		}
		*/

		// delete button
		button = deleteDataButton (dataset);
		if (button) {
			sideNode.appendChild(button);
			sideNode.appendChild(document.createElement("br"));
		}
	}


	function downloadLink(dataset){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host;

		return host+"/download/"+name;
	}

	function metaDataLink(dataset){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host;

		return host+"/download/"+name+".json";
	}

	function backtoDatasetButton (host, dataset){
		var button = document.createElement("BUTTON");
		button.setAttribute("class","vizbutton");
		button.appendChild(document.createTextNode("Back to dataset"));
		button.addEventListener("click", function() {
			location.href = "?dataset="+encodeURIComponent(dataset)+"&host="+encodeURIComponent(host);
		 });
		return button;
	}

	function downloadDataButton (dataset){
		if(dataset.status === session.GOODSTATUS) {
			var button = document.createElement("BUTTON");
			button.setAttribute("class","vizbutton");
			button.appendChild(document.createTextNode("Download"));
			button.addEventListener("click", function() {
				location.href = downloadLink(dataset);
		  });
		  return button;
		}
	}

	function downloadSelecedSampleButton (dataset, mountPoint){
		if(dataset.status !== session.GOODSTATUS) {
      return false;
    }

    const Example = React.createClass({

      getInitialState() {
        return { showModal: false };
      },

      close() {
        this.setState({ showModal: false });
      },

      open() {
        this.setState({ showModal: true });
      },

      render() {
        return (
          <div>
            <Button type= "submit" className="vizbutton" onClick={this.open}>
              Download subset
            </Button>

            <Modal show={this.state.showModal} onHide={this.close}>
              <Modal.Header closeButton>
                <Modal.Title>Download data from a subset of samples</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>Enter a list of samples separated by comma</p>
              </Modal.Body>
              <Modal.Footer>
                <Button type = "submit" bsStyle="primary">Submit</Button>
                <Button onClick={this.close}>Close</Button>
              </Modal.Footer>
            </Modal>
          </div>
        );
      }
    });

    ReactDOM.render(< Example />, mountPoint);
    return true;
  }

	function bigDataSnippetPage (host, dataset, nSamples, nProbes){
		var blockNode = dom_helper.elt("span", "If you are reading this, you need release browser SHIELD to see the data requested"),
			rootNode = dom_helper.sectionNode("bigDataSnippet"),
			node = document.createElement("div");

		document.title= dataset;
		document.body.appendChild(rootNode);
		rootNode.appendChild(node);
		node.appendChild( dom_helper.elt("h3","dataset: "+dataset, backtoDatasetButton(host, dataset)));
		node.appendChild( blockNode );
		blockNode.style.color="red";

		xenaQuery.dataset_by_name(host, dataset).subscribe(
			function (datasets) {
				var label = datasets[0].label? datasets[0].label : datasets[0].name;

				document.title=label;
				blockNode.parentNode.replaceChild(dom_helper.elt("div","Querying xena on "+ host+" ... "),blockNode);
				dataSnippets(datasets[0], nSamples, nProbes, node);
			}
		);
	}

	function xenaTextValuesToString (dataset){
		delete dataset.loader;
		return JSON.stringify(dataset);
	}

	function buildIndex (idxObj, hosts){
  		var idx = lunr(function () {
				this.field('cohort');
				this.field('body');
  			}),
		  	store ={},
		  	i =0,
		  	doc,
		  	source;

	    source = Rx.Observable.zipArray(
	      hosts.map(function (host) {
	        return xenaQuery.all_datasets(host);
	      })
	    );

		source.subscribe(function (hostReturn) {
			hostReturn.forEach(function(s,i){
				s.forEach(function (dataset) {
					addToIndex(hosts[i],dataset);
				});
			});
			idxObj.index = idx;
			idxObj.store = store;
		});

		function addToIndex(host,dataset){
			var body = xenaTextValuesToString(dataset),
				type = dataset.type,
				status = dataset.status;

			if (NOT_GENOMICS.indexOf(type)===1){
				return;
			}
			if (status!==session.GOODSTATUS){
				return;
			}

			i=i+1;
			doc = {
				"cohort": dataset.cohort,
				"body": body,
				"id": i
			};
			idx.add(doc);
			store[i]={
				"name":dataset.name,
				"label":dataset.label,
				"cohort":dataset.cohort,
				"host":host
			};
		};
	}

	//the front page of dataPages
	function frontPage (baseNode){
		var indxObj={},
			inputBox = document.createElement("INPUT"),
		  	searchButton = document.createElement("BUTTON"),
		  	resetButton = document.createElement("BUTTON");

		function searchUI(sectionNode){
			var query;

			inputBox.setAttribute("class", "searchBox");
			inputBox.setAttribute("id", "dataPageQuery");
			sectionNode.appendChild(inputBox);

			searchButton.setAttribute("class","vizbutton");
			searchButton.appendChild(document.createTextNode("Search Cohorts"));
			sectionNode.appendChild(searchButton);

			searchButton.addEventListener("click", function () {
				query = document.getElementById("dataPageQuery").value.trim();
				doSearch (query);
			});

			resetButton.setAttribute("class","vizbutton");
			resetButton.appendChild(document.createTextNode("Reset"));
			sectionNode.appendChild(resetButton);

			resetButton.addEventListener("click", function () {
				document.getElementById("dataPageQuery").value ="";
				cohortNode.innerHTML="";
				cohortListPage(_.intersection(activeHosts, metadataFilterHosts), cohortNode);
			});
		}

		function doSearch(query) {
			var type, name, cohort, url,
				cohortList=[], datasetList=[],
				idx, store,
				tiimer;

			function displaySearchResult(){
				var tmpDatasetNode, tmpSampleNode,
					results,
					array;

				results= idx.search(query);
				results.map(function (obj){
		  			name = store[obj.ref].name;
		  			cohort = store[obj.ref].cohort;
		  			datasetList.push(store[obj.ref]);
		  			if (cohortList.indexOf(cohort)===-1){
		  				cohortList.push(cohort);
		  			}
				});

		  	cohortNode.innerHTML="";

		  	if (cohortList.length===0){
		  		cohortNode.appendChild(document.createTextNode("Your search - "));
		  		cohortNode.appendChild(dom_helper.elt("I",query));
		  		cohortNode.appendChild(document.createTextNode(" - did not find any data."));
		  	}
		  	else {
		  		var text = "Found approx ",
		  			message,
		  			clearnArray;

		  		array = [(cohortList.length ? (cohortList.length.toLocaleString()  +" cohort"+  (cohortList.length>1? "s":"")) : ""),
		  			(datasetList.length ? (datasetList.length.toLocaleString()+" dataset"+ (datasetList.length>1? "s":"")) : "")];

		  		clearnArray= array.filter(function (phrase) {
		  				return (phrase !== "");
		  			});

		  		var arrayText = clearnArray.slice(0, clearnArray.length-1).join(', ');
		  		arrayText = (arrayText ? (arrayText +" and "):"")+ clearnArray[clearnArray.length-1];
		  		text = text + arrayText;
					message = dom_helper.elt("span",text);
					message.style.color = "gray";
		  		cohortNode.appendChild(message);
	  		}
		  	if (cohortList.length>0){
					cohortNode.appendChild(dom_helper.elt("h2", array[0]));
					cohortList.forEach(function(cohort){
						url = "?cohort="+encodeURIComponent(cohort);
		  			cohortNode.appendChild(dom_helper.hrefLink(cohort, url));
		  			cohortNode.appendChild(document.createElement("br"));
					});
			  }
			  if (datasetList.length>0){
			  	cohortNode.appendChild(dom_helper.elt("h2",array[1]));
			  	datasetList.forEach(function(obj){
			  		url = "?dataset="+encodeURIComponent(obj.name)+"&host="+encodeURIComponent(obj.host);
			  		cohortNode.appendChild(document.createTextNode(obj.cohort+" : "));
			  		cohortNode.appendChild(dom_helper.hrefLink(obj.label, url));
			  		cohortNode.appendChild(document.createElement("br"));
		  		});
			  }

			  cohortNode.appendChild(document.createElement("br"));
			 	inputBox.disabled = false;
				searchButton.disabled = false;
				resetButton.disabled = false;
			}

			inputBox.disabled = true;
			searchButton.disabled = true;
			resetButton.disabled = true;

			cohortNode.innerHTML=""; //clear cohortList
			if (query === "") {  // all cohorts
				cohortListPage(_.intersection(activeHosts, metadataFilterHosts), cohortNode);
				inputBox.disabled = false;
				searchButton.disabled = false;
				resetButton.disabled = false;
				return;
			}

			var spinner = dom_helper.loadingCircle();
			cohortNode.appendChild(spinner);

			if (!indxObj.index){
				buildIndex (indxObj, _.intersection(activeHosts, metadataFilterHosts));
			}

			tiimer = setInterval(function(){
				if (!indxObj.index){
					return;
				}
				store = indxObj.store;
				idx = indxObj.index;
				displaySearchResult();
				clearInterval(tiimer);
			}, 50);
		}

		//overall container
		var container = dom_helper.elt("div");
		container.setAttribute("id", "content-container");

		//sidebar
		var sideNode = hubSideBar(activeHosts);
		container.appendChild(sideNode);

		//main section cohort list page
		var mainNode = dom_helper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");

		//search node
		var searchNode = dom_helper.sectionNode("cohort");
		searchUI(searchNode);
		mainNode.appendChild(searchNode);

		var cohortNode = dom_helper.sectionNode("cohort");
		mainNode.appendChild(cohortNode);

		//cohort list
		cohortListPage(_.intersection(activeHosts, metadataFilterHosts), cohortNode);
		container.appendChild(mainNode);

		//the end
		container.appendChild(dom_helper.elt("br"));
		baseNode.appendChild(container);
	}

	//testing your markdowns http://showdownjs.github.io/demo/
	function renderMarkDownFile(file, node)
	{
	    Rx.DOM.get(file).subscribe(function(resp){
	    	var converter = new showdown.Converter();
			node.innerHTML = converter.makeHtml(resp.responseText);
			node.appendChild(document.createElement("br"));
	    });
	}

	function hostPage (baseNode,host){
		//hub markdown
		var mdFile = host+"/download/meta/info.mdown",
			markdownNode = document.createElement("div");
		markdownNode.setAttribute("class","hubinfo");
		baseNode.appendChild(markdownNode);
		renderMarkDownFile(mdFile, markdownNode);

		// hub basic info and hub configuration button
		var node = document.createElement("div"),
			hostLabel = session.getHubName(host),
			tmpNode = dom_helper.hrefLink(hostLabel + " (connecting)", "../datapages/?host=" + host);

		node.setAttribute("class","hubinfo");
		tmpNode.setAttribute("id", "status" + host);
		node.appendChild(dom_helper.elt("h2", tmpNode, configHubButton() ));

		node.appendChild(document.createTextNode("Hub Address: " +host));
		session.updateHostStatus(host);

		// cohort list
		cohortListPage([host], node);
		baseNode.appendChild(node);
	}

	function updataDOM_xenaDataSet_sampleN(DOM_id, host, dataset) {
		xenaQuery.dataset_samples(host, dataset).subscribe(function (s) {
			var tag = "result";
			var node = document.getElementById(DOM_id);
			node.parentNode.replaceChild(dom_helper.elt(tag, (s.length.toLocaleString())), node);
		});
	}


	function updateDOM_xenaCohort_sampleN(DOM_id, hosts, cohort) {
		var source = Rx.Observable.zipArray(
			hosts.map(function (host) {
				return xenaQuery.all_samples(host,cohort);
			})
		);

		source.subscribe(function(x){
			var node = document.getElementById(DOM_id),
				sampleN= _.uniq(_.flatten(x)).length;
			node.appendChild(dom_helper.elt("result", " " + sampleN.toLocaleString()));
		});
	}

	function start(baseNode){
		var container, sideNode, mainNode,
			keys = Object.keys(query_string),
			host = query_string.host,
			dataset =decodeURIComponent(query_string.dataset),
			cohort = decodeURIComponent(query_string.cohort),
			sample = decodeURIComponent(query_string.sample),
			label = decodeURIComponent(query_string.label),
			nSamples = query_string.nSamples,
			nProbes = query_string.nProbes,
			allIdentifiers = query_string.allIdentifiers,
			allSamples = query_string.allSamples;

		// ?host=id
		if (keys.length===1 && host) {
			if (allHosts.indexOf(host) === -1) {
			    return;
			}
			hostPage (baseNode, host);
		}

		// ?dataset=id & host=id
		else if (keys.length===2 && host && dataset) {
			container = dom_helper.elt("div");
			container.setAttribute("id", "content-container");

			sideNode = dom_helper.elt("div");
			sideNode.setAttribute("id", "sidebar");
			container.appendChild(sideNode);

			//main section dataset detail page
			mainNode = dom_helper.elt("div");
			mainNode.setAttribute("id", "dataPagesMain");
			container.appendChild(mainNode);

			baseNode.appendChild(container);

			xenaQuery.dataset_by_name(host, dataset).subscribe(
				function (s) {
					if (s.length) {
						//dataset sidebar
						datasetSideBar(s[0],sideNode);
						datasetPage(s[0], host, mainNode);
					}
				}
			);
		}

		// ?sample=id&cohort=id
		else if ( keys.length===2 && cohort && sample) {
			ifCohortExistDo(cohort, activeHosts, undefined, function() {
				samplePage(baseNode, sample, cohort);
			});
		}

		// ?cohort=id
		else if (keys.length ===1 && cohort) {
			container = dom_helper.elt("div");
			container.setAttribute("id", "content-container");

			//sidebar
			sideNode = hubSideBar(activeHosts);
			container.appendChild(sideNode);

			//main section cohort list page
			mainNode = dom_helper.elt("div");
			mainNode.setAttribute("id", "dataPagesMain");

			cohortPage(cohort, _.intersection(activeHosts, metadataFilterHosts), mainNode);
			container.appendChild(mainNode);

			container.appendChild(dom_helper.elt("br"));
			baseNode.appendChild(container);
		}

		// large data snippet
		else if (keys.length ===4 && host && dataset && nSamples && nProbes) {
			bigDataSnippetPage (host, dataset, nSamples, nProbes);
		}

		// all identifiers of a dataset
		else if (keys.length ===4 && host && dataset && label && allIdentifiers) {
			allIdentifiersPage (host, dataset, label);
		}

		// all samples of a dataset
		else if (keys.length ===4 && host && dataset && label && allSamples) {
			allSamplesPage (host, dataset, label);
		}

		// front page: cohort list
		else {
			frontPage(baseNode);
		}
	}

	var query_string = dom_helper.queryStringToJSON(),  	//parse current url to see if there is a query string
		COHORT_NULL = '(unassigned)',
		TYPE_NULL = 'genomicMatrix',
		NOT_GENOMICS = ["sampleMap", "probeMap", "genePred", "genePredExt","genomicSegment"],
		FORMAT_MAPPING = {
			'clinicalMatrix': "ROWs (samples)  x  COLUMNs (identifiers)",
			'genomicMatrix': "ROWs (identifiers)  x  COLUMNs (samples)",
			'mutationVector': "Mutation by Position",
			'unknown': "unknown"
		},
		treehouseImg = require('../images/Treehouse.jpg'),
		infoImgSource = require('../images/Info.png');

	session.sessionStorageInitialize();
	var state = JSON.parse(sessionStorage.state),
		allHosts = state.allHosts, // all hosts
		activeHosts = state.activeHosts, // activetHosts
		userHosts = state.userHosts, // selectedtHosts
		localHost = state.localHost, //localhost
		metadataFilterHosts = state.metadataFilterHosts; // metadataFilter

	return {
		start:start
	};
});
