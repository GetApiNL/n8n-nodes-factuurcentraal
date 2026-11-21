import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

/**
 * The node is data driven: `resources.ts` describes every resource and operation as plain
 * data, `buildProperties` turns that into n8n node properties, and `execute.ts` reads the
 * same data to build the HTTP request. Adding an endpoint means adding data, not code.
 */

export type FieldKind = 'string' | 'number' | 'boolean' | 'date' | 'options' | 'json' | 'lines';

export interface Field {
	/** The property name in the API (snake_case). */
	name: string;
	displayName: string;
	kind: FieldKind;
	description?: string;
	placeholder?: string;
	options?: Array<{ name: string; value: string }>;
	default?: string | number | boolean;
	/** Sub fields of a `lines` field. */
	lines?: Field[];
	password?: boolean;
	/** Always shown and required. */
	required?: boolean;
	/** Always shown, but optional (used for invoice lines). */
	top?: boolean;
}

export interface PathParam {
	/** The placeholder in the path, without braces. */
	placeholder: string;
	/** The n8n parameter name. */
	name: string;
	displayName: string;
	description: string;
	kind: 'number' | 'string';
}

export type SpecialOperation = 'pdf' | 'downloadAttachment' | 'uploadAttachments';

export interface Operation {
	value: string;
	name: string;
	action: string;
	description: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	path: string;
	pathParams?: PathParam[];
	/** Sent as query string for GET and DELETE, as JSON body for POST and PUT. */
	fields?: Field[];
	/** A page based list: adds Return All and Limit, and reads `data` from the response. */
	paginated?: boolean;
	/** The property of the response that holds the list to return as separate items. */
	resultKey?: string;
	special?: SpecialOperation;
}

export interface Resource {
	value: string;
	name: string;
	operations: Operation[];
}

export function camel(name: string): string {
	return name.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function isExtraField(field: Field): boolean {
	return !field.required && !field.top;
}

function byDisplayName(a: { displayName: string }, b: { displayName: string }): number {
	return a.displayName.localeCompare(b.displayName);
}

export function fieldToProperty(field: Field, displayOptions?: IDisplayOptions): INodeProperties {
	const common = {
		displayName: field.displayName,
		name: camel(field.name),
		description: field.description ?? '',
		...(field.placeholder ? { placeholder: field.placeholder } : {}),
		...(displayOptions ? { displayOptions } : {}),
		...(field.required ? { required: true } : {}),
	};

	switch (field.kind) {
		case 'number':
			return { ...common, type: 'number', default: (field.default as number | undefined) ?? 0 };
		case 'boolean':
			return { ...common, type: 'boolean', default: (field.default as boolean | undefined) ?? false };
		case 'date':
			return { ...common, type: 'dateTime', default: '' };
		case 'json':
			return { ...common, type: 'json', default: '{}' };
		case 'options': {
			const options = field.options ?? [];
			return {
				...common,
				type: 'options',
				options,
				default: (field.default as string | undefined) ?? options[0]?.value ?? '',
			};
		}
		case 'lines':
			return {
				...common,
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Line',
				default: {},
				options: [
					{
						displayName: 'Line',
						name: 'line',
						values: (field.lines ?? []).map((line) => fieldToProperty(line)),
					},
				],
			};
		default:
			return {
				...common,
				type: 'string',
				default: (field.default as string | undefined) ?? '',
				...(field.password ? { typeOptions: { password: true } } : {}),
			};
	}
}

function operationProperties(resource: Resource, operation: Operation): INodeProperties[] {
	const show = { resource: [resource.value], operation: [operation.value] };
	const properties: INodeProperties[] = [];

	for (const param of operation.pathParams ?? []) {
		properties.push({
			displayName: param.displayName,
			name: param.name,
			type: param.kind === 'number' ? 'number' : 'string',
			required: true,
			default: param.kind === 'number' ? 0 : '',
			description: param.description,
			displayOptions: { show },
		});
	}

	const fields = operation.fields ?? [];
	for (const field of fields.filter((f) => !isExtraField(f))) {
		properties.push(fieldToProperty(field, { show }));
	}

	if (operation.special === 'pdf' || operation.special === 'downloadAttachment') {
		properties.push({
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			description: 'The name of the output field to put the binary file data in',
			displayOptions: { show },
		});
	}

	if (operation.special === 'uploadAttachments') {
		properties.push({
			displayName: 'Input Binary Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			description:
				'The name of the binary field on the input item that holds the file to upload. Use a comma-separated list to upload several files (jpg, png, pdf or heic, max 10 MB each).',
			displayOptions: { show },
		});
	}

	if (operation.paginated) {
		properties.push(
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { ...show, returnAll: [false] } },
			},
		);
	}

	const extras = fields.filter(isExtraField);
	if (extras.length > 0) {
		properties.push({
			displayName: operation.paginated ? 'Filters' : 'Additional Fields',
			name: 'additionalFields',
			type: 'collection',
			placeholder: operation.paginated ? 'Add Filter' : 'Add Field',
			default: {},
			displayOptions: { show },
			options: extras.map((field) => fieldToProperty(field)).sort(byDisplayName),
		});
	}

	return properties;
}

export function buildProperties(resources: Resource[]): INodeProperties[] {
	const sortedResources = [...resources].sort((a, b) => a.name.localeCompare(b.name));

	const properties: INodeProperties[] = [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: sortedResources.map((resource) => ({ name: resource.name, value: resource.value })),
			default: 'invoice',
		},
	];

	for (const resource of sortedResources) {
		const operations = [...resource.operations].sort((a, b) => a.name.localeCompare(b.name));
		const defaultOperation: string =
			operations.find((o) => o.value === 'getAll')?.value ?? operations[0].value;
		properties.push({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: [resource.value] } },
			options: operations.map((operation) => ({
				name: operation.name,
				value: operation.value,
				description: operation.description,
				action: operation.action,
			})),
			default: defaultOperation,
		});
		for (const operation of operations) {
			properties.push(...operationProperties(resource, operation));
		}
	}

	return properties;
}
