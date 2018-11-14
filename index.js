const fetch = require('node-fetch');
const {URLSearchParams} = require("url");

/* Notes:
	Only allowed 'hex' values are: a-z0-9

	Hex: 'a'
	Wall: 3
	Shelf: 2
	Volume: 29
	Result: book.cgi?a-w3-s2-v29:1
	?{HEX}-w{WALL}-s{SHELF}-v{VOLUME}:{PAGE_NUMBER}
	
	Hex max value:
	Wall max value:
	Shelf max value:
	Volume max value:
	Page number max value: Multiple seem to be page 1 as first, and page 410 as last page

	The only allowed characters on a page seem to be:
	a-z,. and space
	max length: 3200 characters
*/

const TEXT_REGEX = /(?<=><PRE id = "textblock">\s)[\s\S]*(?=<\/PRE><\/div>\s)/;
function grabPageTextFromHTML (html) {
	let text = html.match(TEXT_REGEX);

	if (text === null) {
		console.log("Error: Could not get text from this html: '" + html + "'");
		return;
	}

	text = text[0];

	return text;
}

// grabPageTextFromHTML returns how it is stored, but it makes more sense for it to be a single line
function cleanUpPageText (text) {
	return text.replace(/[\n\r]/g, '');
}

/*
function generatePageUrl (hex, wall, shelf, volume, pageNumber=1) {
	return `https://libraryofbabel.info/book.cgi?${hex}-w${wall}-s${shelf}-v${volume}:${pageNumber}`;
}*/

function generateFormData (hex, wall, shelf, volume, pageNumber=1) {
	let params = new URLSearchParams();
	params.append('hex', hex);
	params.append('wall', wall);
	params.append('shelf', shelf);
	params.append('volume', volume);
	params.append('page', pageNumber);

	return params;
}

function getPageData (hex, wall, shelf, volume, pageNumber=1) {
	let data = generateFormData(hex, wall, shelf, volume, pageNumber);
	let url = 'https://libraryofbabel.info/book.cgi';

	console.log('getPageData(', hex, wall, shelf, volume, pageNumber, ') -', url);

	return fetch(url, {
		method: "POST",
		body: data
	})
		.then(response => response.text())
}

function getPageText (hex, wall, shelf, volume, pageNumber) {
	return getPageData(hex, wall, shelf, volume, pageNumber)
		.then(html => cleanUpPageText(grabPageTextFromHTML(html)));
}

// Note: on search.html there is this element: <INPUT type="hidden" name="method" value="x"> unsure as to what it is used for
// It might be some verification that they actually loaded the page so we'll include it as a param
async function search (text, autoSplit=true) {
	if (typeof(text) !== 'string') {
		throw new TypeError("Text was not string");
	}

	// We limit it to 3000chars max just to be ultra safe
	if (!autoSplit && text.length > 3000) {
		throw new Error("search text length was greater than 3000 characters (LoB limits to 3200, but just to be safe and have some leeway the code limits it to 3000), and autoSplit was false so this error was thrown.");
	}

	if (autoSplit) {
		// Split every 3000 characters
		text = text.match(/.{1,3000}/g);

		if (text === null) {
			text = [''];
		}
	} else {
		// Make it an array so the code will work on both
		text = [text];
	}

	let results = [];
	for (let i = 0; i < text.length; i++) {
		results.push(await _searchSingle(text[i]));
	}

	return results;
}

function generateSearchFormData (text, includeHidden=true) {
	let params = new URLSearchParams();

	params.append('find', text);

	if (includeHidden) {
		params.append('method', 'x');
	}

	return params;
}

const SEARCH_DATA_REGEX = /(?<=<h3>exact match:<\/h3><PRE class\s=\s"textsearch"\sstyle\s=\s"text-align\: left">Title: <b>.*?<\/b> Page: <b>.*?<\/b><br>Location: <a class\s=\s"intext"\sstyle\s=\s"cursor\:pointer"\stitle\s=\s""\sonclick\s=\s"postform\(("|')).*?(?=('|")\)">.*?<\/a><\/PRE>)/;
function _searchSingle (text) {
	let url = 'https://libraryofbabel.info/search.cgi';
	let params = generateSearchFormData(text);

	return fetch(url, {
		method: "POST",
		body: params
	})
		.then(response => response.text())
		.then(html => {
			let text = html.match(SEARCH_DATA_REGEX);

			if (text === null) {
				throw new Error("Couldn't grab exact match from search page! Raw html:\n" + html);
			}

			return text[0];
		})
		.then(text => {
			text = text.split("'");
			
			let hex = text[0];
			// text[1] = ','
			let wall = text[2];
			// text[3] = ','
			let shelf = text[4];
			// text[5] = ','
			let volume = text[6];
			// text[7] = ','
			let page = text[8];

			return {
				hex,
				wall,
				shelf,
				volume,
				page
			};
		});
}

module.exports = {
	grabPageTextFromHTML,
	cleanUpPageText,
	generateFormData,
	getPageData,
	getPageText,
	search,
	generateFormData,
	_searchSingle
};