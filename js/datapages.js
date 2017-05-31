/*global define: false, confirm: true */
/*global require: false, module: false */

'use strict';

var domHelper = require("./dom_helper");
var xenaQuery = require("./xenaQuery");
var session = require("./session");
var _ = require("underscore");
var Rx = require("./rx");
var xenaAdmin = require("./xenaAdmin");
var lunr = require("lunr");
var {defaultLocal} = require('./defaults');

require("../css/datapages.css");

var showdown = require('showdown');  /* https://github.com/showdownjs/showdown */

var {activeHosts} = session;
var allHosts;

var queryString = domHelper.queryStringToJSON(),  	//parse current url to see if there is a query string
	COHORT_NULL = '(unassigned)',
	TYPE_NULL = 'genomicMatrix',
	NOT_GENOMICS = ["sampleMap", "probeMap", "genePred", "genePredExt"],
	FORMAT_MAPPING = {
		'clinicalMatrix': "ROWs (samples)  x  COLUMNs (identifiers) (i.e. clinicalMatrix)",
		'genomicMatrix': "ROWs (identifiers)  x  COLUMNs (samples) (i.e. genomicMatrix)",
		'mutationVector': "Variant by Position (i.e. mutationVector)",
		'genomicSegment': 'Genomic Segment (i.e. genomicSegment)',
		'unknown': "unknown"
	},
	denseMatrixType = ['genomicMatrix', 'clinicalMatrix'],
	treehouseImg = require('../images/Treehouse.jpg'),
	infoImgSource = require('../images/Info.png'),
	cohortMetaDataSource = "https://rawgit.com/ucscXena/cohortMetaData/master/";

const MAX_SAMPLES = 1000 * 1000;

function datasetList(servers, cohort) {
	return Rx.Observable.zipArray(
			_.map(servers, server => xenaQuery.datasetList(server, [cohort])
				.catch(() => Rx.Observable.of([]))
				.map(datasets => ({server, datasets})))
	);
}


// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
function checkGenomicDataset(hosts, cohort, goodStatus) {
	return datasetList(hosts, cohort).map(function (s) {
		return s.some(function (r) {
			if (r.datasets) {
				return r.datasets.some(function (dataset) {
					var format = dataset.type,
						dataSubType = dataset.dataSubType,
						patt = /filter/i,
						status = dataset.status;
					return ((goodStatus ? (status === goodStatus) : true) &&
							(NOT_GENOMICS.indexOf(format) === -1) &&
							(dataSubType ? !(patt.test(dataSubType)) : true)
							);
				});
			}
			return false;
		});
	});
}

// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
function checkGenomicDatasetAllBad(hosts, cohort, goodStatus) {
	return datasetList(hosts, cohort).map(function (s) {
		return s.every(function (r) {
			if (r.datasets && r.datasets.length > 0) {
				return r.datasets.some(function (dataset) {
					var format = dataset.type,
						dataSubType = dataset.dataSubType,
						patt = /filter/i,
						status = dataset.status;
					return ((goodStatus ? (status !== goodStatus) : false) ||
							(NOT_GENOMICS.indexOf(format) !== -1) ||
							(dataSubType ? patt.test(dataSubType) : false)
							);
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

function deleteDataButton (dataset) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host;

	if((host === defaultLocal) && ((dataset.status === session.GOODSTATUS ) || (dataset.status === "error"))) {
		var deletebutton = document.createElement("BUTTON");
		deletebutton.setAttribute("class", "vizbutton");
		deletebutton.appendChild(document.createTextNode("Remove"));
		deletebutton.addEventListener("click", function() {
			var r = confirm("Delete \"" + name + "\" from my computer hub.");
			if (r === true) {
				xenaAdmin.delete(defaultLocal, name).subscribe();
				location.reload(); // reload current page
			}
	  });
	  return deletebutton;
	}
}

function userActiveHosts(subset) {
	var uAH = _.keys(allHosts).filter(h => allHosts[h].user && activeHosts.has(h));
	return subset ? _.intersection(uAH, subset) : uAH;
}

function cohortHeatmapButton(cohort, hosts, vizbuttonParent) {
	var vizbutton,
		goodStatus = session.GOODSTATUS;

	ifCohortExistDo(cohort, hosts, goodStatus, function() {
		vizbutton = document.createElement("BUTTON");
		vizbutton.setAttribute("class", "vizbutton");
		vizbutton.appendChild(document.createTextNode("Visualize"));
		vizbutton.addEventListener("click", function() {
			session.xenaHeatmapSetCohort(cohort);
			location.href = "../heatmap/"; //goto heatmap page
		});
		vizbuttonParent.appendChild(vizbutton);
	});
}

function cohortVizButtonBootstrap(cohort, hosts, vizbuttonParent) {
	var vizbutton,
		goodStatus = session.GOODSTATUS;

	ifCohortExistDo(cohort, hosts, goodStatus, function() {
		vizbutton = document.createElement("input");
		vizbutton.type = "button";
		vizbutton.className = "btn btn-primary";
		vizbutton.value = "Visualize";
		vizbutton.addEventListener("click", function() {
			session.xenaHeatmapSetCohort(cohort);
			location.href = "../heatmap/";
		});
		vizbuttonParent.appendChild(vizbutton);
	});
}

function configHubButton () {
	var button = document.createElement("BUTTON");
	button.setAttribute("class", "vizbutton");
	button.appendChild(document.createTextNode("Configure my data hubs"));
	button.addEventListener("click", function() {
		location.href = "../hub/";
	 });
	return button;
}

function warningPopUp (node, loaderWarning) {
	node.onclick = function() {
		alert("Load Waring:\n" + JSON.stringify(loaderWarning));
	};
}

function adhocTooltip (outsideDiv, tooltipDOM, tipMessage ) {
	var fadeSpeed = 25; // a value between 1 and 1000 where 1000 will take 10
						// seconds to fade in and out and 1 will take 0.01 sec.

	var showTip = function() {
		var tip = document.createElement("span");
	tip.className = "tooltip";
	tip.id = "tip";
	tip.innerHTML = tipMessage;
	  outsideDiv.appendChild(tip);
	tip.style.opacity = "0"; // to start with...
	var intId = setInterval(function() {
		var newOpacity = parseFloat(tip.style.opacity) + 0.1;
		tip.style.opacity = newOpacity.toString();
		if(tip.style.opacity === "1") {
			clearInterval(intId);
		}
	}, fadeSpeed);
	};
	var hideTip = function() {
		var tip = document.getElementById("tip");
		var intId = setInterval(function() {
			var newOpacity = parseFloat(tip.style.opacity) - 0.1;
			tip.style.opacity = newOpacity.toString();
			if(tip.style.opacity === "0") {
				clearInterval(intId);
				tip.remove();
			}
		}, fadeSpeed);
		tip.remove();
	};

	tooltipDOM.addEventListener("mouseover", showTip, false);
	tooltipDOM.addEventListener("mouseout", hideTip, false);
}

function buildInfoImage (tipMessage) {
	var node = document.createElement("span"),
		img = new Image();

	img.src = infoImgSource;
	img.height = "20";
	node.appendChild(img);

	adhocTooltip(node, img, tipMessage);

	return node;
}

function buildTreeHouseImage (cohortName) {
	var img;
	if (cohortName.search(/^Treehouse/gi) !== -1) {
		img = new Image();
		img.src = treehouseImg;
		img.height = "40";
	}
	return img;
}

//testing your markdowns http://showdownjs.github.io/demo/
function renderMarkDownFile(file, node)
{
	Rx.Observable.ajax({url: file, crossDomain: true, method: 'GET', responseType: 'text'}).subscribe(function(resp) {
		var converter = new showdown.Converter();
		node.innerHTML = converter.makeHtml(resp.response);
		node.appendChild(document.createElement("br"));
	});
}

function buildCohortMetaDataLink(cohortName)
{
	cohortName = cohortName.replace("(", "-").replace(")", "");
	return cohortMetaDataSource + "cohort_" + cohortName + "/info.mdown";
}

// the short COHORT section with no detail, just name, vizbutton (if valid), img (optional)
function eachCohortMultiple(cohortName, hosts, node) {
	var liNode = document.createElement("li"),
		img,
		link = "?cohort=" + encodeURIComponent(cohortName),
		nodeTitle = domHelper.hrefLink(cohortName, link),
		tmpNode;

	//info image
	tmpNode = document.createElement("a");
	tmpNode.setAttribute("href", link);
	tmpNode.appendChild(buildInfoImage("click for cohort detail ..."));
	liNode.appendChild(tmpNode);

	//treehouse img
	img = buildTreeHouseImage(cohortName);
	if (img) {
		liNode.appendChild(img);
	}

	//for single active host but not selected by user senario
	if ((hosts.length === 1) && !allHosts[hosts[0]].user) {
		nodeTitle.style.color = "gray";
	}

	//title
	liNode.appendChild(nodeTitle);

	//viz button
	tmpNode = document.createElement("span");
	liNode.appendChild(tmpNode);
	cohortHeatmapButton(cohortName, userActiveHosts(), tmpNode);

	// new status
	tmpNode = document.createElement("span");
	liNode.appendChild(tmpNode);

	node.appendChild(liNode);

	//remove extra
	if (cohortName === COHORT_NULL) {
		ifCohortDoesNotExistDo(cohortName, hosts, session.GOODSTATUS, function () {
			node.removeChild(liNode);
		});
	}
}

function cohortListPage(hosts, rootNode) {
	if (!hosts || hosts.length <= 0) {
		return;
	}

	var source = Rx.Observable.zipArray(
		hosts.map(function (host) {
			return xenaQuery.allCohorts(host).catch(() => Rx.Observable.of([]));
		})
	);

	source.subscribe(function (x) {
		var cohortC = [];

		_.flatten(x).forEach(function(cohort) {
			if (cohortC.indexOf(cohort) === -1) {
					cohortC.push(cohort);
				}
			});

		rootNode.appendChild(domHelper.elt("h2", cohortC.filter(cohortName => cohortName !== COHORT_NULL).length + " Cohorts"));
		var node = document.createElement("div");
		node.setAttribute("id", "cohortList");
		rootNode.appendChild(node);

		cohortC.sort(function (a, b) {
			if (a === COHORT_NULL) {
				return 1;
			}
			else if (b === COHORT_NULL) {
				return -1;
			}
			return a.toLowerCase().localeCompare(b.toLowerCase());
		});

		cohortC.map(function(cohort) {
			eachCohortMultiple(cohort, hosts, node);
		});
	});

	rootNode.appendChild(document.createElement("br"));
}

//	build single COHORT page
function cohortPage(cohortName, hosts, rootNode) {
	//cohort section
	var tmpNode, img,
	node = domHelper.sectionNode("cohort"),
	vizbuttonParent;

	rootNode.appendChild(node);

	//cohort markdown
	var mdFile = buildCohortMetaDataLink(cohortName),
		markdownNode = document.createElement("div");
	renderMarkDownFile(mdFile, markdownNode);
	markdownNode.style.padding = "0px 100px 0px 0px";
	node.appendChild(markdownNode);

	//title
	vizbuttonParent = domHelper.elt("h2", "cohort: ");
	node.appendChild(vizbuttonParent);

	img = buildTreeHouseImage(cohortName);
		if (img) {
			vizbuttonParent.appendChild(img);
	}
	vizbuttonParent.appendChild(document.createTextNode(cohortName + ' '));
	cohortVizButtonBootstrap(cohortName, userActiveHosts(), vizbuttonParent);


	ifCohortExistDo (cohortName, hosts, undefined, function() {
		//dataset list
		datasetList(hosts, cohortName).subscribe(
			function (s) {
				//collection datasets by dataSubType
				var datasetsBySubtype = {};
				_.map(s, r => {
					var host = r.server,
						datasets = r.datasets;
					_.map (datasets, dataset => {
						var type = dataset.dataSubType,
							format = dataset.type;

						dataset.host = host;
						dataset.label = dataset.label ? dataset.label : dataset.name;

						if (NOT_GENOMICS.indexOf(format) === -1) {
							if (!(datasetsBySubtype[type])) {
								datasetsBySubtype[type] = [];
							}
							datasetsBySubtype[type].push(dataset);
						}
					});
				});

				// dataType section
				var nodeDataType = domHelper.sectionNode("dataType");

				var dataTypes = _.keys(datasetsBySubtype).sort(function (a, b) {
						return a.toLowerCase().localeCompare(b.toLowerCase());
					});

				dataTypes.map(function (dataSubType) {
					var headerDisplayed,
						listNode,
						displayType = dataSubType;

					if (dataSubType === "undefined") {
						displayType = "others";
					}

					listNode = domHelper.elt("div");

					_.sortBy(datasetsBySubtype[dataSubType], "label").map(function (dataset) {
						var fullname = dataset.host + dataset.name,
							link = "?dataset=" + dataset.name + "&host=" + dataset.host,
							datasetNode = document.createElement("ul");

						if (dataSubType && (dataSubType.search(/filter/i) !== -1) && (dataset.host !== defaultLocal)) {
							return;
						} else if (!headerDisplayed) {
							nodeDataType.appendChild(domHelper.elt("header", displayType));
							headerDisplayed = 1;
						}

						//info image
						tmpNode = document.createElement("a");
						tmpNode.setAttribute("href", link);
						tmpNode.appendChild(buildInfoImage("click for dateset detail ..."));
						datasetNode.appendChild(tmpNode);

						//dataset name and link
						datasetNode.appendChild(domHelper.hrefLink(dataset.label, link));

						//status
						if (dataset.status === session.GOODSTATUS ) { // good data, with or without warning
							datasetNode.appendChild(domHelper.valueNode(fullname + "sampleN"));
							if (denseMatrixType.indexOf(dataset.type) === -1) {
								xenaQuery.datasetSamples(dataset.host, dataset.name, MAX_SAMPLES).subscribe(function (s) {
									document.getElementById(fullname + "sampleN").
									appendChild(domHelper.elt("label", document.createTextNode(" (n=" + s.length.toLocaleString() + ")")));
								});
							} else {
								xenaQuery.datasetSamplesNDenseMatrix(dataset.host, dataset.name).subscribe(function (s) {
									document.getElementById(fullname + "sampleN").
									appendChild(domHelper.elt("label", document.createTextNode(" (n=" + s.toLocaleString() + ")")));
								});
							}
						} else if (dataset.status === "error") {  // show error status
							tmpNode = domHelper.elt("span", " [" + dataset.status + "] ");
							tmpNode.style.color = "red";
							datasetNode.appendChild(tmpNode);
						} else {
							datasetNode.appendChild(document.createTextNode(" [" + dataset.status + "] "));
						}

						// host
						tmpNode = domHelper.hrefLink(session.getHubName(dataset.host), "?host=" + dataset.host);
						tmpNode.setAttribute("id", "status" + dataset.host);
						datasetNode.appendChild(tmpNode);
						session.updateHostStatus(dataset.host);

						// delete and reload button
						var deletebutton = deleteDataButton (dataset);
						if(deletebutton) {
							datasetNode.appendChild(deletebutton);
						}

						//dataset description
						if (dataset.description) {
							var descriptionNode = domHelper.elt("div");
							descriptionNode.setAttribute("class", "line-clamp");
							descriptionNode.appendChild(domHelper.elt("summary", domHelper.stripHTML(dataset.description)));

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

function downloadDataButtonUpdate(dataset, button) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host,
		link = host + "/download/" + name ;

	Rx.Observable.ajax({url: link, crossDomain: true, method: 'HEAD'}).subscribe(
		function(resp) {
			if (resp.status === 200) {
				button.addEventListener("click", function() {
					location.href = link;
				});
			}
		},
		function () {
			link = link + ".gz";
			Rx.Observable.ajax({url: link, crossDomain: true, method: 'HEAD'}).subscribe(
				function () {
					button.addEventListener("click", function() {
						location.href = link;
					});
				},
				function () {
					button.parentNode.replaceChild(document.createElement("div"), button);
				}
			);
		}
	);
}

function downloadLinkUpdate(dataset, downloadNode) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host,
		link = host + "/download/" + name ;

	Rx.Observable.ajax({url: link, crossDomain: true, method: 'HEAD'}).subscribe(
		function(resp) {
			if (resp.status === 200) {
				downloadNode.parentNode.replaceChild(domHelper.hrefLink(link, link), downloadNode);
			}
		},
		function () {
			link = link + ".gz";
			Rx.Observable.ajax({url: link, crossDomain: true, method: 'HEAD'}).subscribe(
				function (resp) {
					if (resp.status === 200) {
						downloadNode.parentNode.replaceChild(domHelper.hrefLink(link, link), downloadNode);
					}
				},
				function () {
					downloadNode.parentNode.replaceChild(document.createTextNode('no download'), downloadNode);
				}
			);
		}
	);
}

function metaDataLink(dataset) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host;

	return host + "/download/" + name + ".json";
}

function updataDOMXenaDataSetSampleN(DOM_ID, host, dataset) {
	if (denseMatrixType.indexOf(dataset.type) === -1) {
		xenaQuery.datasetSamples(host, dataset.name, MAX_SAMPLES).subscribe(function (s) {
			var node = document.getElementById(DOM_ID);
			node.parentNode.replaceChild(document.createTextNode(s.length.toLocaleString()), node);
		});
	} else {
		xenaQuery.datasetSamplesNDenseMatrix(host, dataset.name).subscribe(function (s) {
			var node = document.getElementById(DOM_ID);
			node.parentNode.replaceChild(document.createTextNode(s.toLocaleString()), node);
		});
	}
}

function addMoreDataLink (dataset, probesLength, linkNode) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host,
		format = dataset.type,
		qString,
		qStringObj = {
			"host": host,
			"dataset": name,
			"nSamples": 10,
			"nProbes": probesLength
		},
		link;

	if (format === "mutationVector" || format === "genomicSegment") {
		qStringObj.nProbes = 1000;
	}
	if (format === "genomicMatrix" ) {
		qStringObj.nProbes = 100;
	}
	if (format === "clinicalMatrix") {
		qStringObj.nSamples = 500;
	}
	qString = domHelper.JSONToqueryString(qStringObj);
	link = "../datapages/?" + qString;
	linkNode.setAttribute("href", link);
}

function addAllIdLink (dataset, linkNode) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host,
		label = dataset.label ? dataset.label : name,
		link, qString,
		qStringObj = {
			"host": host,
			"dataset": name,
			"label": label,
			"allIdentifiers": true
		};

	qString = domHelper.JSONToqueryString(qStringObj);
	link = "../datapages/?" + qString;
	linkNode.setAttribute("href", link);
}

function addAllSampleLink (dataset, linkNode) {
	var name = JSON.parse(dataset.dsID).name,
		host = JSON.parse(dataset.dsID).host,
		label = dataset.label ? dataset.label : name,
		link, qString,
		qStringObj = {
			"host": host,
			"dataset": name,
			"label": label,
			"allSamples": true
		};

	qString = domHelper.JSONToqueryString(qStringObj);
	link = "../datapages/?" + qString;
	linkNode.setAttribute("href", link);
}

// almost dup of fn in plotMutationVector.js. Should factor this out.
function mutationAttrs(list) {
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

function segmentAttrs(list) {
	return _.map(list, function (row) {
		return {
			"sampleid": row.sampleID,
			"chrom": row.position.chrom,
			"chromstart": row.position.chromstart,
			"chromend": row.position.chromend,
			"value": row.value
		};
	});
}

// dup of fn in plotMutationVector.js. Should factor this out.
function collateRows(rows) {
	var keys = _.keys(rows);
	return _.map(_.range(rows[keys[0]].length), i => _.object(keys, _.map(keys, k => rows[k][i])));
}

function dataSnippets (dataset, nSamples, nProbes, node) {
	var table,
		host = JSON.parse(dataset.dsID).host,
		name = dataset.name,
		type = dataset.type;

	if (!type ) {  // when type is not specified, xena loader treat the file as genomicMatrix
		type = "genomicMatrix";
	}

	if ((type === "genomicMatrix")  || (type === "clinicalMatrix")) {
		//data snippet samples, probes
		xenaQuery.datasetSamplesExamples(host, name, nSamples).subscribe(
			function (samples) {
				var query = xenaQuery.datasetFieldExamples(host, name, nProbes);
				query.subscribe(function (probes) {
					probes = probes.map(function (probe) {
						return probe.name;
					});
					xenaQuery.fieldCodes(host, name, probes).subscribe(function(codemap) {
						//return probes by all_samples
						var row, column,
							dataRow, dataCol,
							i, j,
							firstRow, firstCol;

						xenaQuery.datasetProbeValues(host, name, samples, probes).subscribe( function (matrix) {
							if (type === "genomicMatrix") {
								firstCol = probes;
								firstRow = samples;
							} else {
								firstCol = samples;
								firstRow = probes;
							}

							column = firstRow.length;
							row = firstCol.length;

							table = domHelper.tableCreate(row + 1, column + 1);

							node.parentNode.replaceChild(table, node);

							if (type === "genomicMatrix") {
								dataCol = column; //sample
								dataRow = row; //probe
							} else if (type === "clinicalMatrix") {
								dataCol = column; //probe
								dataRow = row; //sample
							}

							//first row -- labels
							for (j = 1; j < dataCol + 1; j++) {
								domHelper.setTableCellValue (table, 0, j, firstRow[j - 1]);
							}

							//first col
							for (i = 1; i < dataRow + 1; i++) {
								domHelper.setTableCellValue (table, i, 0, firstCol[i - 1]);
							}

							//data cell
							for(i = 1; i < matrix[1].length + 1; i++) {
								var probe = probes[i - 1],
									value, code;

								for (j = 1; j < samples.length + 1; j++) {
									value = matrix[1][i - 1][j - 1];
									code = undefined;
									if (codemap[probe]) {
										if(!isNaN(value)) {
											code = codemap[probe][value];
										}
									}

									if ((type === "genomicMatrix") && (i < dataRow + 1) && (j < dataCol + 1)) {
										domHelper.setTableCellValue (table, i, j, code ? code : value);
									} else if ((type === "clinicalMatrix") && (j < dataRow + 1) && (i < dataCol + 1)) {
										domHelper.setTableCellValue (table, j, i, code ? code : value);
									}
								}
							}
							domHelper.setTableCellValue (table, 0, 0, " ");
						});
					});
				});
			});
		}
	else if(type === "mutationVector" || (type === "genomicSegment")) {
		var queryFunction,
			attributeFunction;
		if (type === "mutationVector") {
			queryFunction = xenaQuery.sparseDataExamples;
			attributeFunction = mutationAttrs;
		} else if (type === "genomicSegment") {
			queryFunction = xenaQuery.segmentDataExamples;
			attributeFunction = segmentAttrs;
		}
		queryFunction(host, name, nProbes).map(r => attributeFunction(collateRows(r.rows))).subscribe(function(rows) {
			if (rows && rows.length > 0) {
				var i, j, key,
					keys = Object.keys(rows[0]).sort(),
					column = keys.length,
					row = rows.length,
					dataRow = (row < nProbes) ? row : nProbes - 2,  //number of lines of data
					tableRow = (row < nProbes) ? row : nProbes - 1;  //table row number excluding header

				// put chrom chromstart chromend together to be more readable
				var start = keys.indexOf("chromstart"),
					end = keys.indexOf("chromend"),
					keysP = {};
				keys[start] = "chromend";
				keys[end] = "chromstart";

				table = domHelper.tableCreate(tableRow + 1, column + 1);
				node.parentNode.replaceChild(table, node);

				//first row -- labels
				for (j = 1; j < keys.length + 1; j++) {
					domHelper.setTableCellValue (table, 0, j, keys[j - 1]);
					keysP[keys[j - 1]] = j;
				}

				//data cell
				for(i = 1; i < dataRow + 1; i++) {
					for (key in rows[i - 1]) {
						if (rows[i - 1].hasOwnProperty(key)) {
							j = keysP[key];
							domHelper.setTableCellValue (table, i, j, rows[i - 1][key]);
							//first column
							if (key === "sampleid") {
								domHelper.setTableCellValue (table, i, 0, rows[i - 1][key]);
							}
						}
					}
				}
				domHelper.setTableCellValue (table, 0, 0, " ");
			}
		});
	}
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
		wranglingProcedure = dataset.wrangling_procedure,
		type = dataset.type || TYPE_NULL,
		urls,
		link, metalink,
		status = dataset.status,
		loaderWarning = dataset.loader,
		probeMap = dataset.probeMap,
		goodStatus = session.GOODSTATUS,
		nodeTitle, hostNode, downloadNode,
		tmpNode;


	if (description) {
		description = domHelper.stripScripts(description);
	}

	if (wranglingProcedure) {
		wranglingProcedure = domHelper.stripScripts(wranglingProcedure);
	}

	if (url) {
		urls = _.uniq(url.split(","));
	}

	// layout
	var sectionNode = domHelper.sectionNode("dataset");

	// dataset title
	sectionNode.appendChild(domHelper.elt("h2", "dataset: " + label));
	sectionNode.appendChild(domHelper.elt("br"));

	// long title
	if (longTitle) {
		sectionNode.appendChild(document.createTextNode(longTitle));
		sectionNode.appendChild(domHelper.elt("br"));
	}

	//description
	if (description) {
		sectionNode.appendChild(domHelper.elt("br"));

		tmpNode = domHelper.elt("result2");
		tmpNode.innerHTML = description;

		sectionNode.appendChild(tmpNode);
		sectionNode.appendChild(domHelper.elt("br"));
	}

	// cohort:xxx
	sectionNode.appendChild(domHelper.elt("labelsameLength", "cohort"));
	nodeTitle = domHelper.hrefLink(cohort, "?cohort=" + encodeURIComponent(cohort));
	sectionNode.appendChild(domHelper.elt("resultsameLength", nodeTitle));
	sectionNode.appendChild(domHelper.elt("br"));

	// ID
	sectionNode.appendChild(domHelper.elt("labelsameLength", "dataset ID"));
	sectionNode.appendChild(domHelper.elt("resultsameLength", name));
	sectionNode.appendChild(domHelper.elt("br"));


	// status and loader warning
	if (status === goodStatus && !loaderWarning) { // perfect data
	} else if (status === goodStatus && loaderWarning) { // loaded with warning
		tmpNode = domHelper.hrefLink("loaded with warning", "#");
		tmpNode.style.color = "red";
		tmpNode.style.textDecoration = "underline";
		warningPopUp (tmpNode, loaderWarning);
		sectionNode.appendChild(domHelper.elt("labelsameLength", "status"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", tmpNode));
		sectionNode.appendChild(domHelper.elt("br"));
	} else if (status === "error") { // error
		tmpNode = domHelper.elt("span", status);
		tmpNode.style.color = "red";
		sectionNode.appendChild(domHelper.elt("labelsameLength", "status"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", tmpNode));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	else {
		tmpNode = domHelper.elt("span", status);
		tmpNode.style.color = "blue";
		sectionNode.appendChild(domHelper.elt("labelsameLength", "status"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", tmpNode));
		sectionNode.appendChild(domHelper.elt("br"));
	}

	// Downlaod
	sectionNode.appendChild(domHelper.elt("labelsameLength", "download"));
	downloadNode = document.createElement("div");
	metalink = metaDataLink (dataset);

	sectionNode.appendChild(domHelper.elt("resultsameLength",
		downloadNode,
		document.createTextNode("; "),
		domHelper.hrefLink("Full metadata", metalink)));
	downloadLinkUpdate(dataset, downloadNode);
	sectionNode.appendChild(domHelper.elt("br"));

	// samples: n
	sectionNode.appendChild(domHelper.elt("labelsameLength", "samples"));
	sectionNode.appendChild(domHelper.valueNode(dataset + "SampleN"));
	updataDOMXenaDataSetSampleN(dataset + "SampleN", host, dataset);
	sectionNode.appendChild(domHelper.elt("br"));

	// update on: xxx
	if (version) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "version"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", version));
		sectionNode.appendChild(domHelper.elt("br"));
	}

	// host: host
	sectionNode.appendChild(domHelper.elt("labelsameLength", "hub"));
	hostNode = domHelper.elt("resultsameLength",
		domHelper.hrefLink(session.getHubName(host), "?host=" + host));
	hostNode.setAttribute("id", "status" + host);
	sectionNode.appendChild(hostNode);
	session.updateHostStatus(host);
	sectionNode.appendChild(domHelper.elt("br"));

	// type of data
	if (dataType) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "type of data"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", dataType));
		sectionNode.appendChild(domHelper.elt("br"));
	}

	// assembly
	if (assembly) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "assembly"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", assembly));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	//unit
	if (unit) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "unit"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", unit));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	//platform
	if (platform) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "platform"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", platform));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	//probeMap
	if (probeMap) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "ID/Gene mapping"));
		if (host === "https://genome-cancer.ucsc.edu:443/proj/public/xena") {
			link = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//, "");
			metalink = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//, "") + ".json";
		}
		else {
			link = host + "/download/" + probeMap;
			metalink = host + "/download/" + probeMap + ".json";
		}

		sectionNode.appendChild(domHelper.elt("resultsameLength",
			domHelper.hrefLink(probeMap, link),
			document.createTextNode(";  "),
			domHelper.hrefLink("Metadata", metalink)));

		sectionNode.appendChild(domHelper.elt("br"));
	}

	if (articletitle) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "publication"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", articletitle));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	if (citation) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "citation"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", citation));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	if (author) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "author"));
		sectionNode.appendChild(domHelper.elt("resultsameLength", author));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	if (pmid) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "PMID"));
		sectionNode.appendChild(
			domHelper.elt("resultsameLength", domHelper.hrefLink(
				pmid.toString(), "http://www.ncbi.nlm.nih.gov/pubmed/?term=" + pmid.toString())));
		sectionNode.appendChild(domHelper.elt("br"));
	}
	if (urls) {
		urls.forEach(function (url) {
			sectionNode.appendChild(domHelper.elt("labelsameLength", "raw data"));
			sectionNode.appendChild(domHelper.elt("resultsameLength", domHelper.hrefLink(url, url)));
			sectionNode.appendChild(domHelper.elt("br"));
		});
	}

	if (wranglingProcedure) {
		sectionNode.appendChild(domHelper.elt("labelsameLength", "wrangling"));

		tmpNode = domHelper.elt("resultsameLength");
		tmpNode.innerHTML = wranglingProcedure;

		sectionNode.appendChild(tmpNode);
		sectionNode.appendChild(domHelper.elt("br"));
	}

	// input file format
	sectionNode.appendChild(domHelper.elt("labelsameLength", "input data format"));
	sectionNode.appendChild(domHelper.elt("resultsameLength", FORMAT_MAPPING[type]));
	sectionNode.appendChild(domHelper.elt("br"));
	baseNode.appendChild(sectionNode);

	if (status !== goodStatus) {
		baseNode.appendChild(sectionNode);
		return;
	}

	sectionNode.appendChild(domHelper.elt("br"));
	// dimentions
	var oldNode = domHelper.elt("span"),
		spaceHolderNode = domHelper.elt("span"),
		node =  domHelper.elt("span"),
		node2 = domHelper.elt("span");

	sectionNode.appendChild(oldNode);
	sectionNode.appendChild(domHelper.elt("br"));

	if (type === "genomicMatrix") {
		//identifiers count
		spaceHolderNode.appendChild(node2);
		spaceHolderNode.appendChild(document.createTextNode(" x "));
		// samples: n
		spaceHolderNode.appendChild(node);
		spaceHolderNode.appendChild(domHelper.elt("span", " "));
	} else if (type === "clinicalMatrix") {
		// samples: n
		spaceHolderNode.appendChild(node);
		spaceHolderNode.appendChild(document.createTextNode(" x "));
		//identifiers count
		spaceHolderNode.appendChild(node2);
		spaceHolderNode.appendChild(domHelper.elt("span", " "));
	} else if (type === "mutationVector") {
		node = undefined;
		node2 = undefined;
	}

	if (node) {
		xenaQuery.datasetSamplesNDenseMatrix(host, name).subscribe(function (s) {
			node.innerHTML = s.toLocaleString() + " samples ";
		});
	}

	xenaQuery.datasetFieldN(host, name).subscribe(function(probesC) {
		if (node2) {
			node2.innerHTML = probesC.toLocaleString() + " identifiers ";
		}
		sectionNode.replaceChild(spaceHolderNode, oldNode);

		tmpNode = domHelper.elt("a", "Show More Data");
		tmpNode.setAttribute("class", "textLink");
		addMoreDataLink(dataset, probesC.length, tmpNode);
		spaceHolderNode.appendChild(tmpNode);

		tmpNode = domHelper.elt("a", "All Identifiers");
		tmpNode.setAttribute("class", "textLink");
		addAllIdLink(dataset, tmpNode);
		spaceHolderNode.appendChild(tmpNode);

		tmpNode = domHelper.elt("a", "All Samples");
		tmpNode.setAttribute("class", "textLink");
		addAllSampleLink(dataset, tmpNode);
		spaceHolderNode.appendChild(tmpNode);
	});

	tmpNode = domHelper.tableCreate(11, 11);
	sectionNode.appendChild(tmpNode);
	sectionNode.appendChild(domHelper.elt("br"));

	dataSnippets(dataset, 10, 10, tmpNode);

	baseNode.appendChild(sectionNode);
}

function backtoDatasetButton (host, dataset) {
	var button = document.createElement("BUTTON");
	button.setAttribute("class", "vizbutton");
	button.appendChild(document.createTextNode("Back to dataset"));
	button.addEventListener("click", function() {
		location.href = "?dataset=" + encodeURIComponent(dataset) + "&host=" + encodeURIComponent(host);
	 });
	return button;
}

function allIdentifiersPage (host, dataset, label) {
	var textNode, text,
		rootNode = domHelper.sectionNode("bigDataSnippet");

	document.body.appendChild(rootNode);
	rootNode.appendChild(domHelper.elt("h3", "dataset: " + label, backtoDatasetButton(host, dataset)));
	textNode = domHelper.elt("div", "Querying xena on " + host + " ... ");
	rootNode.appendChild(textNode);

	xenaQuery.datasetField(host, dataset).subscribe(function(probes) {
		var newBlockNode = document.createElement("pre");
		text = "Identifiers\n";
		probes.forEach(function(probe) {
			text = text + probe.name + "\n";
		});
		newBlockNode.innerHTML = text;
		textNode.parentNode.replaceChild(newBlockNode, textNode);
	});
}

function allSamplesPage (host, dataset, label) {
	var textNode, text,
		rootNode = domHelper.sectionNode("bigDataSnippet");

	document.body.appendChild(rootNode);
	rootNode.appendChild(domHelper.elt("h3", "dataset: " + label, backtoDatasetButton(host, dataset)));
	textNode = document.createElement("pre");
	rootNode.appendChild(textNode);

	text = "Samples\n";
	xenaQuery.datasetSamples(host, dataset, MAX_SAMPLES).subscribe(function(samples) {
		samples.forEach(function(sample) {
			text = text + sample + "\n";
		});
		textNode.innerHTML = text;
	});
}

// build single SAMPLE page
function samplePage(baseNode, sample, cohort) {
	// layout
	var sectionNode = domHelper.sectionNode("dataset");

	// sample title
	sectionNode.appendChild(domHelper.elt("h2", "sample: " + sample));
	sectionNode.appendChild(document.createElement("br"));
	sectionNode.appendChild(domHelper.elt("label", "cohort:"));
	sectionNode.appendChild(domHelper.hrefLink(cohort, "?&cohort=" + cohort));

	baseNode.appendChild(sectionNode);
}

// sidebar active hub list with checkboxes
function hubSideBar(hosts) {
	var sideNode = domHelper.elt("div");
	sideNode.setAttribute("id", "sidebar");

	var checkNode = domHelper.sectionNode("sidehub");

	checkNode.appendChild(domHelper.elt("h3", domHelper.hrefLink("Active Data Hubs", "../hub/")));
	checkNode.appendChild(domHelper.elt("h3"));

	hosts.forEach(function (host) {
		session.updateHostStatus(host);
		var checkbox = session.metaDataFilterCheckBox(host),
			tmpNode = domHelper.elt("result2",
				domHelper.hrefLink(session.getHubName(host) + " (connecting)", "../datapages/?host=" + host));

		tmpNode.setAttribute("id", "sidebar" + host);
		checkbox.setAttribute("id", "sidebarCheck" + host);
		checkNode.appendChild(domHelper.elt("h4", checkbox, " ", tmpNode));
		checkNode.appendChild(domHelper.elt("h4"));
	});
	sideNode.appendChild(checkNode);

	//apply button
	var applybutton = document.createElement("BUTTON");
		applybutton.setAttribute("class", "vizbutton");
		applybutton.appendChild(document.createTextNode("Apply"));
		applybutton.addEventListener("click", function() {
			location.reload();
		});
	sideNode.appendChild(applybutton);

	return sideNode;
}

function downloadDataButton (dataset) {
	if(dataset.status === session.GOODSTATUS) {
		var button = document.createElement("BUTTON");
		button.setAttribute("class", "vizbutton");
		button.appendChild(document.createTextNode("Download"));
	  return button;
	}
}

// sidebar datasets action
function datasetSideBar(dataset, sideNode) {
	//visualize button
	var tmpNode = document.createElement("div");
	sideNode.appendChild(tmpNode);
	if (dataset.status === session.GOODSTATUS) {
		cohortHeatmapButton(dataset.cohort,
			userActiveHosts([JSON.parse(dataset.dsID).host]), tmpNode);
	}

	//download button
	var button = downloadDataButton (dataset);
	if (button) {
		sideNode.appendChild(button);
		sideNode.appendChild(document.createElement("br"));
	}
	downloadDataButtonUpdate(dataset, button);

	// delete button
	button = deleteDataButton (dataset);
	if (button) {
		sideNode.appendChild(button);
		sideNode.appendChild(document.createElement("br"));
	}
}


function bigDataSnippetPage (host, dataset, nSamples, nProbes) {
	var blockNode = domHelper.elt("span", "If you are reading this, you need release browser SHIELD to see the data requested"),
		rootNode = domHelper.sectionNode("bigDataSnippet"),
		node = document.createElement("div");

	document.body.appendChild(rootNode);
	rootNode.appendChild(node);
	node.appendChild( domHelper.elt("h3", "dataset: " + dataset, backtoDatasetButton(host, dataset)));
	node.appendChild( blockNode );
	blockNode.style.color = "red";

	xenaQuery.datasetMetadata(host, dataset).subscribe(
		function (datasets) {
			var newBlockNode = domHelper.elt("div", "Querying xena on " + host + " ... ");
			blockNode.parentNode.replaceChild(newBlockNode, blockNode);
			dataSnippets(datasets[0], nSamples, nProbes, newBlockNode);
		}
	);
}

function xenaTextValuesToString (dataset) {
	delete dataset.loader;
	return JSON.stringify(dataset);
}

function buildIndex (idxObj, hosts) {
	var idx = lunr(function () {
			this.field('cohort');
			this.field('body');
		}),
		store = {},
		i = 0,
		doc;

	var source = Rx.Observable.zipArray(
	  hosts.map(function (host) {
		return xenaQuery.allDatasets(host).catch(() => Rx.Observable.of([]));
	  })
	);

	function addToIndex(host, dataset) {
		var body = xenaTextValuesToString(dataset),
			type = dataset.type,
			status = dataset.status;

		if (NOT_GENOMICS.indexOf(type) === 1) {
			return;
		}
		if (status !== session.GOODSTATUS) {
			return;
		}

		i = i + 1;
		doc = {
			"cohort": dataset.cohort,
			"body": body,
			"id": i
		};
		idx.add(doc);
		store[i] = {
			"name": dataset.name,
			"label": dataset.label,
			"cohort": dataset.cohort,
			"host": host
		};
	};

	source.subscribe(function (hostReturn) {
		hostReturn.forEach(function(s, i) {
			s.forEach(function (dataset) {
				addToIndex(hosts[i], dataset);
			});
		});
		idxObj.index = idx;
		idxObj.store = store;
	});
}

//the front page of dataPages
function frontPage (baseNode) {
	var indxObj = {},
		inputBox = document.createElement("INPUT"),
		searchButton = document.createElement("BUTTON"),
		resetButton = document.createElement("BUTTON"),
		container, sideNode, mainNode, searchNode, cohortNode;

	function doSearch(query) {
		var cohort, url,
			cohortList = [], datasetList = [],
			idx, store,
			timer;

		function displaySearchResult() {
			var results,
				array;

			results = idx.search(query);
			results.map(function (obj) {
				cohort = store[obj.ref].cohort;
				datasetList.push(store[obj.ref]);
				if (cohortList.indexOf(cohort) === -1) {
					cohortList.push(cohort);
				}
			});

		cohortNode.innerHTML = "";

		if (cohortList.length === 0) {
			cohortNode.appendChild(document.createTextNode("Your search - "));
			cohortNode.appendChild(domHelper.elt("I", query));
			cohortNode.appendChild(document.createTextNode(" - did not find any data."));
		}
		else {
			var text = "Found approx ",
				message,
				clearnArray;

			array = [(cohortList.length ? (cohortList.length.toLocaleString()  + " cohort" +  (cohortList.length > 1 ? "s" : "")) : ""),
				(datasetList.length ? (datasetList.length.toLocaleString() + " dataset" + (datasetList.length > 1 ? "s" : "")) : "")];

			clearnArray = array.filter(function (phrase) {
					return (phrase !== "");
				});

			var arrayText = clearnArray.slice(0, clearnArray.length - 1).join(', ');
			arrayText = (arrayText ? (arrayText + " and ") : "") + clearnArray[clearnArray.length - 1];
			text = text + arrayText;
				message = domHelper.elt("span", text);
				message.style.color = "gray";
			cohortNode.appendChild(message);
		}
		if (cohortList.length > 0) {
				cohortNode.appendChild(domHelper.elt("h2", array[0]));
				cohortList.forEach(function(cohort) {
					url = "?cohort=" + encodeURIComponent(cohort);
				cohortNode.appendChild(domHelper.hrefLink(cohort, url));
				cohortNode.appendChild(document.createElement("br"));
				});
		  }
		  if (datasetList.length > 0) {
			cohortNode.appendChild(domHelper.elt("h2", array[1]));
			datasetList.forEach(function(obj) {
				url = "?dataset=" + encodeURIComponent(obj.name) + "&host=" + encodeURIComponent(obj.host);
				cohortNode.appendChild(document.createTextNode(obj.cohort + " : "));
				cohortNode.appendChild(domHelper.hrefLink(obj.label, url));
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

		cohortNode.innerHTML = ""; //clear cohortList
		if (query === "") {  // all cohorts
			cohortListPage(userActiveHosts(), cohortNode);
			inputBox.disabled = false;
			searchButton.disabled = false;
			resetButton.disabled = false;
			return;
		}

		var spinner = domHelper.loadingCircle();
		cohortNode.appendChild(spinner);

		if (!indxObj.index) {
			buildIndex (indxObj, userActiveHosts());
		}

		timer = setInterval(function() {
			if (!indxObj.index) {
				return;
			}
			store = indxObj.store;
			idx = indxObj.index;
			displaySearchResult();
			clearInterval(timer);
		}, 50);
	}

	function searchUI(sectionNode) {
		var query;

		inputBox.setAttribute("class", "searchBox");
		inputBox.setAttribute("id", "dataPageQuery");
		sectionNode.appendChild(inputBox);

		searchButton.setAttribute("class", "vizbutton");
		searchButton.appendChild(document.createTextNode("Search Cohorts"));
		sectionNode.appendChild(searchButton);

		searchButton.addEventListener("click", function () {
			query = document.getElementById("dataPageQuery").value.trim();
			doSearch(query);
		});

		resetButton.setAttribute("class", "vizbutton");
		resetButton.appendChild(document.createTextNode("Reset"));
		sectionNode.appendChild(resetButton);

		resetButton.addEventListener("click", function () {
			document.getElementById("dataPageQuery").value = "";
			cohortNode.innerHTML = "";
			cohortListPage(userActiveHosts(), cohortNode);
		});
	}

	//overall container
	container = domHelper.elt("div");
	container.setAttribute("id", "content-container");

	//sidebar
	sideNode = hubSideBar(activeHosts);
	container.appendChild(sideNode);

	//main section cohort list page
	mainNode = domHelper.elt("div");
	mainNode.setAttribute("id", "dataPagesMain");

	//search node
	searchNode = domHelper.sectionNode("cohort");
	searchUI(searchNode);
	mainNode.appendChild(searchNode);

	cohortNode = domHelper.sectionNode("cohort");
	mainNode.appendChild(cohortNode);

	//cohort list
	cohortListPage(userActiveHosts(), cohortNode);
	container.appendChild(mainNode);

	//the end
	container.appendChild(domHelper.elt("br"));
	baseNode.appendChild(container);
}

function hostPage (baseNode, host) {
	//hub markdown
	var mdFile = host + "/download/meta/info.mdown",
		markdownNode = document.createElement("div");
	markdownNode.setAttribute("class", "hubinfo");
	baseNode.appendChild(markdownNode);
	renderMarkDownFile(mdFile, markdownNode);

	// hub basic info and hub configuration button
	var node = document.createElement("div"),
		hostLabel = session.getHubName(host),
		tmpNode = document.createElement("div");

	tmpNode.innerhtml = hostLabel + " (connecting)";
	node.setAttribute("class", "hubinfo");
	tmpNode.setAttribute("id", "status" + host);
	node.appendChild(domHelper.elt("h2", tmpNode, configHubButton() ));

	node.appendChild(document.createTextNode("Hub Address: " + host));
	session.updateHostStatus(host);

	// cohort list
	cohortListPage([host], node);
	baseNode.appendChild(node);
}

var initialized = false;
module.exports = (baseNode, state, callback, xQ) => {
	session.setCallback(callback);
	_.extend(xenaQuery, xQ);
	session.setState(state);

	allHosts = state;

	if (initialized) {
		return;
	}
	initialized = true;

	// Initially mark all hosts active. We will update them later.
	_.keys(allHosts).forEach(h => session.activeHosts.add(h));

	var container, sideNode, mainNode,
		keys = Object.keys(queryString),
		host = queryString.host,
		hub = queryString.hub,
		dataset = queryString.dataset && decodeURIComponent(queryString.dataset),
		cohort = queryString.cohort && decodeURIComponent(queryString.cohort),
		sample = queryString.sample && decodeURIComponent(queryString.sample),
		label = queryString.label && decodeURIComponent(queryString.label),
		nSamples = Number(queryString.nSamples),
		nProbes = Number(queryString.nProbes),
		allIdentifiers = queryString.allIdentifiers,
		allSamples = queryString.allSamples;


	// add host or hub if it is not in default lists
	if (host || hub) {
		host = hub ? hub : host;
		if (!_.has(allHosts, host)) {
			allHosts[host] = {'user': true};
			state = allHosts;
			session.setState(state);
			session.activeHosts.add(host);
		}
	}

	// ?host=id
	if ( keys.length === 1 && (host || hub) ) {
		host = hub ? hub : host;
		hostPage (baseNode, host);
	}

	// ?dataset=id & host=id
	else if (keys.length === 2 && host && dataset) {
		container = domHelper.elt("div");
		container.setAttribute("id", "content-container");

		sideNode = domHelper.elt("div");
		sideNode.setAttribute("id", "sidebar");
		container.appendChild(sideNode);

		//main section dataset detail page
		mainNode = domHelper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");
		container.appendChild(mainNode);

		baseNode.appendChild(container);

		xenaQuery.datasetMetadata(host, dataset).subscribe(
			function (s) {
				if (s.length) {
					//dataset sidebar
					datasetSideBar(s[0], sideNode);
					datasetPage(s[0], host, mainNode);
				}
			}
		);
	}

	// ?sample=id&cohort=id
	else if ( keys.length === 2 && cohort && sample) {
		ifCohortExistDo(cohort, activeHosts, undefined, function() {
			samplePage(baseNode, sample, cohort);
		});
	}

	// ?cohort=id
	else if ((keys.length === 1 && cohort) || (keys.length === 2 && cohort && (host || hub))) {
		container = domHelper.elt("div");
		container.setAttribute("id", "content-container");

		//sidebar
		sideNode = hubSideBar(activeHosts);
		container.appendChild(sideNode);

		//main section cohort list page
		mainNode = domHelper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");

		cohortPage(cohort, userActiveHosts(), mainNode);
		container.appendChild(mainNode);

		container.appendChild(domHelper.elt("br"));
		baseNode.appendChild(container);
	}

	// large data snippet
	else if (keys.length === 4 && host && dataset && nSamples && nProbes) {
		bigDataSnippetPage (host, dataset, nSamples, nProbes);
	}

	// all identifiers of a dataset
	else if (keys.length === 4 && host && dataset && label && allIdentifiers) {
		allIdentifiersPage (host, dataset, label);
	}

	// all samples of a dataset
	else if (keys.length === 4 && host && dataset && label && allSamples) {
		allSamplesPage (host, dataset, label);
	}

	// front page: cohort list
	else {
		frontPage(baseNode);
	}
};
