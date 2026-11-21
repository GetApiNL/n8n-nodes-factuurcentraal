import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { camel, isExtraField } from './definitions';
import type { Field, Operation } from './definitions';
import { apiRequest, toBuffer } from './transport';
import type { MultipartFile } from './transport';

const PAGE_SIZE = 100;

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

function convertValue(
	context: IExecuteFunctions,
	field: Field,
	raw: unknown,
	itemIndex: number,
): unknown {
	if (isEmpty(raw)) return undefined;

	switch (field.kind) {
		case 'number':
			return Number(raw);
		case 'date':
			// The API wants a plain date, the date picker gives a date and time.
			return String(raw).slice(0, 10);
		case 'json': {
			if (typeof raw !== 'string') return raw;
			try {
				return JSON.parse(raw);
			} catch {
				throw new NodeOperationError(
					context.getNode(),
					`${field.displayName} must be valid JSON`,
					{ itemIndex },
				);
			}
		}
		case 'lines': {
			const lines = ((raw as IDataObject).line ?? []) as IDataObject[];
			if (lines.length === 0) return undefined;
			return lines.map((line) => {
				const converted: IDataObject = {};
				for (const sub of field.lines ?? []) {
					const value = convertValue(context, sub, line[camel(sub.name)], itemIndex);
					if (value !== undefined) converted[sub.name] = value as IDataObject[string];
				}
				return converted;
			});
		}
		default:
			return raw;
	}
}

/** Reads all fields of an operation from the node parameters, keyed by their API name. */
function collectValues(
	context: IExecuteFunctions,
	operation: Operation,
	itemIndex: number,
): IDataObject {
	const fields = operation.fields ?? [];
	const extra = fields.some(isExtraField)
		? (context.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject)
		: {};

	const values: IDataObject = {};
	for (const field of fields) {
		const key = camel(field.name);
		const raw = isExtraField(field)
			? extra[key]
			: context.getNodeParameter(key, itemIndex, field.kind === 'lines' ? {} : '');
		const value = convertValue(context, field, raw, itemIndex);
		if (value !== undefined) values[field.name] = value as IDataObject[string];
	}
	return values;
}

function resolvePath(
	context: IExecuteFunctions,
	operation: Operation,
	itemIndex: number,
): { path: string; ids: IDataObject } {
	const ids: IDataObject = {};
	let path = operation.path;
	for (const param of operation.pathParams ?? []) {
		const value = context.getNodeParameter(param.name, itemIndex) as string | number;
		ids[param.name] = value;
		path = path.replace(`{${param.placeholder}}`, encodeURIComponent(String(value)));
	}
	return { path, ids };
}

/** Booleans in a query string must be 1 or 0, the API validates them as Laravel booleans. */
function toQuery(values: IDataObject): IDataObject {
	const query: IDataObject = {};
	for (const [key, value] of Object.entries(values)) {
		query[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
	}
	return query;
}

function toItems(body: unknown, operation: Operation, itemIndex: number): INodeExecutionData[] {
	const paired = { item: itemIndex };
	const list = Array.isArray(body)
		? body
		: operation.resultKey && body && typeof body === 'object'
			? (body as IDataObject)[operation.resultKey]
			: undefined;

	if (Array.isArray(list)) {
		return list.map((json) => ({ json: json as IDataObject, pairedItem: paired }));
	}
	return [{ json: (body && typeof body === 'object' ? body : { data: body }) as IDataObject, pairedItem: paired }];
}

async function getPaginated(
	context: IExecuteFunctions,
	path: string,
	filters: IDataObject,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (context.getNodeParameter('limit', itemIndex, 50) as number);
	const perPage = returnAll ? PAGE_SIZE : Math.min(limit, PAGE_SIZE);

	const results: IDataObject[] = [];
	for (let page = 1; ; page++) {
		const { body } = await apiRequest.call(
			context,
			{ method: 'GET', path, qs: { ...toQuery(filters), per_page: perPage, page } },
			itemIndex,
		);
		const response = body as IDataObject;
		const data = Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
		results.push(...data);

		const lastPage = Number(response.last_page ?? page);
		if (results.length >= limit || data.length === 0 || page >= lastPage) break;
	}

	return results
		.slice(0, limit)
		.map((json) => ({ json, pairedItem: { item: itemIndex } }));
}

function fileNameFromHeaders(headers: IDataObject, fallback: string): string {
	const disposition = String(headers['content-disposition'] ?? '');
	const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
	if (!match) return fallback;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

async function downloadFile(
	context: IExecuteFunctions,
	operation: Operation,
	path: string,
	ids: IDataObject,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const { headers, body } = await apiRequest.call(
		context,
		{ method: 'GET', path, binary: true },
		itemIndex,
	);

	const buffer = toBuffer(body);
	const isPdf = operation.special === 'pdf';
	const fallbackName = isPdf
		? `invoice-${ids.invoiceId}.pdf`
		: `receipt-${ids.receiptId}-attachment-${ids.attachmentId}`;
	const fileName = fileNameFromHeaders(headers, fallbackName);
	const mimeType = isPdf
		? 'application/pdf'
		: String(headers['content-type'] ?? 'application/octet-stream').split(';')[0];

	const binary = await context.helpers.prepareBinaryData(buffer, fileName, mimeType);
	return [
		{
			json: { ...ids, fileName, mimeType, fileSize: buffer.length },
			binary: { [binaryPropertyName]: binary },
			pairedItem: { item: itemIndex },
		},
	];
}

async function uploadAttachments(
	context: IExecuteFunctions,
	path: string,
	itemIndex: number,
	operation: Operation,
): Promise<INodeExecutionData[]> {
	const names = (context.getNodeParameter('binaryPropertyName', itemIndex) as string)
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);
	if (names.length === 0) {
		throw new NodeOperationError(context.getNode(), 'Enter the name of at least one binary field', {
			itemIndex,
		});
	}

	const files: MultipartFile[] = [];
	for (const name of names) {
		const binary = context.helpers.assertBinaryData(itemIndex, name);
		files.push({
			field: 'attachments[]',
			filename: binary.fileName ?? name,
			mimeType: binary.mimeType,
			data: await context.helpers.getBinaryDataBuffer(itemIndex, name),
		});
	}

	const { body } = await apiRequest.call(
		context,
		{ method: operation.method, path, multipart: files },
		itemIndex,
	);
	return toItems(body, operation, itemIndex);
}

export async function runOperation(
	this: IExecuteFunctions,
	operation: Operation,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const { path, ids } = resolvePath(this, operation, itemIndex);

	if (operation.special === 'pdf' || operation.special === 'downloadAttachment') {
		return downloadFile(this, operation, path, ids, itemIndex);
	}
	if (operation.special === 'uploadAttachments') {
		return uploadAttachments(this, path, itemIndex, operation);
	}

	const values = collectValues(this, operation, itemIndex);

	if (operation.paginated) {
		return getPaginated(this, path, values, itemIndex);
	}

	const sendsQuery = operation.method === 'GET' || operation.method === 'DELETE';
	const { body } = await apiRequest.call(
		this,
		{
			method: operation.method,
			path,
			qs: sendsQuery ? toQuery(values) : undefined,
			body: !sendsQuery && Object.keys(values).length > 0 ? values : undefined,
		},
		itemIndex,
	);
	return toItems(body, operation, itemIndex);
}
