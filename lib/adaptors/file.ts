import { App, Component, MarkdownRenderer, Notice, TFile } from "obsidian";
import ADFBuilder from "lib/builder/adf";
import { AdfElement, PanelType } from "lib/builder/types";
import ConfluenceClient from "lib/confluence/client";
import PropertiesAdaptor from "./properties";
import ParagraphDirector from "lib/directors/paragraph";
import { ConfluenceLinkSettings } from "lib/confluence/types";
import TableDirector from "lib/directors/table";
import { MardownLgToConfluenceLgMap } from "lib/utils";
import { find } from "lodash";
import ListDirector from "lib/directors/list";
import LabelDirector from "lib/directors/label";

const CALLOUT_TO_PANEL_MAP: Record<string, PanelType> = {
	info: "info",
	tip: "success",
	success: "success",
	check: "success",
	done: "success",
	question: "info",
	help: "info",
	faq: "info",
	warning: "warning",
	caution: "warning",
	attention: "warning",
	danger: "error",
	error: "error",
	failure: "error",
	fail: "error",
	missing: "error",
	bug: "error",
	example: "info",
	quote: "info",
	cite: "info",
	note: "note",
	abstract: "note",
	summary: "note",
	tldr: "note",
	todo: "note",
	important: "warning",
};

export default class FileAdaptor {
	constructor(
		private readonly app: App,
		private readonly client: ConfluenceClient,
		private readonly spaceId: string,
		private readonly settings: ConfluenceLinkSettings
	) {}

	async convertObs2Adf(
		text: string,
		path: string,
		propertiesAdaptor: PropertiesAdaptor
	): Promise<AdfElement[]> {
		const container = document.createElement("div");

		MarkdownRenderer.render(
			this.app,
			text,
			container,
			path,
			new Component()
		);
		const adf = await this.htmlToAdf(container, path, propertiesAdaptor);
		return adf;
	}

	async htmlToAdf(
		container: HTMLElement,
		filePath: string,
		propertiesAdaptor: PropertiesAdaptor
	): Promise<AdfElement[]> {
		const builder = new ADFBuilder();
		const labelDirector = new LabelDirector(this.client, propertiesAdaptor);

		for (const node of Array.from(container.childNodes)) {
			await this.traverse(
				node as HTMLElement,
				builder,
				filePath,
				labelDirector
			);
		}

		if (this.settings.uploadTags && labelDirector.allTags.length > 0) {
			await labelDirector.updateConfluencePage();
		}

		return builder.build();
	}

	async getConfluenceLink(path: string): Promise<string> {
		const file = this.app.metadataCache.getFirstLinkpathDest(path, ".");

		if (!(file instanceof TFile)) {
			return "#";
		}
		const fileData = await this.app.vault.read(file);
		const propAdaptor = new PropertiesAdaptor().loadProperties(fileData);
		let { confluenceUrl } = propAdaptor.properties;

		if (confluenceUrl) {
			return confluenceUrl as string;
		}

		const response = await this.client.page.createPage({
			spaceId: this.spaceId,
			pageTitle: file.basename,
		});
		confluenceUrl = response._links.base + response._links.webui;

		propAdaptor.addProperties({
			pageId: response.id,
			spaceId: response.spaceId,
			confluenceUrl,
		});
		await this.app.vault.modify(file, propAdaptor.toFile(fileData));

		const adf = await this.convertObs2Adf(fileData, path, propAdaptor);

		await this.client.page.updatePage({
			pageId: propAdaptor.properties.pageId as string,
			pageTitle: file.basename,
			adf,
		});

		new Notice(`Page Created: ${file.basename}`);
		return confluenceUrl as string;
	}

	private detectCalloutType(node: HTMLElement): PanelType | null {
		// Obsidian renders callouts as <div class="callout" data-callout="warning">
		const calloutEl = node.querySelector(".callout") as HTMLElement;
		if (calloutEl) {
			const calloutType = calloutEl.getAttribute("data-callout")?.toLowerCase();
			if (calloutType) {
				return CALLOUT_TO_PANEL_MAP[calloutType] || "info";
			}
		}

		// Fallback: check if blockquote text starts with [!type]
		const text = node.textContent || "";
		const match = text.match(/^\[!([\w-]+)\]/);
		if (match) {
			const calloutType = match[1].toLowerCase();
			return CALLOUT_TO_PANEL_MAP[calloutType] || "info";
		}

		return null;
	}

	private async buildBlockquoteContent(
		node: HTMLElement,
		filePath: string,
		labelDirector: LabelDirector
	): Promise<AdfElement[]> {
		const contentBuilder = new ADFBuilder();

		for (const child of Array.from(node.childNodes)) {
			const el = child as HTMLElement;

			if (!el.nodeName) continue;

			// Obsidian callout structure: blockquote > .callout > .callout-title + .callout-content
			if (el.classList?.contains("callout")) {
				// Process callout-content children
				const calloutContent = el.querySelector(".callout-content");
				if (calloutContent) {
					for (const contentChild of Array.from(calloutContent.childNodes)) {
						await this.traverse(
							contentChild as HTMLElement,
							contentBuilder,
							filePath,
							labelDirector
						);
					}
				}
				// Also add the callout title as bold text
				const calloutTitle = el.querySelector(".callout-title-inner");
				if (calloutTitle && calloutTitle.textContent) {
					const titleParagraph = contentBuilder.paragraphItem();
					titleParagraph.content = [
						contentBuilder.strongItem(calloutTitle.textContent),
					];
					// Prepend title before content
					const built = contentBuilder.build();
					contentBuilder.clear();
					contentBuilder.addItem(titleParagraph);
					for (const item of built) {
						contentBuilder.addItem(item);
					}
				}
				continue;
			}

			// Regular blockquote child nodes
			await this.traverse(el, contentBuilder, filePath, labelDirector);
		}

		const result = contentBuilder.build();
		// Ensure at least one paragraph (ADF panel requires content)
		if (result.length === 0) {
			return [contentBuilder.paragraphItem(node.textContent || "")];
		}
		return result;
	}

	async traverse(
		node: HTMLElement,
		builder: ADFBuilder,
		filePath: string,
		labelDirector: LabelDirector
	) {
		switch (node.nodeName) {
			case "H1":
			case "H2":
			case "H3":
			case "H4":
			case "H5":
			case "H6":
				builder.addItem(
					builder.headingItem(
						Number(node.nodeName[1]),
						node.textContent!
					)
				);
				break;
			case "TABLE":
				const tableRows = Array.from(node.querySelectorAll("tr"));
				const tableContent = await Promise.all(
					tableRows.map(async (row) => {
						const cells = await Promise.all(
							Array.from(row.querySelectorAll("td, th")).map(
								async (cell) => {
									const cellAdf = new ADFBuilder();
									const director = new TableDirector(
										cellAdf,
										this,
										this.app,
										this.client,
										this.settings,
										labelDirector
									);

									await director.addItems(
										cell as HTMLTableCellElement,
										filePath
									);

									return cellAdf.build();
								}
							)
						);
						return builder.tableRowItem(cells);
					})
				);
				builder.addItem(builder.tableItem(tableContent));
				break;
			case "PRE":
				const codeElement = node.querySelector("code");

				// skip if pre is for file properties or no code element
				if (node.classList.contains("frontmatter") || !codeElement) {
					break;
				}

				if (codeElement.classList.contains("language-mermaid")) {
					const mermaidText = codeElement.textContent || "";
					builder.addItem(
						builder.codeBlockItem(mermaidText, "mermaid")
					);
					break;
				}

				const codeText = codeElement.textContent || "";
				const codeLg = find(
					Array.from(codeElement.classList.values()),
					(cls: string) => {
						return cls.startsWith("language-");
					}
				);
				const confluenceLg = codeLg
					? MardownLgToConfluenceLgMap[
							codeLg.replace("language-", "")
					  ]
					: "";

				builder.addItem(builder.codeBlockItem(codeText, confluenceLg));

				break;
			case "P":
				const paragraphDirector = new ParagraphDirector(
					builder,
					this,
					this.app,
					this.client,
					this.settings,
					labelDirector
				);
				await paragraphDirector.addItems(
					node as HTMLParagraphElement,
					filePath
				);

				break;
			case "OL":
			case "UL":
				const listDirector = new ListDirector(
					builder,
					this,
					this.app,
					this.client,
					this.settings,
					labelDirector
				);

				await listDirector.addList(
					node as HTMLUListElement | HTMLOListElement,
					filePath
				);

				break;
			case "BLOCKQUOTE":
				const panelType = this.detectCalloutType(node);

				if (panelType) {
					// Obsidian callout → Confluence panel
					const panelContent = await this.buildBlockquoteContent(
						node, filePath, labelDirector
					);
					builder.addItem(
						builder.panelItem(panelType, panelContent)
					);
				} else {
					// Regular blockquote - process children for rich content
					const bqContent = await this.buildBlockquoteContent(
						node, filePath, labelDirector
					);
					builder.addItem(
						builder.blockquoteItemWithContent(bqContent)
					);
				}
				break;
			case "DIV":
				// Obsidian sometimes wraps callouts in a div
				if (node.classList?.contains("callout") ||
					node.querySelector(".callout")) {
					for (const child of Array.from(node.childNodes)) {
						await this.traverse(
							child as HTMLElement,
							builder,
							filePath,
							labelDirector
						);
					}
				}
				break;
			case "HR":
				builder.addItem(builder.horizontalRuleItem());
				break;
		}
	}
}
