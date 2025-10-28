import { App, Plugin } from 'obsidian';
import { getAPI } from 'obsidian-local-rest-api';

// Extend the Obsidian App type to include plugins
interface ObsidianApp extends App {
	plugins: {
		plugins: {
			dataview?: {
				api: any;
			};
		};
	};
}

export default class TodosApiPlugin extends Plugin {
	private api: any;

	async onload() {
		console.log('Loading Todos REST API plugin');

		// Get the Local REST API
		this.api = getAPI(this.app, this.manifest);
		if (!this.api) {
			console.error('Local REST API plugin is not available');
			return;
		}

		// Register the /todos route
		this.api.addRoute('/todos/').get(async (request: any, response: any) => {
			try {
				// Check if Dataview is available
				const app = this.app as ObsidianApp;
				const dataviewPlugin = app.plugins.plugins.dataview;
				if (!dataviewPlugin) {
					return response.status(503).json({
						error: 'Dataview plugin not found',
						message: 'Please install and enable the Dataview plugin'
					});
				}

				const dataviewApi = dataviewPlugin.api;
				if (!dataviewApi) {
					return response.status(503).json({
						error: 'Dataview API not available',
						message: 'Dataview plugin may not be fully loaded'
					});
				}

				// Query for all tasks
				const result = await dataviewApi.query('TASK');

				if (!result.successful) {
					return response.status(500).json({
						error: 'Query failed',
						message: result.error
					});
				}

				if (result.value.type !== 'task') {
					return response.status(500).json({
						error: 'Unexpected result type',
						message: `Expected task result, got ${result.value.type}`
					});
				}

				// Extract tasks from the Grouping structure
				const tasks = this.flattenTasks(result.value.values);

				// Parse query parameters for filtering
				const params = new URLSearchParams(request.url.split('?')[1] || '');
				const filterCompleted = params.get('completed');
				const filterPath = params.get('path');
				const filterTag = params.get('tag');

				// Apply filters
				let filteredTasks = tasks;

				if (filterCompleted !== null) {
					const showCompleted = filterCompleted === 'true';
					filteredTasks = filteredTasks.filter(task => task.completed === showCompleted);
				}

				if (filterPath) {
					filteredTasks = filteredTasks.filter(task => 
						task.path.includes(filterPath)
					);
				}

				if (filterTag) {
					filteredTasks = filteredTasks.filter(task => 
						task.tags && task.tags.some((tag: string) => tag.includes(filterTag))
					);
				}

				// Return the filtered tasks
				return response.status(200).json({
					count: filteredTasks.length,
					tasks: filteredTasks
				});

			} catch (error) {
				console.error('Error fetching todos:', error);
				return response.status(500).json({
					error: 'Internal server error',
					message: error.message
				});
			}
		});

		console.log('Todos REST API route registered at /todos/');
	}

	/**
	 * Flatten the Grouping structure returned by Dataview into a simple array of tasks.
	 * The Grouping structure can be nested and contains both individual tasks and groups.
	 */
	private flattenTasks(grouping: any): any[] {
		const tasks: any[] = [];

		if (Array.isArray(grouping)) {
			for (const item of grouping) {
				if (item.rows) {
					// This is a group, recursively flatten
					tasks.push(...this.flattenTasks(item.rows));
				} else if (item.task) {
					// This is a task item
					tasks.push(item);
					// Also include any children/subtasks
					if (item.children && item.children.length > 0) {
						tasks.push(...this.flattenTasks(item.children));
					}
				}
			}
		}

		return tasks;
	}

	onunload() {
		console.log('Unloading Todos REST API plugin');
	}
}
