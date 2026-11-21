import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const BASE_URL = 'https://www.factuurcentraal.nl/api/v1';

// Keep in sync with the version in package.json.
export const CLIENT = 'n8n-nodes-factuurcentraal/0.1.0';

export interface MultipartFile {
	field: string;
	filename: string;
	mimeType: string;
	data: Buffer;
}

export interface ApiRequest {
	method: IHttpRequestMethods;
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
	/** Expect a file in the response instead of JSON. */
	binary?: boolean;
	multipart?: MultipartFile[];
}

export interface ApiResponse {
	status: number;
	headers: IDataObject;
	body: unknown;
}

const ERROR_MESSAGES: Record<number, { message: string; description: string }> = {
	401: {
		message: 'Invalid or expired token',
		description: 'Check the API token in your Factuur Centraal credentials.',
	},
	403: {
		message: 'Access denied',
		description:
			'Your token is not allowed to do this. It can also mean that your company requires two-step verification (mfa_setup_required), or that the endpoint needs Pro or the owner.',
	},
	404: {
		message: 'Not found',
		description: 'The record does not exist, or belongs to another company. Check the ID and the company of your credentials.',
	},
	422: {
		message: 'Validation failed',
		description: 'Factuur Centraal rejected the input.',
	},
	429: {
		message: 'Rate limit reached',
		description:
			'Too many requests. The limit is 60 requests per minute per user, and lower for sending, PDFs and uploads. Slow down or retry later.',
	},
};

export function toBuffer(body: unknown): Buffer {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	return Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? ''));
}

/** Turns whatever n8n returns (parsed object, string or buffer) into a JSON value. */
export function parseBody(body: unknown): unknown {
	let text: string;
	if (Buffer.isBuffer(body) || body instanceof ArrayBuffer) {
		text = toBuffer(body).toString('utf8');
	} else if (typeof body === 'string') {
		text = body;
	} else {
		return body ?? {};
	}
	if (text.trim() === '') return {};
	try {
		return JSON.parse(text);
	} catch {
		return { message: text.slice(0, 500) };
	}
}

/** Flattens the Laravel style `errors` object of a 422 response into readable lines. */
function validationMessages(body: IDataObject): string | undefined {
	const errors = body.errors;
	if (!errors || typeof errors !== 'object') return undefined;
	const lines = Object.entries(errors as IDataObject).map(([field, messages]) => {
		const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
		return `${field}: ${text}`;
	});
	return lines.length > 0 ? lines.join('\n') : undefined;
}

function toApiError(
	context: IExecuteFunctions,
	status: number,
	rawBody: unknown,
	itemIndex: number,
): NodeApiError {
	const parsed = parseBody(rawBody);
	const body: IDataObject =
		parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as IDataObject)
			: { message: String(parsed) };

	const known = ERROR_MESSAGES[status];
	const apiMessage = typeof body.message === 'string' ? body.message : undefined;
	const details = status === 422 ? validationMessages(body) : undefined;

	return new NodeApiError(context.getNode(), body as JsonObject, {
		message: known?.message ?? `Factuur Centraal returned HTTP ${status}`,
		description: [apiMessage, details].filter(Boolean).join('\n') || known?.description,
		httpCode: String(status),
		itemIndex,
	});
}

export function buildMultipart(files: MultipartFile[]): { body: Buffer; contentType: string } {
	const boundary = `----n8nFactuurCentraal${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const clean = (value: string) => value.replace(/["\r\n]/g, '_');
	const chunks: Buffer[] = [];
	for (const file of files) {
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${clean(file.field)}"; filename="${clean(file.filename)}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
			),
			file.data,
			Buffer.from('\r\n'),
		);
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Performs one authenticated request. Status errors are not thrown by n8n itself
 * (`ignoreHttpStatusErrors`), so every failure goes through `toApiError` and gets a clear message.
 */
export async function apiRequest(
	this: IExecuteFunctions,
	request: ApiRequest,
	itemIndex: number,
): Promise<ApiResponse> {
	const credentials = await this.getCredentials('factuurCentraalApi');

	const headers: IDataObject = {
		Accept: request.binary ? '*/*' : 'application/json',
		'User-Agent': CLIENT,
	};
	const companyId = String(credentials.companyId ?? '').trim();
	if (companyId) headers['X-Company-Id'] = companyId;

	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${BASE_URL}${request.path}`,
		headers,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (request.qs && Object.keys(request.qs).length > 0) options.qs = request.qs;

	if (request.multipart) {
		const { body, contentType } = buildMultipart(request.multipart);
		headers['Content-Type'] = contentType;
		options.body = body;
		options.json = false;
	} else if (request.body) {
		options.body = request.body;
	}

	if (request.binary) {
		options.encoding = 'arraybuffer';
		options.json = false;
	}

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'factuurCentraalApi',
		options,
	)) as { statusCode: number; headers: IDataObject; body: unknown };

	if (response.statusCode >= 400) {
		throw toApiError(this, response.statusCode, response.body, itemIndex);
	}

	return {
		status: response.statusCode,
		headers: response.headers ?? {},
		// A successful binary download keeps its raw buffer, everything else is JSON.
		body: request.binary ? response.body : parseBody(response.body),
	};
}
