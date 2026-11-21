import type { Field, Operation, PathParam, Resource } from './definitions';

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const choices = (...values: string[]) => values.map((value) => ({ name: titleCase(value), value }));

const DIMENSIONS_FIELD: Field = {
	name: 'dimensions',
	displayName: 'Dimensions',
	kind: 'json',
	placeholder: '{"1": 5}',
	description:
		'Dimension values as a JSON object: {"<dimension ID>": <value ID>}. Only allowed when dimensions are enabled for the company.',
};

const CURRENCY_FIELD: Field = {
	name: 'currency',
	displayName: 'Currency',
	kind: 'string',
	placeholder: 'EUR',
	description: 'Three letter currency code',
};

/** The name, address and registration numbers that are stored on a document. */
function partyFields(label: string): Field[] {
	return [
		{ name: 'client_company', displayName: `${label} Company`, kind: 'string' },
		{ name: 'client_name', displayName: `${label} Name`, kind: 'string' },
		{ name: 'client_email', displayName: `${label} Email`, kind: 'string' },
		{ name: 'client_street', displayName: `${label} Street`, kind: 'string' },
		{ name: 'client_postal_code', displayName: `${label} Postal Code`, kind: 'string' },
		{ name: 'client_city', displayName: `${label} City`, kind: 'string' },
		{ name: 'client_country', displayName: `${label} Country`, kind: 'string' },
		{ name: 'client_vat_number', displayName: `${label} VAT Number`, kind: 'string' },
		{ name: 'client_kvk_number', displayName: `${label} KVK Number`, kind: 'string' },
	];
}

const VAT_LINE_FIELD: Field = {
	name: 'tax_rate',
	displayName: 'VAT Rate',
	kind: 'number',
	default: 21,
	description: 'VAT percentage, for example 21, 9 or 0',
};

const DOCUMENT_LINE_FIELDS: Field[] = [
	{ name: 'description', displayName: 'Description', kind: 'string', required: true },
	{ name: 'quantity', displayName: 'Quantity', kind: 'number', default: 1, required: true },
	{
		name: 'unit_price',
		displayName: 'Unit Price',
		kind: 'number',
		required: true,
		description: 'Price per unit, excluding VAT',
	},
	VAT_LINE_FIELD,
];

const RECEIPT_LINE_FIELDS: Field[] = [
	{ name: 'description', displayName: 'Description', kind: 'string', required: true },
	{ name: 'quantity', displayName: 'Quantity', kind: 'number', default: 1 },
	{
		name: 'unit_price',
		displayName: 'Unit Price',
		kind: 'number',
		required: true,
		description: 'Price per unit, excluding VAT',
	},
	{
		name: 'tax_rate',
		displayName: 'VAT Rate',
		kind: 'number',
		default: 21,
		required: true,
		description: 'VAT percentage, for example 21, 9 or 0',
	},
	{
		name: 'reverse_charge',
		displayName: 'Reverse Charge',
		kind: 'boolean',
		description: 'Whether VAT is reverse charged: no VAT on the line, the VAT rate is used for the tax return',
	},
];

const linesField = (lines: Field[], description: string): Field => ({
	name: 'lines',
	displayName: 'Lines',
	kind: 'lines',
	top: true,
	lines,
	description,
});

function idParam(name: string, displayName: string, description: string, placeholder = 'id'): PathParam {
	return { placeholder, name, displayName, description, kind: 'number' };
}

interface CrudConfig {
	singular: string;
	plural: string;
	article: 'a' | 'an';
	basePath: string;
	id: PathParam;
	createFields: Field[];
	updateFields: Field[];
	filters?: Field[];
}

function crudOperations(config: CrudConfig): Operation[] {
	const { singular, plural, article, basePath, id } = config;
	const itemPath = `${basePath}/{${id.placeholder}}`;
	return [
		{
			value: 'create',
			name: 'Create',
			action: `Create ${article} ${singular}`,
			description: `Create a new ${singular}`,
			method: 'POST',
			path: basePath,
			fields: config.createFields,
		},
		{
			value: 'delete',
			name: 'Delete',
			action: `Delete ${article} ${singular}`,
			description: `Delete ${article} ${singular}`,
			method: 'DELETE',
			path: itemPath,
			pathParams: [id],
		},
		{
			value: 'get',
			name: 'Get',
			action: `Get ${article} ${singular}`,
			description: `Retrieve ${article} ${singular}`,
			method: 'GET',
			path: itemPath,
			pathParams: [id],
		},
		{
			value: 'getAll',
			name: 'Get Many',
			action: `Get many ${plural}`,
			description: `Retrieve many ${plural}`,
			method: 'GET',
			path: basePath,
			paginated: true,
			fields: config.filters,
		},
		{
			value: 'update',
			name: 'Update',
			action: `Update ${article} ${singular}`,
			description: `Update ${article} ${singular}`,
			method: 'PUT',
			path: itemPath,
			pathParams: [id],
			fields: config.updateFields,
		},
	];
}

const searchFilter = (description: string): Field => ({
	name: 'search',
	displayName: 'Search',
	kind: 'string',
	description,
});

const dimensionFilters: Field[] = [
	{
		name: 'dimension_id',
		displayName: 'Dimension ID',
		kind: 'number',
		description: 'Use together with Dimension Value: only documents with this dimension value',
	},
	{
		name: 'dimension_value',
		displayName: 'Dimension Value ID',
		kind: 'number',
		description: 'The value ID, or 0 for documents without a value in that dimension',
	},
];

// ----- Invoice -----

const invoiceBaseFields: Field[] = [
	{
		name: 'invoice_number',
		displayName: 'Invoice Number',
		kind: 'string',
		description: 'Leave empty to use the next number of the company',
	},
	{
		name: 'client_id',
		displayName: 'Client ID',
		kind: 'number',
		description: 'The ID of an existing client to link to this invoice',
	},
	{
		name: 'status',
		displayName: 'Status',
		kind: 'options',
		options: choices('draft', 'sent', 'paid', 'overdue', 'cancelled'),
	},
	{ name: 'notes', displayName: 'Notes', kind: 'string' },
	CURRENCY_FIELD,
	{
		name: 'reminders_paused',
		displayName: 'Reminders Paused',
		kind: 'boolean',
		description: 'Whether payment reminders are paused for this invoice',
	},
	...partyFields('Client'),
	DIMENSIONS_FIELD,
];

const invoiceCreateFields: Field[] = [
	{ name: 'invoice_date', displayName: 'Invoice Date', kind: 'date', required: true },
	{ name: 'due_date', displayName: 'Due Date', kind: 'date', required: true },
	linesField(DOCUMENT_LINE_FIELDS, 'The invoice lines. The total is calculated from the lines.'),
	...invoiceBaseFields,
	{
		name: 'send_email',
		displayName: 'Send Email',
		kind: 'boolean',
		description:
			'Whether to email the invoice right away, with the PDF. A draft is then set to sent. Needs a recipient and a confirmed email address for your user.',
	},
	{
		name: 'email_to',
		displayName: 'Email To',
		kind: 'string',
		description: 'The recipient. Defaults to the email address on the invoice or of the client.',
	},
	{ name: 'email_message', displayName: 'Email Message', kind: 'string', description: 'A personal text for in the email' },
];

const invoiceUpdateFields: Field[] = [
	{ name: 'invoice_date', displayName: 'Invoice Date', kind: 'date' },
	{ name: 'due_date', displayName: 'Due Date', kind: 'date' },
	...invoiceBaseFields,
];

const invoice: Resource = {
	value: 'invoice',
	name: 'Invoice',
	operations: [
		...crudOperations({
			singular: 'invoice',
			plural: 'invoices',
			article: 'an',
			basePath: '/invoices',
			id: idParam('invoiceId', 'Invoice ID', 'The ID of the invoice'),
			createFields: invoiceCreateFields,
			updateFields: invoiceUpdateFields,
			filters: [
				{
					name: 'status',
					displayName: 'Status',
					kind: 'options',
					options: choices('draft', 'sent', 'paid', 'overdue', 'cancelled'),
				},
				searchFilter('Invoice number, client name or company'),
				...dimensionFilters,
			],
		}),
		{
			value: 'getPdf',
			name: 'Get PDF',
			action: 'Get an invoice as PDF',
			description: 'Download an invoice as a PDF file',
			method: 'GET',
			path: '/invoices/{id}/pdf',
			pathParams: [idParam('invoiceId', 'Invoice ID', 'The ID of the invoice')],
			special: 'pdf',
		},
		{
			value: 'markPaid',
			name: 'Mark as Paid',
			action: 'Mark an invoice as paid',
			description: 'Mark an invoice as paid',
			method: 'POST',
			path: '/invoices/{id}/mark-paid',
			pathParams: [idParam('invoiceId', 'Invoice ID', 'The ID of the invoice')],
		},
		{
			value: 'send',
			name: 'Send',
			action: 'Send an invoice by email',
			description: 'Email an invoice with the PDF attached',
			method: 'POST',
			path: '/invoices/{id}/send',
			pathParams: [idParam('invoiceId', 'Invoice ID', 'The ID of the invoice')],
			fields: [
				{
					name: 'email_to',
					displayName: 'Email To',
					kind: 'string',
					description:
						'The recipient. Defaults to the email address on the invoice or of the client.',
				},
				{
					name: 'email_message',
					displayName: 'Email Message',
					kind: 'string',
					description: 'A personal text for in the email',
				},
			],
		},
	],
};

// ----- Client -----

const clientFields: Field[] = [
	{ name: 'contact_person', displayName: 'Contact Person', kind: 'string', required: true },
	{ name: 'email', displayName: 'Email', kind: 'string', required: true, placeholder: 'name@example.com' },
	{ name: 'company_name', displayName: 'Company Name', kind: 'string' },
	{ name: 'phone', displayName: 'Phone', kind: 'string' },
	{ name: 'street', displayName: 'Street', kind: 'string' },
	{ name: 'postal_code', displayName: 'Postal Code', kind: 'string' },
	{ name: 'city', displayName: 'City', kind: 'string' },
	{ name: 'country', displayName: 'Country', kind: 'string' },
	{ name: 'vat_number', displayName: 'VAT Number', kind: 'string' },
	{ name: 'kvk_number', displayName: 'KVK Number', kind: 'string' },
	{ name: 'bank_account', displayName: 'Bank Account', kind: 'string', description: 'The IBAN of the client' },
];

const client: Resource = {
	value: 'client',
	name: 'Client',
	operations: crudOperations({
		singular: 'client',
		plural: 'clients',
		article: 'a',
		basePath: '/clients',
		id: idParam('clientId', 'Client ID', 'The ID of the client'),
		createFields: clientFields,
		updateFields: clientFields,
		filters: [searchFilter('Name, company or email')],
	}),
};

// ----- Quote -----

const quoteFields: Field[] = [
	{ name: 'quote_date', displayName: 'Quote Date', kind: 'date', required: true },
	{ name: 'valid_until', displayName: 'Valid Until', kind: 'date', required: true },
	linesField(DOCUMENT_LINE_FIELDS, 'The quote lines'),
	{
		name: 'quote_number',
		displayName: 'Quote Number',
		kind: 'string',
		description: 'Leave empty to use the next number of the company',
	},
	{
		name: 'client_id',
		displayName: 'Client ID',
		kind: 'number',
		description: 'The ID of an existing client to link to this quote',
	},
	{
		name: 'status',
		displayName: 'Status',
		kind: 'options',
		options: choices('draft', 'sent', 'accepted', 'declined', 'expired', 'converted'),
	},
	{ name: 'notes', displayName: 'Notes', kind: 'string' },
	CURRENCY_FIELD,
	...partyFields('Client'),
];

const quote: Resource = {
	value: 'quote',
	name: 'Quote',
	operations: crudOperations({
		singular: 'quote',
		plural: 'quotes',
		article: 'a',
		basePath: '/quotes',
		id: idParam('quoteId', 'Quote ID', 'The ID of the quote'),
		createFields: quoteFields,
		updateFields: quoteFields,
		filters: [
			{
				name: 'status',
				displayName: 'Status',
				kind: 'options',
				options: choices('draft', 'sent', 'accepted', 'declined', 'expired', 'converted'),
			},
			searchFilter('Quote number, client name or company'),
		],
	}),
};

// ----- Product -----

const productFields: Field[] = [
	{ name: 'name', displayName: 'Name', kind: 'string', required: true },
	{
		name: 'unit',
		displayName: 'Unit',
		kind: 'string',
		required: true,
		placeholder: 'piece',
		description: 'The unit the product is sold in, for example piece or hour',
	},
	{
		name: 'unit_price',
		displayName: 'Unit Price',
		kind: 'number',
		required: true,
		description: 'Price per unit, excluding VAT',
	},
	{
		name: 'tax_rate',
		displayName: 'VAT Rate',
		kind: 'number',
		required: true,
		default: 21,
		description: 'VAT percentage, for example 21, 9 or 0',
	},
	{ name: 'description', displayName: 'Description', kind: 'string' },
	{ name: 'sku', displayName: 'SKU', kind: 'string' },
	{
		name: 'is_active',
		displayName: 'Active',
		kind: 'boolean',
		default: true,
		description: 'Whether the product can be used on documents',
	},
];

const product: Resource = {
	value: 'product',
	name: 'Product',
	operations: crudOperations({
		singular: 'product',
		plural: 'products',
		article: 'a',
		basePath: '/products',
		id: idParam('productId', 'Product ID', 'The ID of the product'),
		createFields: productFields,
		updateFields: productFields,
		filters: [
			searchFilter('Name, description or SKU'),
			{
				name: 'active_only',
				displayName: 'Active Only',
				kind: 'boolean',
				description: 'Whether to only return active products',
			},
		],
	}),
};

// ----- Receipt -----

const receiptFields: Field[] = [
	{ name: 'receipt_date', displayName: 'Receipt Date', kind: 'date', required: true },
	linesField(
		RECEIPT_LINE_FIELDS,
		'The receipt lines. They replace all existing lines and the total is calculated from them.',
	),
	{ name: 'receipt_number', displayName: 'Receipt Number', kind: 'string' },
	{
		name: 'total',
		displayName: 'Total',
		kind: 'number',
		description:
			'The total including VAT. Optional while the status is draft, required for other statuses unless you use lines.',
	},
	{
		name: 'status',
		displayName: 'Status',
		kind: 'options',
		default: 'draft',
		options: choices('draft', 'unpaid', 'paid', 'overdue', 'cancelled'),
	},
	{ name: 'notes', displayName: 'Notes', kind: 'string' },
	{
		name: 'category',
		displayName: 'Category Key',
		kind: 'string',
		description: 'The key of a receipt category, see Receipt Category → Get Many',
	},
	CURRENCY_FIELD,
	...partyFields('Supplier'),
	{
		name: 'supplier_id',
		displayName: 'Supplier ID',
		kind: 'number',
		description: 'A supplier of the company (Pro, supplier management)',
	},
	{
		name: 'vat_rate',
		displayName: 'VAT Rate of Total',
		kind: 'number',
		default: 21,
		description:
			'The VAT rate of the total, for example 21, 9 or 0. Only together with Total and not together with lines.',
	},
	{
		name: 'reverse_charge',
		displayName: 'Reverse Charge',
		kind: 'boolean',
		description: 'Whether VAT is reverse charged: there is no VAT on the receipt',
	},
	DIMENSIONS_FIELD,
];

const attachmentId = idParam('attachmentId', 'Attachment ID', 'The ID of the attachment', 'attachment');

const receipt: Resource = {
	value: 'receipt',
	name: 'Receipt',
	operations: [
		...crudOperations({
			singular: 'receipt',
			plural: 'receipts',
			article: 'a',
			basePath: '/receipts',
			id: idParam('receiptId', 'Receipt ID', 'The ID of the receipt'),
			createFields: receiptFields,
			updateFields: receiptFields,
			filters: [
				{
					name: 'status',
					displayName: 'Status',
					kind: 'options',
					options: choices('draft', 'unpaid', 'paid', 'overdue', 'cancelled'),
				},
				searchFilter('Receipt number or supplier'),
				{ name: 'date_from', displayName: 'Date From', kind: 'date' },
				{ name: 'date_to', displayName: 'Date To', kind: 'date' },
				...dimensionFilters,
			],
		}),
		{
			value: 'addAttachments',
			name: 'Add Attachments',
			action: 'Add attachments to a receipt',
			description: 'Upload one or more files to a receipt',
			method: 'POST',
			path: '/receipts/{id}/attachments',
			pathParams: [idParam('receiptId', 'Receipt ID', 'The ID of the receipt')],
			special: 'uploadAttachments',
		},
		{
			value: 'getAttachment',
			name: 'Get Attachment',
			action: 'Get an attachment of a receipt',
			description: 'Download the file of a receipt attachment',
			method: 'GET',
			path: '/receipts/{id}/attachments/{attachment}',
			pathParams: [idParam('receiptId', 'Receipt ID', 'The ID of the receipt'), attachmentId],
			special: 'downloadAttachment',
		},
	],
};

// ----- Receipt category -----

const receiptCategory: Resource = {
	value: 'receiptCategory',
	name: 'Receipt Category',
	operations: [
		{
			value: 'create',
			name: 'Create',
			action: 'Create a receipt category',
			description: 'Create a new receipt category (owner only, Pro)',
			method: 'POST',
			path: '/receipt-categories',
			fields: [
				{ name: 'name', displayName: 'Name', kind: 'string', required: true },
				{
					name: 'icon',
					displayName: 'Icon',
					kind: 'string',
					description: 'One of the icons returned by the Get Many operation of this resource',
				},
			],
		},
		{
			value: 'delete',
			name: 'Delete',
			action: 'Delete a receipt category',
			description: 'Delete a receipt category (owner only, Pro)',
			method: 'DELETE',
			path: '/receipt-categories/{key}',
			pathParams: [
				{
					placeholder: 'key',
					name: 'categoryKey',
					displayName: 'Category Key',
					description: 'The key of the category',
					kind: 'string',
				},
			],
			fields: [
				{
					name: 'move_to',
					displayName: 'Move To',
					kind: 'string',
					description:
						'Required when the category is still in use: the key of another category, or none for no category',
				},
			],
		},
		{
			value: 'getAll',
			name: 'Get Many',
			action: 'Get many receipt categories',
			description: 'Retrieve many receipt categories',
			method: 'GET',
			path: '/receipt-categories',
			resultKey: 'categories',
		},
		{
			value: 'update',
			name: 'Update',
			action: 'Update a receipt category',
			description: 'Rename, hide or move a receipt category (owner only, Pro)',
			method: 'PUT',
			path: '/receipt-categories/{key}',
			pathParams: [
				{
					placeholder: 'key',
					name: 'categoryKey',
					displayName: 'Category Key',
					description: 'The key of the category',
					kind: 'string',
				},
			],
			fields: [
				{ name: 'name', displayName: 'Name', kind: 'string' },
				{ name: 'icon', displayName: 'Icon', kind: 'string' },
				{
					name: 'is_active',
					displayName: 'Active',
					kind: 'boolean',
					default: true,
					description: 'Whether the category is visible',
				},
				{ name: 'position', displayName: 'Position', kind: 'number' },
			],
		},
	],
};

// ----- Company -----

const company: Resource = {
	value: 'company',
	name: 'Company',
	operations: [
		{
			value: 'get',
			name: 'Get',
			action: 'Get the current company',
			description: 'Retrieve the company of the credential',
			method: 'GET',
			path: '/company',
		},
		{
			value: 'getAll',
			name: 'Get Many',
			action: 'Get many companies',
			description: 'Retrieve the companies you have access to, for example to find a company ID',
			method: 'GET',
			path: '/companies',
		},
		{
			value: 'update',
			name: 'Update',
			action: 'Update the current company',
			description: 'Update the company of the credential',
			method: 'PUT',
			path: '/company',
			fields: [
				{ name: 'company_name', displayName: 'Company Name', kind: 'string' },
				{ name: 'contact_person', displayName: 'Contact Person', kind: 'string' },
				{ name: 'street', displayName: 'Street', kind: 'string' },
				{ name: 'postal_code', displayName: 'Postal Code', kind: 'string' },
				{ name: 'city', displayName: 'City', kind: 'string' },
				{ name: 'country', displayName: 'Country', kind: 'string' },
				{ name: 'email', displayName: 'Email', kind: 'string' },
				{ name: 'phone', displayName: 'Phone', kind: 'string' },
				{ name: 'website', displayName: 'Website', kind: 'string' },
				{ name: 'vat_number', displayName: 'VAT Number', kind: 'string' },
				{ name: 'kvk_number', displayName: 'KVK Number', kind: 'string' },
				{
					name: 'bank_account',
					displayName: 'Bank Account',
					kind: 'string',
					description:
						'The IBAN. Only the owner can change this, together with the current password or a one-time code.',
				},
				{ name: 'payment_conditions', displayName: 'Payment Conditions', kind: 'string' },
				{ name: 'invoice_footer_note', displayName: 'Invoice Footer Note', kind: 'string' },
				{ name: 'default_vat_rate', displayName: 'Default VAT Rate', kind: 'number', default: 21 },
				{ name: 'default_payment_days', displayName: 'Default Payment Days', kind: 'number', default: 14 },
				{ ...CURRENCY_FIELD, name: 'invoice_currency', displayName: 'Invoice Currency' },
				{
					name: 'dimensions_enabled',
					displayName: 'Dimensions Enabled',
					kind: 'boolean',
					description:
						'Whether dimensions are enabled. Owner only, and only if the plan includes dimensions.',
				},
				{
					name: 'current_password',
					displayName: 'Current Password',
					kind: 'string',
					password: true,
					description: 'Needed to change the bank account',
				},
				{
					name: 'otp',
					displayName: 'One-Time Code',
					kind: 'string',
					description: 'Needed to change the bank account, as an alternative to the password',
				},
			],
		},
	],
};

// ----- Dimension -----

const dimensionId = idParam('dimensionId', 'Dimension ID', 'The ID of the dimension');
const dimensionValueId = idParam('dimensionValueId', 'Dimension Value ID', 'The ID of the dimension value');

const dimension: Resource = {
	value: 'dimension',
	name: 'Dimension',
	operations: [
		{
			value: 'create',
			name: 'Create',
			action: 'Create a dimension',
			description: 'Create a new dimension (Pro)',
			method: 'POST',
			path: '/dimensions',
			fields: [{ name: 'name', displayName: 'Name', kind: 'string', required: true }],
		},
		{
			value: 'delete',
			name: 'Delete',
			action: 'Delete a dimension',
			description: 'Delete a dimension (owner only, Pro)',
			method: 'DELETE',
			path: '/dimensions/{id}',
			pathParams: [dimensionId],
		},
		{
			value: 'get',
			name: 'Get',
			action: 'Get a dimension',
			description: 'Retrieve a dimension with its values (Pro)',
			method: 'GET',
			path: '/dimensions/{id}',
			pathParams: [dimensionId],
		},
		{
			value: 'getAll',
			name: 'Get Many',
			action: 'Get many dimensions',
			description: 'Retrieve many dimensions with their values (Pro)',
			method: 'GET',
			path: '/dimensions',
			resultKey: 'dimensions',
		},
		{
			value: 'getReport',
			name: 'Get Report',
			action: 'Get a dimension report',
			description: 'Retrieve revenue, costs and result per dimension value (Pro)',
			method: 'GET',
			path: '/reports/dimensions',
			fields: [
				{ name: 'dimension_id', displayName: 'Dimension ID', kind: 'number' },
				{ name: 'year', displayName: 'Year', kind: 'number', default: new Date().getFullYear() },
				{
					name: 'basis',
					displayName: 'Basis',
					kind: 'options',
					options: [
						{ name: 'Paid', value: 'paid' },
						{ name: 'Invoice', value: 'invoice' },
					],
				},
			],
		},
		{
			value: 'update',
			name: 'Update',
			action: 'Update a dimension',
			description: 'Rename or (de)activate a dimension (Pro)',
			method: 'PUT',
			path: '/dimensions/{id}',
			pathParams: [dimensionId],
			fields: [
				{ name: 'name', displayName: 'Name', kind: 'string' },
				{ name: 'is_active', displayName: 'Active', kind: 'boolean', default: true },
			],
		},
		{
			value: 'updateSettings',
			name: 'Update Settings',
			action: 'Enable or disable dimensions',
			description: 'Enable or disable dimensions for the company (owner only, Pro)',
			method: 'PUT',
			path: '/dimensions/settings',
			fields: [
				{
					name: 'enabled',
					displayName: 'Enabled',
					kind: 'boolean',
					required: true,
					description: 'Whether dimensions are enabled for the company',
				},
			],
		},
		{
			value: 'addValue',
			name: 'Add Value',
			action: 'Add a value to a dimension',
			description: 'Add a value to a dimension (owner only, Pro)',
			method: 'POST',
			path: '/dimensions/{id}/values',
			pathParams: [dimensionId],
			fields: [
				{ name: 'name', displayName: 'Name', kind: 'string', required: true },
				{ name: 'code', displayName: 'Code', kind: 'string' },
			],
		},
		{
			value: 'updateValue',
			name: 'Update Value',
			action: 'Update a dimension value',
			description: 'Update a dimension value (Pro)',
			method: 'PUT',
			path: '/dimension-values/{id}',
			pathParams: [dimensionValueId],
			fields: [
				{ name: 'name', displayName: 'Name', kind: 'string' },
				{ name: 'code', displayName: 'Code', kind: 'string' },
				{ name: 'is_active', displayName: 'Active', kind: 'boolean', default: true },
			],
		},
		{
			value: 'deleteValue',
			name: 'Delete Value',
			action: 'Delete a dimension value',
			description: 'Delete a dimension value (Pro)',
			method: 'DELETE',
			path: '/dimension-values/{id}',
			pathParams: [dimensionValueId],
		},
	],
};

export const resources: Resource[] = [
	client,
	company,
	dimension,
	invoice,
	product,
	quote,
	receipt,
	receiptCategory,
];

export function findOperation(resource: string, operation: string): Operation | undefined {
	return resources.find((r) => r.value === resource)?.operations.find((o) => o.value === operation);
}
