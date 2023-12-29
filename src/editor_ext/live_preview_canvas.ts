import { editorLivePreviewField } from "obsidian";

import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	Decoration,
	DecorationSet,
} from "@codemirror/view";

import type { PluginValue } from "@codemirror/view";
import { findValutFile, isTFile } from "../vault_util";
import { MainPluginContext } from "../context";
import { PIE } from "../engines/imgEngines";
import { debug } from "loglevel";

/**
 * @deprecated
 * @param context
 * @returns
 */
export const livePreviewExtension = (context: MainPluginContext) =>
	ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (!update.state.field(editorLivePreviewField)) {
					this.decorations = Decoration.none;
					return;
				}

				if (
					update.docChanged ||
					update.viewportChanged ||
					// update.selectionSet ||
					// update.heightChanged ||
					update.geometryChanged
				) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			destroy(): void {}

			private buildDecorations(view: EditorView): DecorationSet {
				if (!view.state.field(editorLivePreviewField)) {
					return Decoration.none;
				}

				const supportedFormats =
					context.plugin.settingsUtil.getRuntimeSupportedFormats();

				const internalEmbeds =
					view.contentDOM.querySelectorAll(".internal-embed");

				for (let i = 0; i < internalEmbeds.length; i++) {
					const internalEmbed = internalEmbeds[i];
					if (!(internalEmbed instanceof HTMLElement)) {
						continue;
					}
					const src = internalEmbed.getAttribute("src");
					if (!src) {
						continue;
					}

					const srcFile = findValutFile(context, src, false);
					if (!srcFile) {
						continue;
					}
					if (!isTFile(srcFile, supportedFormats)) {
						continue;
					}

					const titleNode =
						internalEmbed.querySelector(".file-embed-title");
					let draw = true;
					let cv: HTMLCanvasElement | null =
						internalEmbed.querySelector("canvas.imgk-plugin-item");
					if (cv) {
						if (cv.hasAttribute("data-mod-date")) {
							try {
								const modDate = Number(
									cv.getAttribute("data-mod-date")
								);
								if (modDate >= srcFile.stat.mtime) {
									draw = false;
								}
							} catch (e) {}
						}
					} else {
						cv = internalEmbed.createEl("canvas", {
							cls: "imgk-plugin-item",
						});
					}

					if (!draw) {
						debug("pass redrawing");
						continue;
					}

					// internalEmbed.classList.add("media-embed");
					// internalEmbed.classList.add("image-embed");
					// internalEmbed.classList.remove("file-embed");
					// internalEmbed.classList.add("dnd-gutter-marker");
					// internalEmbed.setAttribute("draggable", "true");

					const posOfInternalEmbed = view.posAtDOM(internalEmbed);
					cv.setAttribute(
						"src",
						context.plugin.app.vault.getResourcePath(srcFile)
					);
					// cv.style.pointerEvents = "none";
					cv.setAttribute("alt", srcFile.path);
					cv.setAttribute("filesource", srcFile.path);
					cv.setAttribute("data-path", srcFile.path);

					cv.setAttribute("draggable", "true");
					cv.setAttribute(
						"data-mod-date",
						String(srcFile.stat.mtime)
					);

					if (titleNode && titleNode instanceof HTMLElement) {
						titleNode.style.height = "0px";
						titleNode.style.opacity = "0";
						titleNode.style.pointerEvents = "none";
					}

					// internalEmbed.style.pointerEvents = "none";
					cv.addEventListener("mousedown", (e) => {
						// console.log("mousedown");
						// const posAtDom = view.posAtDOM(internalEmbed);
						// view.dispatch({
						// 	// selection: EditorSelection.create([
						// 	// 	// EditorSelection.cursor(posAtDom),
						// 	// 	EditorSelection.range(2, 2),
						// 	// ]),
						// 	selection: { anchor: 2 },
						// });
						e.stopPropagation();
					});
					cv.addEventListener("dragstart", (e) => {
						e.dataTransfer?.setData("line", srcFile.path);
						e.dataTransfer?.setData("link", srcFile.path);
						e.dataTransfer?.setData(
							"text/plain",
							`![[${srcFile.path}]]`
						);
						e.dataTransfer?.setData("text/uri-list", srcFile.path);
					});
					// cv.classList.add("dnd-gutter-marker");

					//block origin event
					internalEmbed.onClickEvent(
						(e) => {
							// e.stopImmediatePropagation();
							e.stopPropagation();
							return false;
						},
						{
							capture: true,
							passive: false,
						}
					);

					// img.setAttribute(
					// 	"src",
					// 	context.plugin.app.vault.getResourcePath(srcFile)
					// );
					// img.setAttribute("alt", srcFile.path);
					// img.setAttribute(
					// 	"data-mod-date",
					// 	String(srcFile.stat.mtime)
					// );

					PIE.magick()
						.drawOnCanvas(context, srcFile, cv)
						.then(
							() => {
								// const ctx = canvasElement.getContext("2d");
								// ctx?.drawImage(img!, 0, 0);
								// img!.width = canvasElement.width;
								// img!.height = canvasElement.height;
								// canvasElement.toBlob((blob) => {
								// 	if (blob) {
								// 		const burl = URL.createObjectURL(blob);
								// 		img!.src = burl;
								// 	}
								// });
								// img!.src = canvasElement.toDataURL();
								// canvasElement.remove();
							},
							() => {}
						);
				}

				return Decoration.none;
			}
		},
		{
			decorations: (instance) => instance.decorations,
		}
	);
