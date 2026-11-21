import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type JsonObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { buildProperties } from './definitions';
import { runOperation } from './execute';
import { findOperation, resources } from './resources';

export class FactuurCentraal implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Factuur Centraal',
		name: 'factuurCentraal',
		icon: {
			light: 'file:../../icons/factuurcentraal.svg',
			dark: 'file:../../icons/factuurcentraal.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Manage invoices, clients, quotes, products, receipts and dimensions in Factuur Centraal',
		defaults: { name: 'Factuur Centraal' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'factuurCentraalApi', required: true }],
		properties: buildProperties(resources),
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operationName = this.getNodeParameter('operation', itemIndex) as string;
				const operation = findOperation(resource, operationName);
				if (!operation) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operationName}" is not supported for "${resource}"`,
						{ itemIndex },
					);
				}
				returnData.push(...(await runOperation.call(this, operation, itemIndex)));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
