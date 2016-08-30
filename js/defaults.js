'use strict';

var defaultLocal = "https://local.xena.ucsc.edu:7223",
	//defaultUCSC = "https://genome-cancer.ucsc.edu:443/proj/public/xena",
	defaultUCSC = "https://ucscpublic.xenahubs.net",
	defaultTCGA = "https://tcga.xenahubs.net",
	defaultICGC = "https://icgc.xenahubs.net",
	defaultTOIL = "https://toil.xenahubs.net",
	defaultPCAWG = "https://pcawg.xenahubs.net",

	defaultAllHubs = [
		defaultLocal,
		defaultUCSC,
		defaultTCGA,
		defaultICGC,
		defaultTOIL,
	],

	defaultHosts = [
		defaultLocal,
		defaultTCGA,
		defaultUCSC,
		defaultICGC,
		defaultTOIL,
	],
	defaultState = {
		activeHosts: defaultHosts,
		allHosts: defaultAllHubs,
		userHosts: defaultHosts,
		localHost: defaultLocal,
		metadataFilterHosts: defaultHosts
	};

module.exports = {
	defaultHosts,
	defaultState,
	defaultLocal,
	defaultUCSC,
	defaultTCGA,
	defaultICGC,
	defaultTOIL,
	defaultPCAWG
};
