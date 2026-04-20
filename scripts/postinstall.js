const fs = require("fs");
const path = require("path");

const nodeModules = path.join(__dirname, "..", "node_modules");

/**
 * Patches CJS modules that break under OpenCode's strict ESM interop.
 * Each entry: [package path relative to node_modules, patch function]
 */
const patches = [
	{
		name: "fast-decode-uri-component",
		file: path.join(nodeModules, "fast-decode-uri-component", "index.js"),
		wrapper: path.join(nodeModules, "fast-decode-uri-component", "index.mjs"),
		pkg: path.join(nodeModules, "fast-decode-uri-component", "package.json"),
		check: (content, entry) =>
			content.includes("module.exports.default") &&
			fs.existsSync(entry.wrapper) &&
			fs
				.readFileSync(entry.wrapper, "utf8")
				.includes('import * as fastDecodeModule from "./index.js";'),
		apply: (_filePath, entry) => {
			const source = fs.readFileSync(entry.file, "utf8");
			if (!source.includes("module.exports.default"))
				fs.appendFileSync(entry.file, "\nmodule.exports.default = module.exports;\n");

			const wrapper = [
				'import * as fastDecodeModule from "./index.js";',
				"const fastDecode = fastDecodeModule.default ?? fastDecodeModule;",
				"export default fastDecode;",
				"",
			].join("\n");
			fs.writeFileSync(entry.wrapper, wrapper);

			const pkg = JSON.parse(fs.readFileSync(entry.pkg, "utf8"));
			pkg.exports = {
				".": {
					import: "./index.mjs",
					require: "./index.js",
				},
			};
			fs.writeFileSync(entry.pkg, JSON.stringify(pkg, null, 2) + "\n");
		},
	},
	{
		name: "cookie",
		file: path.join(nodeModules, "cookie", "dist", "index.js"),
		wrapper: path.join(nodeModules, "cookie", "dist", "index.mjs"),
		pkg: path.join(nodeModules, "cookie", "package.json"),
		check: (content, entry) =>
			content.includes("module.exports.default") &&
			fs.existsSync(entry.wrapper) &&
			fs
				.readFileSync(entry.wrapper, "utf8")
				.includes('import * as cookieModule from "./index.js";'),
		apply: (_filePath, entry) => {
			// 1. Patch index.js so default import works from the wrapper
			const source = fs.readFileSync(entry.file, "utf8");
			if (!source.includes("module.exports.default"))
				fs.appendFileSync(entry.file, "\nmodule.exports.default = module.exports;\n");

			// 2. Create ESM wrapper that re-exports named exports
			const wrapper = [
				'import * as cookieModule from "./index.js";',
				"const cookie = cookieModule.default ?? cookieModule;",
				"export const parse = cookie.parse ?? cookieModule.parse;",
				"export const parseCookie = cookie.parseCookie ?? cookieModule.parseCookie;",
				"export const serialize = cookie.serialize ?? cookieModule.serialize;",
				"export const stringifyCookie = cookie.stringifyCookie ?? cookieModule.stringifyCookie;",
				"export const stringifySetCookie = cookie.stringifySetCookie ?? cookieModule.stringifySetCookie;",
				"export const parseSetCookie = cookie.parseSetCookie ?? cookieModule.parseSetCookie;",
				"export default cookie;",
				"",
			].join("\n");
			fs.writeFileSync(entry.wrapper, wrapper);

			// 3. Add exports map so Bun resolves ESM imports to the wrapper
			const pkg = JSON.parse(fs.readFileSync(entry.pkg, "utf8"));
			pkg.exports = {
				".": {
					import: "./dist/index.mjs",
					require: "./dist/index.js",
				},
			};
			fs.writeFileSync(entry.pkg, JSON.stringify(pkg, null, 2) + "\n");
		},
	},
];

for (const entry of patches) {
	try {
		const content = fs.existsSync(entry.file) ? fs.readFileSync(entry.file, "utf8") : "";

		if (entry.check(content, entry)) {
			console.log(`[postinstall] ${entry.name} already patched`);
			continue;
		}

		entry.apply(entry.file, entry);
		console.log(`[postinstall] ${entry.name} patched (CJS/ESM interop)`);
	} catch (err) {
		console.warn(`[postinstall] Could not patch ${entry.name}: ${err.message}`);
	}
}
