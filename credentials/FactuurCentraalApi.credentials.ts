import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class FactuurCentraalApi implements ICredentialType {
	name = 'factuurCentraalApi';

	displayName = 'Factuur Centraal API';

	icon: Icon = {
		light: 'file:../icons/factuurcentraal.svg',
		dark: 'file:../icons/factuurcentraal.dark.svg',
	};

	documentationUrl = 'https://www.factuurcentraal.nl/api/v1/openapi.json';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'A personal token. Create one in your Factuur Centraal account under API. Tokens created there do not expire.',
		},
		{
			displayName: 'Company ID',
			name: 'companyId',
			type: 'string',
			default: '',
			description:
				'Optional. The ID of the company to work with when your account has more than one. Leave empty to use your first company. Find the IDs with the Company → Get Many operation.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	// Reads the logged in user and company, so testing a token has no side effects.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.factuurcentraal.nl/api/v1',
			url: '/auth/me',
			method: 'GET',
		},
	};
}
