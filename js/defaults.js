'use strict';

var defaultLocal = "https://local.xena.ucsc.edu:7223",
	defaultUCSC = "https://ucscpublic.xenahubs.net",
	defaultTCGA = "https://tcga.xenahubs.net",
	defaultICGC = "https://icgc.xenahubs.net",
	defaultTOIL = "https://toil.xenahubs.net",
	defaultPCAWG = "https://pcawg.xenahubs.net",
	defaultSinglecell = "https://singlecell.xenahubs.net",
	defaultPancanAtlas = "https://pancanatlas.xenahubs.net",
	defaultNames = {},

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

defaultNames[defaultLocal] = "My computer hub";
defaultNames[defaultUCSC] = "UCSC public hub";
defaultNames[defaultTCGA] = "TCGA hub";
defaultNames[defaultICGC] = "ICGC hub";
defaultNames[defaultTOIL] = "GA4GH (TOIL) hub";
defaultNames[defaultPCAWG] = "PCAWG public hub";
defaultNames[defaultSinglecell] = "Single-cell RNAseq hub";
defaultNames[defaultPancanAtlas] = "PancanAtlas hub";

module.exports = {
	defaultHosts,
	defaultState,
	defaultNames,
};
