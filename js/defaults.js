'use strict';

var defaultLocal = "https://local.xena.ucsc.edu:7223",
	defaultUCSC = "https://ucscpublic.xenahubs.net:443",
	defaultTCGA = "https://tcga.xenahubs.net:443",
	defaultICGC = "https://icgc.xenahubs.net:443",
	defaultTOIL = "https://toil.xenahubs.net:443",
	defaultPCAWG = "https://pcawg.xenahubs.net:443",
	defaultSinglecell = "https://singlecell.xenahubs.net:443",
	defaultPancanAtlas = "https://pancanatlas.xenahubs.net:443",
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
