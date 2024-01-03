import { cloneDeep, size } from "lodash-es";
import { ExportFormat } from "../export_settings";
import { satisfies } from "compare-versions";
import { TAbstractFile, TFile, apiVersion } from "obsidian";
import { WARN_LIST_1_5_3, WARN_LIST_OLD } from "./obsidian_formats";
import {
	ImgkRuntimeExportSettings,
	convertAllExportSettingsToRuntime,
} from "./settings_as_func";
import { isTFile } from "../vault_util";

export enum ImgkSizeAdjustType {
	Fixed = 0,
	Scale = 1,
	Minimum = 2,
	Maximum = 3,
}

export enum ImgkFileFilterType {
	Includes = 0,
	Excludes = 1,
	RegexMatch = 2,
	RegexNonMatch = 3,
	DoubleExtsBlocker = 4,
}

export interface ImgkFileFilter {
	active: boolean;
	type: ImgkFileFilterType;
}

export interface ImgkTextFilter extends ImgkFileFilter {
	content: string;
	flags: string;
	isReversed: boolean;
}

export type ImgkSize = { x: number; y: number };

export interface ImgkExportPath {
	sourceDir: string;
	recursiveSources: boolean;
	sourceExts: string[];
	sourceFilters: ImgkTextFilter[];
	useBuiltInSourceFilters: boolean;
	builtInSourceFilters: ImgkFileFilter[];
	asRelativePath: boolean;
	exportDirAbs: string;
	exportDirRel: string;
	useCustomFileNameFormat: boolean;
	fileNameFormatPrefix: string;
	fileNameFormatSuffix: string;
	customFileNameFormat: string;
}

export interface ImgkImageSize {
	x?: number;
	y?: number;
	type: ImgkSizeAdjustType;
}

export interface ImgkExportImageProps {
	quality: number;
	sizeAdjustments: ImgkImageSize[];
}

export interface ImgkExportSettings {
	active: boolean;
	name: string;
	format: ExportFormat;
	imgProps: ImgkExportImageProps;
	pathOpts: ImgkExportPath;
}

export const DEFAULT_EXPORT_SUPPORTED_FORMATS = [
	"psd",
	"xcf",
	"tif",
	"tiff",
	"dcm",
	"dds",
	"hdr",
	"heic",
	"mng",
	"pbm",
	"pcx",
	"pfm",
	"pgm",
	"pnm",
	"ppm",
	"sgi",
	"xbm",
	"avif",
	"jpg",
	"png",
	"bmp",
	"webp",
	"gif",
	// "tga", -> decode error
	// "svg", -> no inkscape commnand
];

export const getDefaultSupportedFormats = () => {
	return [
		"psd",
		"xcf",
		"tif",
		"tiff",
		"dcm",
		"dds",
		"hdr",
		"heic",
		"mng",
		"pbm",
		"pcx",
		"pfm",
		"pgm",
		"pnm",
		"ppm",
		"sgi",
		"xbm",
		// supported in obsidian 1.5.3
		// "avif",
		// "jpg",
		// "png",
		// "webp",

		// image magick does not support
		// "tga", -> decode error
		// "svg", -> no inkscape commnand
	];
};

export const DEFAULT_FILE_NAME_PREFIX = "";
export const DEFAULT_FILE_NAME_SUFFIX = "export";

export const buildFileNameFormat = (prefix: string, suffix: string) => {
	return (
		(prefix ? `${prefix}.` : "") +
		"${name}.${ext}" +
		(suffix ? `.${suffix}` : "") +
		".${dst_ext}"
	);
};

export const DEFAULT_FILE_NAME_FORMAT = buildFileNameFormat(
	DEFAULT_FILE_NAME_PREFIX,
	DEFAULT_FILE_NAME_SUFFIX
);

export const DEFAULT_EXPORT_SETTINGS: ImgkExportSettings = {
	name: "",
	active: false,
	format: {
		ext: "png",
		mimeType: "image/png",
		display: "png",
	},
	imgProps: {
		quality: 1,
		sizeAdjustments: [],
	},
	pathOpts: {
		sourceDir: "",
		recursiveSources: false,
		useBuiltInSourceFilters: true,
		builtInSourceFilters: [
			{ active: true, type: ImgkFileFilterType.DoubleExtsBlocker },
		],
		sourceExts: [],
		sourceFilters: [],
		asRelativePath: false,
		exportDirAbs: "Exported Images",
		exportDirRel: "",
		useCustomFileNameFormat: false,
		fileNameFormatPrefix: DEFAULT_FILE_NAME_PREFIX,
		fileNameFormatSuffix: DEFAULT_FILE_NAME_SUFFIX,
		customFileNameFormat: DEFAULT_FILE_NAME_FORMAT,
	},
};

// Remember to rename these classes and interfaces!
export interface ImgkPluginSettings {
	supportedFormats: string[];
	exportMenuSupportedFormats: string[];

	autoExportList: ImgkExportSettings[];
	instantExport: ImgkExportSettings;

	renderMarkdownInlineLink: boolean;
	renderMarkdownImgTag: boolean;
	overrideDragAndDrop: boolean;
	useBlob: boolean;

	excalidrawStretchEmbed: boolean;

	trackRename: boolean;
	trackDelete: boolean;

	/**
	 * Base features
	 */
	previewLink: boolean;
	/** support obsidian's markdown based imgage size format. e.g., [[IMAGE | IMAGE_SIZE]]*/
	supportMdImageSizeFormat: boolean;
}

export const getWarnList = () => {
	if (satisfies(apiVersion, ">=1.5.3")) {
		return WARN_LIST_1_5_3;
	}

	return WARN_LIST_OLD;
};

export const DEFAULT_SETTINGS: ImgkPluginSettings = {
	supportedFormats: getDefaultSupportedFormats(),

	exportMenuSupportedFormats: cloneDeep(DEFAULT_EXPORT_SUPPORTED_FORMATS),
	autoExportList: [],
	instantExport: cloneDeep(DEFAULT_EXPORT_SETTINGS),

	renderMarkdownInlineLink: true,
	renderMarkdownImgTag: true,
	overrideDragAndDrop: true,
	useBlob: true,

	excalidrawStretchEmbed: true,

	previewLink: true,
	supportMdImageSizeFormat: true,

	trackRename: true,
	trackDelete: true,
};

export class SettingsUtil {
	private settings: ImgkPluginSettings;
	private runtimeSupportedSettings: Set<string> = new Set();
	private runtimeAutoExports: ImgkRuntimeExportSettings[] = [];
	private runtimeExportSupportedFormats: Set<string> = new Set();

	constructor(settings: ImgkPluginSettings) {
		this.settings = settings;
		this.generateRuntimeAutoExports();
		this.generateRuntimeExportSupportedFormats();
	}

	getIntantExport = (): ImgkExportSettings => {
		return this.settings.instantExport;
	};

	setRuntimeSupportedFormats(formats: Set<string>) {
		this.runtimeSupportedSettings = new Set(formats);
	}

	getRuntimeSupportedFormats = () => {
		return this.runtimeSupportedSettings;
	};

	getSupportedFormats = () => {
		return this.settings.supportedFormats;
	};

	getSettingsClone = (): ImgkPluginSettings => {
		return cloneDeep(this.settings);
	};
	getSettingsRef = (): ImgkPluginSettings => {
		return this.settings;
	};

	getClone = () => {
		const cloned = new SettingsUtil(this.getSettingsClone());
		cloned.setRuntimeSupportedFormats(
			new Set(this.runtimeSupportedSettings)
		);

		return cloned;
	};

	generateRuntimeExportSupportedFormats = () => {
		this.runtimeExportSupportedFormats = new Set([
			...this.settings.exportMenuSupportedFormats,
			...this.settings.exportMenuSupportedFormats.map((value) =>
				value.toUpperCase()
			),
		]);
	};

	isExportSupportedFormat = (ext?: string): boolean => {
		if (!ext) {
			return false;
		}
		return this.runtimeExportSupportedFormats.has(ext.toLowerCase());
	};

	generateRuntimeAutoExports = () => {
		this.runtimeAutoExports.splice(0, this.runtimeAutoExports.length);
		this.runtimeAutoExports = convertAllExportSettingsToRuntime(
			this.settings
		);
	};

	findRuntimeAutoExports = (file: TAbstractFile) => {
		if (!isTFile(file)) {
			return [];
		}

		const tflie = file as TFile;

		const result: ImgkRuntimeExportSettings[] = [];
		for (const runtimeExport of this.runtimeAutoExports) {
			if (runtimeExport.exportSourceFilterFunc(tflie)) {
				result.push(runtimeExport);
			}
		}
		return result;
	};

	getRuntimeAutoExports = () => {
		return this.runtimeAutoExports;
	};
}
