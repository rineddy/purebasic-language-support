import {
	DocumentFormattingParams,
	DocumentOnTypeFormattingParams,
	DocumentRangeFormattingParams,
	FormattingOptions,
	Range,
	TextDocument,
	TextEdit,
} from 'vscode-languageserver';

import { pb } from './PureBasicAPI';

export class PureBasicFormatter {
	/**
	 * Format whole doc
	 */
	public formatAll(params: DocumentFormattingParams): TextEdit[] {
		let doc = pb.documents.find(params.textDocument.uri);
		return doc ? pb.formatter.applyFormattingRules(doc, params.options, Range.create(0, 0, doc.lineCount - 1, Number.MAX_SAFE_INTEGER)) : [];
	}
	/**
	 * Format doc when user is selecting text
	 */
	public formatRange(params: DocumentRangeFormattingParams): TextEdit[] {
		let doc = pb.documents.find(params.textDocument.uri);
		return doc ? pb.formatter.applyFormattingRules(doc, params.options, Range.create(params.range.start.line, 0, params.range.end.line, params.range.end.character)) : [];
	}
	/**
	 * Format doc when user is typing
	 */
	public formatOnType(params: DocumentOnTypeFormattingParams): TextEdit[] {
		let doc = pb.documents.find(params.textDocument.uri);
		return doc ? pb.formatter.applyFormattingRules(doc, params.options, Range.create(params.position.line, 0, params.position.line, params.position.character)) : [];
	}
	/**
	 * Apply formatting rules, line by line, on selected text
	 */
	private applyFormattingRules(doc: TextDocument, options: FormattingOptions, selection: Range): TextEdit[] {
		let textEdits: TextEdit[] = [];
		let textIndents: TextIndents = { current: 0, next: 0 };
		for (let line = selection.start.line - 1; line >= 0; line--) {
			let rg: Range = Range.create(line, 0, line, Number.MAX_SAFE_INTEGER);
			let text = doc.getText(rg);
			let { spaces, words, parts } = pb.text.parse(text);
			if (parts.length > 0) {
				textIndents = pb.indentator.next(textIndents, words, spaces);
				break;
			}
		}
		for (let line = selection.start.line; line <= selection.end.line; line++) {
			let rg: Range = Range.create(line, 0, line, line < selection.end.line ? Number.MAX_SAFE_INTEGER : selection.end.character);
			let text = doc.getText(rg);
			let { spaces, words, parts } = pb.text.parse(text);
			textIndents = pb.indentator.next(textIndents, words, spaces);
			parts.forEach((part, index, parts) => {
				if (!part.match(pb.text.STARTS_WITH_STRING_OR_COMMENT)) {
					let charBeforePart = (index > 0) ? parts[index - 1].substr(-1) : '';
					let charAfterPart = (index < parts.length - 1) ? parts[index + 1].substr(0, 1) : '';
					part = pb.text.addExtensions(part, charBeforePart, charAfterPart);
					part = part.replace(/\s+/g, ' ');
					part = part.replace(/\s+(,)/g, '$1');
					part = part.replace(/(,)(?=\S)/g, '$1 ');
					part = part.replace(/\s+(\.|\\)/g, '$1');
					part = part.replace(/(\.|\\)\s+/g, '$1');
					part = part.replace(/\s+(::)/g, '$1');
					part = part.replace(/(::)\s+/g, '$1');
					part = part.replace(/\s+([})\]])/g, '$1');
					part = part.replace(/([{([])\s+/g, '$1');
					part = part.replace(/([^\s><=])(?=<>|<=|>=|=>|>=|=|<|>)/g, '$1 ');
					part = part.replace(/(<>|<=|>=|=>|>=|=|<|>)(?=[^\s><=])/g, '$1 ');
					part = part.replace(/(\S)(?=\/|<<|>>|\+)/g, '$1 ');
					part = part.replace(/(\/|<<|>>|\+)(?=\S)/g, '$1 ');
					part = part.replace(/([^\s:])(?=:[^:])/g, '$1 ');
					part = part.replace(/([^:]:)(?=[^\s:])/g, '$1 ');
					parts[index] = pb.text.removeExtensions(part, charBeforePart, charAfterPart);
				}
			});
			let formattedText = textIndents.current + parts.join('');
			formattedText = formattedText.trimRight();
			if (formattedText !== text) {
				textEdits.push(TextEdit.replace(rg, formattedText));
			}
		}
		return textEdits;
	}
}